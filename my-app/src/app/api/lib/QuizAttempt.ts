import mongoose from "mongoose";

/**
 * One student's attempt at one quiz. Answers never live on the shared Quiz document.
 * - ownerId: verified student id from the session ("ms:<id>"), or null for archived legacy answers.
 * - At most one in-progress attempt per (quiz, student); submitted attempts are kept, so tests can be retaken.
 */
const QuizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    ownerId: { type: String, default: null, index: true },
    status: { type: String, enum: ["in_progress", "submitted", "legacy"], default: "in_progress" },
    // questionId -> chosen label ("A".."D")
    answers: { type: Map, of: String, default: {} },
    score: { type: Number, default: null },
    total: { type: Number, default: null },
    submittedAt: { type: Date, default: null },
    legacy: { type: Boolean, default: false },
  },
  { timestamps: true }
);

QuizAttemptSchema.index(
  { quizId: 1, ownerId: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" }, name: "one_open_attempt_per_student" }
);

const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", QuizAttemptSchema);
export default QuizAttempt;
