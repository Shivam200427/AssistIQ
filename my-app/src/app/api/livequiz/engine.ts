import { createHash, randomBytes, timingSafeEqual } from "crypto";
import LiveGame from "../lib/LiveGame";
import { connectDB } from "../utils/db";

/**
 * Live quiz engine.
 *
 * MongoDB is the single source of truth: every read loads the game fresh and every change is one
 * atomic, conditional update. That keeps all serverless instances (e.g. on Vercel) in sync and
 * stops simultaneous answers from overwriting each other. Clients poll /state, so the SSE stream
 * is only a speed-up for clients that happen to share an instance with the request that changed
 * the game.
 */

export interface AnswerOption {
  label: string;
  option: string;
}

export interface LiveQuestion {
  _id?: string;
  questionText: string;
  answers: AnswerOption[];
  correctAnswer: string;
  explanation?: string;
  timeLimit: number;
  points: number;
}

export interface PlayerAnswer {
  questionIndex: number;
  chosenOption: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  pointsEarned: number;
}

export interface LivePlayer {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswer: PlayerAnswer | null;
  answersHistory: PlayerAnswer[];
  joinedAt: number;
  /** SHA-256 of the player's private token. Never sent to any client. */
  tokenHash?: string;
}

export type GameStatus = "LOBBY" | "QUESTION_ACTIVE" | "QUESTION_RESULT" | "LEADERBOARD" | "FINISHED";

export interface RoomState {
  pin: string;
  quizId?: string;
  title: string;
  hostId: string;
  hostToken: string;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartTime: number | null;
  questions: LiveQuestion[];
  players: LivePlayer[];
  answerDistribution: Record<string, number>;
  totalAnswered: number;
  startedAt: number | null;
  endedAt: number | null;
}

export type PublicRoomState = Omit<RoomState, "hostToken">;

const VALID_OPTIONS = ["A", "B", "C", "D"];
const MAX_PLAYERS = 200;
const MAX_QUESTIONS = 100;
const MAX_NICKNAME_LENGTH = 24;
// Small grace period for network latency when answers arrive right at the deadline.
const ANSWER_GRACE_SECONDS = 1.5;

// SSE subscribers connected to this server instance: pin -> (controller -> isHost)
const globalAny = global as any;
if (!globalAny.__LIVE_QUIZ_SSE_CLIENTS__) {
  globalAny.__LIVE_QUIZ_SSE_CLIENTS__ = new Map<string, Map<ReadableStreamDefaultController, boolean>>();
}
const sseClients: Map<string, Map<ReadableStreamDefaultController, boolean>> = globalAny.__LIVE_QUIZ_SSE_CLIENTS__;

export function normalizePin(pin: string): string {
  return String(pin || "").trim().toUpperCase();
}

