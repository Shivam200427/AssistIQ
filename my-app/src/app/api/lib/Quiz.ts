import mongoose from "mongoose"

const AnswerOptionSchema = new mongoose.Schema({
  option: { type: String, required: true },
  label: { type: String, required: true }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  answers: {
    type: [AnswerOptionSchema],
    required: true,
  },
  correctAnswer: { type: String, required: false },
  // Legacy only: answers used to be stored here, shared by everyone. They now live in QuizAttempt;
  // the field is kept so the migration can read old documents.
  choosenAnswer: { type: String, required: false },
  explanation: { type: String, default: "" },
  topic: { type: String, default: "" } // short concept label, used for weak-topic analysis
}, { _id: true });


const QuizSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // legacy creator label ("demo")
  ownerId: { type: String, default: null, index: true }, // verified creator ("ms:<id>"); null for legacy quizzes
  title: { type: String, required: true },
  s3PdfKey: { type: String, required: false },
  documentId: { type: String, default: null }, // PDF Notes document this quiz was written from
  source: { type: String, enum: ["document", "topic", "topic_fallback"], default: "topic" },
  sourceNote: { type: String, default: "" },
  questions: {
    type: [QuestionSchema],
    required: false,
  }
}, { timestamps: true });

const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema);
export default Quiz;
