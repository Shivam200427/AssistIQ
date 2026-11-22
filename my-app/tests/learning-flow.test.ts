import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDB } from "../src/app/api/utils/db";
import Quiz from "../src/app/api/lib/Quiz";
import QuizAttempt from "../src/app/api/lib/QuizAttempt";
import { POST as selectOption } from "../src/app/api/quiz/selectoption/route";
import { POST as submit } from "../src/app/api/quiz/submit/route";
import { POST as retake } from "../src/app/api/quiz/retake/route";
import { POST as getQuiz } from "../src/app/api/quiz/getquiz/route";
import { GET as mistakes } from "../src/app/api/quiz/mistakes/route";
import { nextReviewDays, REVIEW_INTERVALS, topicStats } from "../src/app/api/quiz/learning";
import { validateQuestions } from "../src/app/api/quiz/validate";
import { STUDENT_A, STUDENT_B, get, json, post } from "./helpers";

let quiz: any;
const ids = () => quiz.questions.map((q: any) => String(q._id));

beforeAll(async () => {
  await connectDB();
  await QuizAttempt.syncIndexes();
});

beforeEach(async () => {
  await Quiz.deleteMany({});
  await QuizAttempt.deleteMany({});
  const q = (text: string, topic: string, key: string) => ({
    questionText: text,
    topic,
    answers: [{ label: "A", option: "a" }, { label: "B", option: "b" }],
    correctAnswer: key,
    explanation: `${text} explained`,
  });
  quiz = await Quiz.create({
    userId: "t",
    ownerId: STUDENT_A,
    title: "Cell biology",
    documentId: "65f000000000000000000001",
    questions: [q("Q1 mitochondria?", "Mitochondria", "A"), q("Q2 mitochondria?", "Mitochondria", "B"), q("Q3 ribosomes?", "Ribosomes", "A"), q("Q4 ribosomes?", "Ribosomes", "A")],
  });
});

async function answerAndSubmit(uid: string, answers: string[]) {
  const qid = ids();
  for (let i = 0; i < answers.length; i++) {
    await selectOption(post("/api/quiz/selectoption", { quizid: String(quiz._id), questionId: qid[i], choosenAnswer: answers[i] }, { uid }));
  }
  return json(await submit(post("/api/quiz/submit", { quizid: String(quiz._id) }, { uid })));
}

describe("quiz -> weak topics -> spaced re-quiz", () => {
  it("finds weak topics from the student's own answers after submitting", async () => {
    const res = await answerAndSubmit(STUDENT_A, ["B", "A", "A", "A"]); // both Mitochondria wrong, Ribosomes right
    const weak = res.body.insights.topics.filter((t: any) => t.weak).map((t: any) => t.topic);
    expect(weak).toEqual(["Mitochondria"]);
    expect(res.body.insights.mistakes).toBe(2);
    expect(res.body.insights.nextReviewDays).toBe(1); // 50% -> review tomorrow
    expect(res.body.quiz.documentId).toBe("65f000000000000000000001"); // links back to the source PDF
  });

  it("hides insights until submission", async () => {
    await selectOption(post("/api/quiz/selectoption", { quizid: String(quiz._id), questionId: ids()[0], choosenAnswer: "B" }, { uid: STUDENT_A }));
    const res = await json(await getQuiz(post("/api/quiz/getquiz", { id: String(quiz._id) }, { uid: STUDENT_A })));
    expect(res.body.insights).toBeNull();
  });

  it("spaces re-quizzes further apart as the student keeps passing (repeatable tests)", async () => {
    const first = await answerAndSubmit(STUDENT_A, ["A", "B", "A", "A"]); // 100%
    expect(first.body.insights.nextReviewDays).toBe(REVIEW_INTERVALS[1]);
    await retake(post("/api/quiz/retake", { quizid: String(quiz._id) }, { uid: STUDENT_A }));
    const second = await answerAndSubmit(STUDENT_A, ["A", "B", "A", "A"]);
    expect(second.body.insights.nextReviewDays).toBe(REVIEW_INTERVALS[2]);
    expect(await QuizAttempt.countDocuments({ ownerId: STUDENT_A, status: "submitted" })).toBe(2);
  });

  it("interval rules: weak scores reset to tomorrow, strong scores step up, capped", () => {
    expect(nextReviewDays(0.4, 3)).toBe(1);
    expect(nextReviewDays(0.7, 1)).toBe(REVIEW_INTERVALS[1]);
    expect(nextReviewDays(0.9, 0)).toBe(REVIEW_INTERVALS[1]);
    expect(nextReviewDays(1, 99)).toBe(REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]);
  });

  it("topic stats fall back to the quiz title for untagged questions", () => {
    const stats = topicStats({ title: "Old quiz", questions: [{ _id: "1", correctAnswer: "A" }] }, { "1": "B" });
    expect(stats[0]).toMatchObject({ topic: "Old quiz", weak: true });
  });

  it("keeps the topic label from generated questions", () => {
    const { questions } = validateQuestions([{ questionText: "What is ATP?", answers: ["energy", "sugar"], correctAnswer: "A", topic: "Cell energy" }]);
    expect(questions[0].topic).toBe("Cell energy");
  });
});

describe("mistakes notebook", () => {
  it("lists only the caller's own mistakes, from their latest attempt", async () => {
    await answerAndSubmit(STUDENT_A, ["B", "A", "A", "A"]);
    await answerAndSubmit(STUDENT_B, ["A", "B", "B", "B"]);

    const a = await json(await mistakes(get("/api/quiz/mistakes", { uid: STUDENT_A })));
    const b = await json(await mistakes(get("/api/quiz/mistakes", { uid: STUDENT_B })));
    expect(a.body.mistakes.map((m: any) => m.questionText)).toEqual(["Q1 mitochondria?", "Q2 mitochondria?"]);
    expect(b.body.mistakes.map((m: any) => m.questionText).sort()).toEqual(["Q3 ribosomes?", "Q4 ribosomes?"]);
    expect(a.body.mistakes[0]).toMatchObject({ yourAnswer: "B", correctAnswer: "A", topic: "Mitochondria" });

    // After a better retake, the notebook reflects the latest attempt.
    await retake(post("/api/quiz/retake", { quizid: String(quiz._id) }, { uid: STUDENT_A }));
    await answerAndSubmit(STUDENT_A, ["A", "B", "A", "A"]);
    const after = await json(await mistakes(get("/api/quiz/mistakes", { uid: STUDENT_A })));
    expect(after.body.mistakes).toHaveLength(0);
  });

  it("requires sign-in", async () => {
    expect((await mistakes(get("/api/quiz/mistakes"))).status).toBe(401);
  });
});