export function generateHostToken(): string {
  return randomBytes(24).toString("hex");
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Checks a player's private token against the stored hash (constant-time). */
export function isPlayerTokenValid(player: LivePlayer | undefined, token: unknown): boolean {
  if (!player?.tokenHash || typeof token !== "string" || !token) return false;
  const a = Buffer.from(player.tokenHash);
  const b = Buffer.from(hashToken(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isHostTokenValid(room: RoomState | null, token: unknown): boolean {
  if (!room || !room.hostToken || typeof token !== "string" || !token) return false;
  const a = Buffer.from(room.hostToken);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

// Players must not see correct answers (or other players' results) before a question is revealed.
function isQuestionRevealed(room: RoomState, idx: number): boolean {
  if (room.status === "FINISHED") return true;
  if (room.status === "LOBBY") return false;
  if (idx < room.currentQuestionIndex) return true;
  if (idx > room.currentQuestionIndex) return false;
  return room.status !== "QUESTION_ACTIVE";
}

function trailingStreak(history: PlayerAnswer[]): number {
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].isCorrect; i--) streak++;
  return streak;
}

/**
 * Returns the room as a given viewer is allowed to see it.
 * The host gets everything except the host token; players get answers hidden until revealed.
 */
export function viewRoom(room: RoomState | null, asHost = false): PublicRoomState | null {
  if (!room) return null;
  const { hostToken: _hostToken, ...withPlayers } = room;
  // Player token hashes are never sent to anyone, including the host.
  const rest = { ...withPlayers, players: room.players.map(({ tokenHash: _t, ...p }) => p) };
  if (asHost) return rest;

  const hideCurrent = room.status === "QUESTION_ACTIVE";
  const currentIdx = room.currentQuestionIndex;

  return {
    ...rest,
    questions: room.questions.map((q, idx) =>
      isQuestionRevealed(room, idx) ? q : { ...q, correctAnswer: "", explanation: "" }
    ),
    players: rest.players.map((p) => {
      if (!hideCurrent) return p;
      const history = p.answersHistory.filter((a) => a.questionIndex !== currentIdx);
      const current = p.answersHistory.find((a) => a.questionIndex === currentIdx);
      return {
        ...p,
        score: p.score - (current?.pointsEarned || 0),
        streak: current ? trailingStreak(history) : p.streak,
        lastAnswer: p.lastAnswer && p.lastAnswer.questionIndex === currentIdx ? null : p.lastAnswer,
        answersHistory: history,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// SSE (same-instance fast path)
// ---------------------------------------------------------------------------

// Broadcast an SSE event to this instance's subscribers. `payload.room` is filtered per subscriber.
export function broadcastToRoom(pin: string, type: string, payload: any) {
  const subscribers = sseClients.get(pin);
  if (!subscribers || subscribers.size === 0) return;

  const encoder = new TextEncoder();
  const encodeFor = (asHost: boolean) => {
    const data = payload?.room ? { ...payload, room: viewRoom(payload.room, asHost) } : payload;
    return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const hostBytes = encodeFor(true);
  const playerBytes = encodeFor(false);

  subscribers.forEach((asHost, controller) => {
    try {
      controller.enqueue(asHost ? hostBytes : playerBytes);
    } catch (e) {
      // Subscriber disconnected, remove
      subscribers.delete(controller);
    }
  });
}

export function subscribeClient(pin: string, controller: ReadableStreamDefaultController, asHost = false) {
  if (!sseClients.has(pin)) {
    sseClients.set(pin, new Map());
  }
  sseClients.get(pin)!.set(controller, asHost);
}

export function unsubscribeClient(pin: string, controller: ReadableStreamDefaultController) {
  const subscribers = sseClients.get(pin);
  if (subscribers) {
    subscribers.delete(controller);
    if (subscribers.size === 0) sseClients.delete(pin);
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function computeDistribution(players: LivePlayer[], questionIndex: number): Record<string, number> {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  players.forEach((p) => {
    const answer = p.answersHistory.find((a) => a.questionIndex === questionIndex);
    if (answer?.chosenOption) {
      const opt = answer.chosenOption.toUpperCase();
      dist[opt] = (dist[opt] || 0) + 1;
    }
  });
  return dist;
}

function toTime(value: any): number | null {
  return value ? new Date(value).getTime() : null;
}

function docToRoom(doc: any): RoomState | null {
  if (!doc) return null;
  const status = doc.status as GameStatus;
  const players: LivePlayer[] = (doc.players || []).map((p: any) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    score: p.score || 0,
    streak: p.streak || 0,
    lastAnswer: p.lastAnswer || null,
    answersHistory: p.answersHistory || [],
    joinedAt: toTime(p.joinedAt) || 0,
    tokenHash: p.tokenHash || undefined,
  }));
  if (status === "LEADERBOARD" || status === "FINISHED") {
    players.sort((a, b) => b.score - a.score);
  }
  const currentQuestionIndex = doc.currentQuestionIndex || 0;
  const answerDistribution = computeDistribution(players, currentQuestionIndex);

  return {
    pin: doc.pin,
    quizId: doc.quizId,
    title: doc.title,
    hostId: doc.hostId,
    hostToken: doc.hostToken || "",
    status,
    currentQuestionIndex,
    questionStartTime: toTime(doc.questionStartTime),
    questions: (doc.questions || []).map((q: any) => ({
      _id: q._id?.toString(),
      questionText: q.questionText,
      answers: (q.answers || []).map((a: any) => ({ label: a.label, option: a.option })),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
      timeLimit: q.timeLimit || 15,
      points: q.points || 1000,
    })),
    players,
    answerDistribution,
    totalAnswered: Object.values(answerDistribution).reduce((a, b) => a + b, 0),
    startedAt: toTime(doc.startedAt),
    endedAt: toTime(doc.endedAt),
  };
}

/** Applies an update only if `conditions` still hold; returns the updated room or null. */
async function atomicUpdate(pin: string, conditions: Record<string, any>, update: Record<string, any>) {
  await connectDB();
  const doc = await LiveGame.findOneAndUpdate({ pin: normalizePin(pin), ...conditions }, update, {
    new: true,
  }).lean();
  return docToRoom(doc);
}

function sanitizeQuestions(questions: any[]): LiveQuestion[] {
  return questions.slice(0, MAX_QUESTIONS).map((q: any, idx: number) => {
    const answers: AnswerOption[] = (Array.isArray(q?.answers) ? q.answers : [])
      .slice(0, VALID_OPTIONS.length)
      .map((a: any, aIdx: number) => ({
        label: VALID_OPTIONS[aIdx],
        option: String(a?.option ?? "").slice(0, 500),
      }));
    const correct = String(q?.correctAnswer || "A").trim().toUpperCase();
    const timeLimit = Math.round(Number(q?.timeLimit) || 15);
    const points = Math.round(Number(q?.points) || 1000);
    return {
      _id: q?._id ? String(q._id) : `q-${idx + 1}`,
      questionText: String(q?.questionText || `Question ${idx + 1}`).slice(0, 1000),
      answers,
      correctAnswer: VALID_OPTIONS.includes(correct) ? correct : "A",
      explanation: String(q?.explanation || "").slice(0, 2000),
      timeLimit: Math.min(Math.max(timeLimit, 5), 120),
      points: Math.min(Math.max(points, 100), 5000),
    };
  });
}

// ---------------------------------------------------------------------------
// Game operations
// ---------------------------------------------------------------------------

export async function getRoom(pin: string): Promise<RoomState | null> {
  const normalizedPin = normalizePin(pin);
  if (!normalizedPin) return null;
  try {
    await connectDB();
    return docToRoom(await LiveGame.findOne({ pin: normalizedPin }).lean());
  } catch (err: any) {
    console.error("[LiveQuiz Engine] Load room error:", err.message);
    return null;
  }
}

export async function roomExists(pin: string): Promise<boolean> {
  await connectDB();
  return (await LiveGame.exists({ pin: normalizePin(pin) })) !== null;
}

export async function createRoom(params: {
  pin: string;
  quizId?: string;
  title: string;
  hostId?: string;
  questions: LiveQuestion[];
}): Promise<RoomState> {
  await connectDB();
  const doc = await LiveGame.create({
    pin: normalizePin(params.pin),
    quizId: params.quizId,
    title: String(params.title || "Live Arena Battle").slice(0, 200),
    hostId: params.hostId || "host",
    hostToken: generateHostToken(),
    status: "LOBBY",
    currentQuestionIndex: 0,
    questionStartTime: null,
    questions: sanitizeQuestions(params.questions),
    players: [],
  });
  return docToRoom(doc.toObject())!;
}

export type JoinResult =
  | { ok: true; room: RoomState; playerId: string; playerToken?: string }
  | { ok: false; status: number; error: string };

/**
 * Joins a player. A brand-new player gets a server-generated id and a private token (returned once).
 * Rejoining with an existing player id requires that player's token — so nobody can take over another
 * player's identity, in the lobby or mid-game.
 */
export async function joinPlayer(
  pin: string,
  player: { id?: string; nickname: string; avatar: string; token?: string }
): Promise<JoinResult> {
  const nickname = String(player.nickname || "").trim().slice(0, MAX_NICKNAME_LENGTH);
  const avatar = String(player.avatar || "⚡").slice(0, 8);
  if (!nickname) return { ok: false, status: 400, error: "Nickname is required" };

  const current = await getRoom(pin);
  if (!current) return { ok: false, status: 404, error: "Game room not found" };

  const requestedId = typeof player.id === "string" ? player.id.slice(0, 64) : "";
  const existing = requestedId ? current.players.find((p) => p.id === requestedId) : undefined;

  if (existing) {
    if (!isPlayerTokenValid(existing, player.token)) {
      return { ok: false, status: 403, error: "That player belongs to someone else. Join with a new nickname." };
    }
    const room = await atomicUpdate(
      pin,
      { "players.id": existing.id },
      { $set: { "players.$.nickname": nickname, "players.$.avatar": avatar } }
    );
    if (!room) return { ok: false, status: 409, error: "Could not rejoin, please try again." };
    broadcastToRoom(room.pin, "ROOM_UPDATED", { room });
    return { ok: true, room, playerId: existing.id };
  }

  // New player: never trust a client-chosen id.
  const id = `p-${randomBytes(9).toString("hex")}`;
  const token = randomBytes(24).toString("hex");
  const room = await atomicUpdate(
    pin,
    { [`players.${MAX_PLAYERS - 1}`]: { $exists: false } },
    {
      $push: {
        players: {
          id,
          nickname,
          avatar,
          score: 0,
          streak: 0,
          lastAnswer: null,
          answersHistory: [],
          joinedAt: new Date(),
          tokenHash: hashToken(token),
        },
      },
    }
  );
  if (!room) return { ok: false, status: 409, error: "This game is full." };
  broadcastToRoom(room.pin, "ROOM_UPDATED", { room });
  return { ok: true, room, playerId: id, playerToken: token };
}

export async function submitAnswer(
  pin: string,
  playerId: string,
  chosenOption: string,
  playerToken?: string
): Promise<{ success: boolean; room: RoomState | null; answerResult?: PlayerAnswer; forbidden?: boolean }> {
  const room = await getRoom(pin);
  if (!room || room.status !== "QUESTION_ACTIVE") {
    return { success: false, room };
  }

  const questionIndex = room.currentQuestionIndex;
  const player = room.players.find((p) => p.id === playerId);
  const currentQ = room.questions[questionIndex];
  if (!player || !currentQ) return { success: false, room };
  // Only the real player (holder of the private token) can answer for this player id.
  if (!isPlayerTokenValid(player, playerToken)) return { success: false, room, forbidden: true };

  if (player.answersHistory.some((a) => a.questionIndex === questionIndex)) {
    return { success: false, room };
  }

  const normalizedChosen = String(chosenOption || "").trim().toUpperCase();
  if (!VALID_OPTIONS.includes(normalizedChosen)) {
    return { success: false, room };
  }

  // Time is measured on the server so clients cannot claim instant answers.
  const timeLimit = currentQ.timeLimit || 15;
  const startedAt = room.questionStartTime || Date.now();
  const timeTakenSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
  if (timeTakenSeconds > timeLimit + ANSWER_GRACE_SECONDS) {
    return { success: false, room };
  }

  const isCorrect = normalizedChosen === currentQ.correctAnswer.toUpperCase();

  // Score: 50% base + up to 50% speed bonus, plus a streak bonus
  let pointsEarned = 0;
  if (isCorrect) {
    const speedRatio = Math.min(1, Math.max(0, 1 - timeTakenSeconds / timeLimit));
    pointsEarned = Math.round(currentQ.points * (0.5 + 0.5 * speedRatio)) + Math.min(player.streak * 50, 250);
  }

  const answerRecord: PlayerAnswer = {
    questionIndex,
    chosenOption: normalizedChosen,
    isCorrect,
    timeTakenSeconds: Math.round(Math.min(timeTakenSeconds, timeLimit) * 10) / 10,
    pointsEarned,
  };

  // Only applies while this question is still active and this player has not answered it yet,
  // so double submits and answers racing a "next question" are rejected atomically.
  const updated = await atomicUpdate(
    pin,
    {
      status: "QUESTION_ACTIVE",
      currentQuestionIndex: questionIndex,
      players: { $elemMatch: { id: playerId, "answersHistory.questionIndex": { $ne: questionIndex } } },
    },
    {
      $inc: { "players.$.score": pointsEarned },
      $set: { "players.$.streak": isCorrect ? player.streak + 1 : 0, "players.$.lastAnswer": answerRecord },
      $push: { "players.$.answersHistory": answerRecord },
    }
  );
  if (!updated) {
    return { success: false, room: await getRoom(pin) };
  }

  broadcastToRoom(updated.pin, "PLAYER_ANSWERED", {
    playerId,
    totalAnswered: updated.totalAnswered,
    totalPlayers: updated.players.length,
    answerDistribution: updated.answerDistribution,
  });

  // If everyone has answered, end the question right away
  if (updated.players.length > 0 && updated.totalAnswered >= updated.players.length) {
    const ended = await endQuestion(updated.pin);
    return { success: true, room: ended || updated, answerResult: answerRecord };
  }

  return { success: true, room: updated, answerResult: answerRecord };
}

export async function startGame(pin: string): Promise<RoomState | null> {
  const now = new Date();
  const room = await atomicUpdate(
    pin,
    { status: "LOBBY", "questions.0": { $exists: true } },
    {
      $set: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: 0,
        questionStartTime: now,
        startedAt: now,
        "players.$[].score": 0,
        "players.$[].streak": 0,
        "players.$[].lastAnswer": null,
        "players.$[].answersHistory": [],
      },
    }
  );
  if (room) broadcastToRoom(room.pin, "QUESTION_START", { room });
  return room;
}

export async function endQuestion(pin: string): Promise<RoomState | null> {
  const room = await atomicUpdate(pin, { status: "QUESTION_ACTIVE" }, { $set: { status: "QUESTION_RESULT" } });
  if (room) {
    broadcastToRoom(room.pin, "QUESTION_RESULT", { room });
    return room;
  }
  // Idempotent: the host timer and the "everyone answered" path may both end the question.
  return getRoom(pin);
}

export async function showLeaderboard(pin: string): Promise<RoomState | null> {
  const room = await atomicUpdate(
    pin,
    { status: { $in: ["QUESTION_RESULT", "LEADERBOARD", "FINISHED"] } },
    { $set: { status: "LEADERBOARD" } }
  );
  if (room) broadcastToRoom(room.pin, "SHOW_LEADERBOARD", { room });
  return room;
}

export async function nextQuestion(pin: string): Promise<RoomState | null> {
  const current = await getRoom(pin);
  if (!current || current.status === "LOBBY" || current.status === "FINISHED") return null;

  const nextIdx = current.currentQuestionIndex + 1;
  // Conditioned on the current index so a double click cannot skip two questions.
  const guard = { status: current.status, currentQuestionIndex: current.currentQuestionIndex };

  if (nextIdx < current.questions.length) {
    const room = await atomicUpdate(pin, guard, {
      $set: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: nextIdx,
        questionStartTime: new Date(),
        "players.$[].lastAnswer": null,
      },
    });
    if (room) broadcastToRoom(room.pin, "QUESTION_START", { room });
    return room || getRoom(pin);
  }

  const room = await atomicUpdate(pin, guard, { $set: { status: "FINISHED", endedAt: new Date() } });
  if (room) broadcastToRoom(room.pin, "GAME_FINISHED", { room });
  return room || getRoom(pin);
}

export async function updateQuestions(pin: string, questions: LiveQuestion[]): Promise<RoomState | null> {
  const room = await atomicUpdate(pin, { status: "LOBBY" }, { $set: { questions: sanitizeQuestions(questions) } });
  if (room) broadcastToRoom(room.pin, "ROOM_UPDATED", { room });
  return room;
}
