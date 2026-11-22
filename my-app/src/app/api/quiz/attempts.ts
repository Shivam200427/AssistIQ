import { isValidObjectId } from "mongoose";
import Quiz from "../lib/Quiz";
import QuizAttempt from "../lib/QuizAttempt";
import { mistakesOf, nextReviewDays, topicStats } from "./learning";

/**
 * Quiz access rules
 * - A quiz's questions can be opened by any signed-in student who has its link (quizzes are shareable).
 * - Answers are stored per student in QuizAttempt; a student can only ever read or write their own attempt.
 * - Correct answers and explanations are only returned to a student after they submit their own attempt.
 */

export class QuizError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function loadQuiz(quizId: unknown) {
  if (typeof quizId !== "string" || !isValidObjectId(quizId)) throw new QuizError(400, "Invalid quiz id");
  const quiz: any = await Quiz.findById(quizId).lean();
  if (!quiz) throw new QuizError(404, "Quiz not found");
  return quiz;
}

function answersToObject(map: any): Record<string, string> {
  if (!map) return {};
  return map instanceof Map ? Object.fromEntries(map) : { ...map };
}

/** The current attempt: the open one if any, otherwise the most recent submitted one. */
async function currentAttempt(quizId: string, uid: string) {
  const open: any = await QuizAttempt.findOne({ quizId, ownerId: uid, status: "in_progress" }).lean();
  if (open) return open;
  return QuizAttempt.findOne({ quizId, ownerId: uid, status: "submitted" }).sort({ submittedAt: -1 }).lean();
}

function score(quiz: any, answers: Record<string, string>) {
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q: any) => {
    const chosen = answers[String(q._id)];
    return chosen && q.correctAnswer && chosen.toUpperCase() === String(q.correctAnswer).toUpperCase();
  }).length;
  return { score: correct, total };
}

export function studentView(quiz: any, attempt: any, passes = 0) {
  const answers = answersToObject(attempt?.answers);
  const submitted = attempt?.status === "submitted";
  const total = (quiz.questions || []).length;
  return {
    quiz: {
      _id: String(quiz._id),
      title: quiz.title,
      source: quiz.source || "topic",
      sourceNote: quiz.sourceNote || "",
      documentId: quiz.documentId || null,
      isOwner: false,
      createdAt: quiz.createdAt,
      questions: (quiz.questions || []).map((q: any) => ({
        _id: String(q._id),
        questionText: q.questionText,
        answers: (q.answers || []).map((a: any) => ({ label: a.label, option: a.option })),
        choosenAnswer: answers[String(q._id)] || "",
        topic: q.topic || "",
        // Only after this student has submitted:
        ...(submitted ? { correctAnswer: q.correctAnswer, explanation: q.explanation || "" } : {}),
      })),
    },
    attempt: attempt
      ? {
          _id: String(attempt._id),
          status: attempt.status,
          score: attempt.score,
          total: attempt.total,
          submittedAt: attempt.submittedAt,
        }
      : null,
    // Only after submitting: what to revise next and when to re-quiz.
    insights: submitted
      ? {
          topics: topicStats(quiz, answers),
          mistakes: mistakesOf(quiz, answers).length,
          nextReviewDays: nextReviewDays(total ? (attempt.score || 0) / total : 0, passes),
        }
      : null,
  };
}

/** Earlier submitted attempts of this quiz that scored >= 80% (drives the spaced re-quiz interval). */
async function countPasses(quizId: any, uid: string, excludeId?: any) {
  const rows: any[] = await QuizAttempt.find({ quizId, ownerId: uid, status: "submitted", ...(excludeId ? { _id: { $ne: excludeId } } : {}) }, { score: 1, total: 1 }).lean();
  return rows.filter((r) => r.total && r.score / r.total >= 0.8).length;
}

/** The caller's mistakes across their latest submitted attempt of each quiz. */
export async function listMistakes(uid: string) {
  const attempts: any[] = await QuizAttempt.find({ ownerId: uid, status: "submitted" }).sort({ submittedAt: -1 }).lean();
  const latest = new Map<string, any>();
  for (const a of attempts) if (!latest.has(String(a.quizId))) latest.set(String(a.quizId), a);
  const quizzes: any[] = await Quiz.find({ _id: { $in: [...latest.keys()] } }).lean();
  const items = [];
  for (const quiz of quizzes) {
    const attempt = latest.get(String(quiz._id));
    for (const m of mistakesOf(quiz, answersToObject(attempt.answers))) {
      items.push({ ...m, quizId: String(quiz._id), quizTitle: quiz.title, attemptedAt: attempt.submittedAt });
    }
  }
  items.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());
  return { mistakes: items };
}

