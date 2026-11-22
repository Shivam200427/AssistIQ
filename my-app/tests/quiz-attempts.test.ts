import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "../src/app/api/utils/db";
import Quiz from "../src/app/api/lib/Quiz";
import QuizAttempt from "../src/app/api/lib/QuizAttempt";
import { POST as getQuiz } from "../src/app/api/quiz/getquiz/route";
import { POST as selectOption } from "../src/app/api/quiz/selectoption/route";
import { POST as submit } from "../src/app/api/quiz/submit/route";
import { POST as retake } from "../src/app/api/quiz/retake/route";
import { POST as createLive } from "../src/app/api/livequiz/create/route";
import { migrateQuizAttempts } from "../scripts/migrate-quiz-attempts.mjs";
import { SESSION_COOKIE } from "../src/app/api/utils/session";
import { STUDENT_A, STUDENT_B, json, post } from "./helpers";

let quizId: string;
let q1: string;
let q2: string;

async function makeQuiz(ownerId: string | null = STUDENT_A) {
  const quiz = await Quiz.create({
    userId: "test",
    ownerId,
    title: "Photosynthesis",
    questions: [
      { questionText: "Q1?", answers: [{ label: "A", option: "a" }, { label: "B", option: "b" }], correctAnswer: "B", explanation: "because B" },
      { questionText: "Q2?", answers: [{ label: "A", option: "a" }, { label: "B", option: "b" }], correctAnswer: "A", explanation: "because A" },
    ],
  });
  return quiz;
}

beforeAll(async () => {
  await connectDB();
  await QuizAttempt.syncIndexes();
});

beforeEach(async () => {
  await Quiz.deleteMany({});
  await QuizAttempt.deleteMany({});
  const quiz = await makeQuiz();
  quizId = String(quiz._id);
  q1 = String(quiz.questions[0]._id);
  q2 = String(quiz.questions[1]._id);
});

describe("quiz attempts are per student", () => {
  it("rejects requests without a valid session", async () => {
    expect((await getQuiz(post("/api/quiz/getquiz", { id: quizId }))).status).toBe(401);
    expect((await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "A" }))).status).toBe(401);
    // Forged / tampered cookie
    const forged = `${SESSION_COOKIE}=eyJ1aWQiOiJtczpzdHVkZW50LWEtMDAwMCIsImV4cCI6OTk5OTk5OTk5OX0.bad-signature`;
    expect((await getQuiz(post("/api/quiz/getquiz", { id: quizId }, { cookie: forged }))).status).toBe(401);
  });

  it("keeps two students' attempts on the same quiz independent", async () => {
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "B" }, { uid: STUDENT_A }));
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "A" }, { uid: STUDENT_B }));
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q2, choosenAnswer: "A" }, { uid: STUDENT_B }));

    const a = await json(await getQuiz(post("/api/quiz/getquiz", { id: quizId }, { uid: STUDENT_A })));
    const b = await json(await getQuiz(post("/api/quiz/getquiz", { id: quizId }, { uid: STUDENT_B })));
    expect(a.body.quiz.questions.map((q: any) => q.choosenAnswer)).toEqual(["B", ""]);
    expect(b.body.quiz.questions.map((q: any) => q.choosenAnswer)).toEqual(["A", "A"]);
    expect(await QuizAttempt.countDocuments({ quizId })).toBe(2);

    // The shared quiz document holds no answers at all.
    const raw: any = await Quiz.findById(quizId).lean();
    expect(raw.questions.every((q: any) => !q.choosenAnswer)).toBe(true);
  });

  it("ignores any identity sent by the browser and never lets B modify A's attempt", async () => {
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "B" }, { uid: STUDENT_A }));
    // B tries to write while claiming to be A in the body.
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "A", ownerId: STUDENT_A, userID: STUDENT_A }, { uid: STUDENT_B }));
    const attemptA: any = await QuizAttempt.findOne({ quizId, ownerId: STUDENT_A }).lean();
    expect(attemptA.answers.get ? attemptA.answers.get(q1) : attemptA.answers[q1]).toBe("B");
    const b = await json(await getQuiz(post("/api/quiz/getquiz", { id: quizId, ownerId: STUDENT_A }, { uid: STUDENT_B })));
    expect(b.body.quiz.questions[0].choosenAnswer).toBe("A"); // B sees only B's own answer
  });

  it("hides correct answers until that student submits", async () => {
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "B" }, { uid: STUDENT_A }));
    const before = await json(await getQuiz(post("/api/quiz/getquiz", { id: quizId }, { uid: STUDENT_A })));
    expect(before.body.quiz.questions[0].correctAnswer).toBeUndefined();
    expect(before.body.quiz.questions[0].explanation).toBeUndefined();

    const sub = await json(await submit(post("/api/quiz/submit", { quizid: quizId }, { uid: STUDENT_A })));
    expect(sub.body.attempt).toMatchObject({ status: "submitted", score: 1, total: 2 });
    expect(sub.body.quiz.questions[0].correctAnswer).toBe("B");

    // B has not submitted: still no answer key for B.
    const b = await json(await getQuiz(post("/api/quiz/getquiz", { id: quizId }, { uid: STUDENT_B })));
    expect(b.body.quiz.questions[0].correctAnswer).toBeUndefined();

    // A cannot change answers after submitting without starting a retake.
    const locked = await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "A" }, { uid: STUDENT_A }));
    expect(locked.status).toBe(409);
    const submitted: any = await QuizAttempt.findOne({ quizId, ownerId: STUDENT_A, status: "submitted" }).lean();
    expect(submitted.score).toBe(1);
  });

  it("supports repeatable tests: a retake starts fresh and keeps the old submission", async () => {
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "B" }, { uid: STUDENT_A }));
    await submit(post("/api/quiz/submit", { quizid: quizId }, { uid: STUDENT_A }));
    const fresh = await json(await retake(post("/api/quiz/retake", { quizid: quizId }, { uid: STUDENT_A })));
    expect(fresh.body.quiz.questions[0].choosenAnswer).toBe("");
    await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q2, choosenAnswer: "A" }, { uid: STUDENT_A }));
    expect(await QuizAttempt.countDocuments({ quizId, ownerId: STUDENT_A })).toBe(2);
  });

  it("validates question ids and answer labels", async () => {
    const other = await makeQuiz();
    const res1 = await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: String(other.questions[0]._id), choosenAnswer: "A" }, { uid: STUDENT_A }));
    expect(res1.status).toBe(400);
    const res2 = await selectOption(post("/api/quiz/selectoption", { quizid: quizId, questionId: q1, choosenAnswer: "Z" }, { uid: STUDENT_A }));
    expect(res2.status).toBe(400);
    const res3 = await getQuiz(post("/api/quiz/getquiz", { id: "not-an-id" }, { uid: STUDENT_A }));
    expect(res3.status).toBe(400);
  });

  it("only the quiz's creator can host it live (host sees the answer key)", async () => {
    const asB = await createLive(post("/api/livequiz/create", { quizId }, { uid: STUDENT_B }));
    expect(asB.status).toBe(403);
    const anon = await createLive(post("/api/livequiz/create", { quizId }));
    expect(anon.status).toBe(403);
    const asA = await createLive(post("/api/livequiz/create", { quizId }, { uid: STUDENT_A }));
    expect(asA.status).toBe(201);
  });
});

