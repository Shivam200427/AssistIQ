import mongoose from "mongoose";

const AnswerOptionSchema = new mongoose.Schema({
  option: { type: String, required: true },
  label: { type: String, required: true },
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  _id: { type: String, required: false },
  questionText: { type: String, required: true },
  answers: { type: [AnswerOptionSchema], required: true },
  correctAnswer: { type: String, required: true },
  explanation: { type: String, default: "" },
  timeLimit: { type: Number, default: 15 },
  points: { type: Number, default: 1000 },
}, { _id: false });

const PlayerAnswerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  chosenOption: { type: String, default: "" },
  isCorrect: { type: Boolean, default: false },
  timeTakenSeconds: { type: Number, default: 0 },
  pointsEarned: { type: Number, default: 0 },
}, { _id: false });

const PlayerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  nickname: { type: String, required: true },
  avatar: { type: String, default: "⚡" },
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastAnswer: { type: PlayerAnswerSchema, default: null },
  answersHistory: { type: [PlayerAnswerSchema], default: [] },
  joinedAt: { type: Date, default: Date.now },
  tokenHash: { type: String, default: null },
}, { _id: false });

const LiveGameSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true, index: true },
  quizId: { type: String, required: false },
  title: { type: String, required: true },
  hostId: { type: String, default: "host" },
  hostToken: { type: String, default: "" },
  status: {
    type: String,
    enum: ["LOBBY", "QUESTION_ACTIVE", "QUESTION_RESULT", "LEADERBOARD", "FINISHED"],
    default: "LOBBY",
  },
  currentQuestionIndex: { type: Number, default: 0 },
  questionStartTime: { type: Date, default: null },
  questions: { type: [QuestionSchema], default: [] },
  players: { type: [PlayerSchema], default: [] },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
}, { timestamps: true });

delete mongoose.models.LiveGame;
const LiveGame = mongoose.models.LiveGame || mongoose.model("LiveGame", LiveGameSchema);
export default LiveGame;