export async function getQuizForStudent(quizId: unknown, uid: string) {
  const quiz = await loadQuiz(quizId);
  const attempt: any = await currentAttempt(String(quiz._id), uid);
  const view = studentView(quiz, attempt, attempt?.status === "submitted" ? await countPasses(quiz._id, uid, attempt._id) : 0);
  view.quiz.isOwner = !!quiz.ownerId && quiz.ownerId === uid;
  return view;
}

export async function recordAnswer(quizId: unknown, questionId: unknown, label: unknown, uid: string) {
  const quiz = await loadQuiz(quizId);
  if (typeof questionId !== "string") throw new QuizError(400, "Invalid question id");
  const question = quiz.questions.find((q: any) => String(q._id) === questionId);
  if (!question) throw new QuizError(400, "Question does not belong to this quiz");
  const chosen = typeof label === "string" ? label.trim().toUpperCase() : "";
  if (!question.answers.some((a: any) => String(a.label).toUpperCase() === chosen)) {
    throw new QuizError(400, "Invalid answer option");
  }

  // After submitting, answers are locked until the student explicitly starts a retake.
  const open = await QuizAttempt.exists({ quizId: quiz._id, ownerId: uid, status: "in_progress" });
  if (!open && (await QuizAttempt.exists({ quizId: quiz._id, ownerId: uid, status: "submitted" }))) {
    throw new QuizError(409, "You already submitted this quiz. Start a retake to answer again.");
  }

  // Upsert only the caller's own open attempt; the unique index guarantees one per student.
  try {
    const attempt = await QuizAttempt.findOneAndUpdate(
      { quizId: quiz._id, ownerId: uid, status: "in_progress" },
      { $set: { [`answers.${questionId}`]: chosen }, $setOnInsert: { quizId: quiz._id, ownerId: uid, status: "in_progress" } },
      { upsert: true, new: true }
    ).lean();
    return attempt;
  } catch (e: any) {
    if (e?.code === 11000) {
      // Two first answers raced; the other request created the attempt — apply to it.
      return QuizAttempt.findOneAndUpdate(
        { quizId: quiz._id, ownerId: uid, status: "in_progress" },
        { $set: { [`answers.${questionId}`]: chosen } },
        { new: true }
      ).lean();
    }
    throw e;
  }
}

export async function submitAttempt(quizId: unknown, uid: string) {
  const quiz = await loadQuiz(quizId);
  const open: any = await QuizAttempt.findOne({ quizId: quiz._id, ownerId: uid, status: "in_progress" }).lean();
  const answers = answersToObject(open?.answers);
  const { score: correct, total } = score(quiz, answers);
  let attempt: any;
  if (open) {
    attempt = await QuizAttempt.findOneAndUpdate(
      { _id: open._id, ownerId: uid, status: "in_progress" },
      { $set: { status: "submitted", score: correct, total, submittedAt: new Date() } },
      { new: true }
    ).lean();
  } else {
    // Submitting without answering anything still records a (zero) attempt.
    attempt = (await QuizAttempt.create({ quizId: quiz._id, ownerId: uid, status: "submitted", answers: {}, score: correct, total, submittedAt: new Date() })).toObject();
  }
  if (!attempt) throw new QuizError(409, "Attempt was already submitted");
  return studentView(quiz, attempt, await countPasses(quiz._id, uid, attempt._id));
}

/** Retake: opens a fresh attempt for the caller. Earlier submitted attempts are kept for history. */
export async function startRetake(quizId: unknown, uid: string) {
  const quiz = await loadQuiz(quizId);
  let attempt: any = await QuizAttempt.findOneAndUpdate(
    { quizId: quiz._id, ownerId: uid, status: "in_progress" },
    { $set: { answers: {} }, $setOnInsert: { quizId: quiz._id, ownerId: uid, status: "in_progress" } },
    { upsert: true, new: true }
  ).lean();
  return studentView(quiz, attempt);
}