describe("migration of legacy shared answers", () => {
  it("archives old answers into owner-less attempts, clears the quiz, and is idempotent", async () => {
    const legacy = await Quiz.create({
      userId: "demo",
      title: "Legacy",
      questions: [
        { questionText: "L1", answers: [{ label: "A", option: "a" }, { label: "B", option: "b" }], correctAnswer: "A", choosenAnswer: "A" },
        { questionText: "L2", answers: [{ label: "A", option: "a" }, { label: "B", option: "b" }], correctAnswer: "A", choosenAnswer: "B" },
      ],
    });
    // A quiz whose questions have no saved answer (field missing or empty) must not be touched.
    await Quiz.collection.insertOne({
      userId: "demo",
      title: "Never answered",
      questions: [{ questionText: "N1", answers: [{ label: "A", option: "a" }], correctAnswer: "A" }, { questionText: "N2", answers: [], choosenAnswer: "" }],
    } as any);
    const db = mongoose.connection.db!;

    const dry = await migrateQuizAttempts(db, { dryRun: true, log: () => {} });
    expect(dry.withAnswers).toBe(1);
    expect(await QuizAttempt.countDocuments({ legacy: true })).toBe(0); // dry run writes nothing

    const report = await migrateQuizAttempts(db, { log: () => {} });
    expect(report).toMatchObject({ withAnswers: 1, migrated: 1, cleared: 1 });
    const archived: any = await QuizAttempt.findOne({ quizId: legacy._id, legacy: true }).lean();
    expect(archived.ownerId).toBeNull();
    expect(archived.score).toBe(1);
    expect(Object.keys(archived.answers instanceof Map ? Object.fromEntries(archived.answers) : archived.answers)).toHaveLength(2);
    const after: any = await Quiz.findById(legacy._id).lean();
    expect(after.questions.every((q: any) => q.choosenAnswer === undefined)).toBe(true);

    // No student can see the archived answers.
    const view = await json(await getQuiz(post("/api/quiz/getquiz", { id: String(legacy._id) }, { uid: STUDENT_A })));
    expect(view.body.quiz.questions.map((q: any) => q.choosenAnswer)).toEqual(["", ""]);

    const again = await migrateQuizAttempts(db, { log: () => {} });
    expect(again.withAnswers).toBe(0);
    expect(await QuizAttempt.countDocuments({ legacy: true })).toBe(1);
  });
});
