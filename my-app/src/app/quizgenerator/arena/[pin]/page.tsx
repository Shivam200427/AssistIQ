"use client";
import React, { useEffect, useState, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Crown,
  Medal,
  Clock,
  Users,
  Copy,
  Check,
  Play,
  ArrowRight,
  Maximize2,
  Minimize2,
  LogOut,
  Edit,
  Trash2,
  Plus,
  BarChart3,
  QrCode,
  History as HistoryIcon,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Flame,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import axios from "axios";
import Back from "../../../components/Back";

interface AnswerOption {
  label: string;
  option: string;
}

interface Question {
  _id?: string;
  questionText: string;
  answers: AnswerOption[];
  correctAnswer: string;
  explanation?: string;
  timeLimit: number;
  points: number;
}

interface PlayerAnswer {
  questionIndex: number;
  chosenOption: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  pointsEarned: number;
}

interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswer: PlayerAnswer | null;
  answersHistory: PlayerAnswer[];
  joinedAt: number;
}

interface RoomState {
  pin: string;
  quizId?: string;
  title: string;
  hostId: string;
  status: "LOBBY" | "QUESTION_ACTIVE" | "QUESTION_RESULT" | "LEADERBOARD" | "FINISHED";
  currentQuestionIndex: number;
  questionStartTime: number | null;
  questions: Question[];
  players: Player[];
  answerDistribution: Record<string, number>;
  totalAnswered: number;
  startedAt: number | null;
  endedAt: number | null;
}

const OPTION_COLORS = [
  { bg: "from-purple-600 to-indigo-700", border: "border-purple-400", light: "bg-purple-500/20", label: "A" },
  { bg: "from-blue-600 to-cyan-700", border: "border-cyan-400", light: "bg-blue-500/20", label: "B" },
  { bg: "from-rose-600 to-red-700", border: "border-rose-400", light: "bg-rose-500/20", label: "C" },
  { bg: "from-amber-500 to-orange-600", border: "border-amber-400", light: "bg-amber-500/20", label: "D" },
];

export default function ArenaPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin: rawPin } = use(params);
  const pin = rawPin.trim().toUpperCase();

  const router = useRouter();
  const searchParams = useSearchParams();
  const isHostQuery = searchParams.get("role") === "host";
  // Host privileges are proven by the token issued when the arena was created, not by the URL.
  const [hostToken] = useState<string>(() => {
    if (!isHostQuery || typeof window === "undefined") return "";
    try {
      return localStorage.getItem(`livequiz_host_token_${pin}`) || "";
    } catch {
      return "";
    }
  });
  const hostHeaders = hostToken ? { "x-host-token": hostToken } : undefined;

  const [room, setRoom] = useState<RoomState | null>(null);
  const isHost = Boolean(hostToken);
  const [activeTab, setActiveTab] = useState<"questions" | "host_qr" | "control" | "history">("host_qr");
  
  // Player state
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [myNickname, setMyNickname] = useState<string>("");
  const [myAvatar, setMyAvatar] = useState<string>("⚡");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [lockedIn, setLockedIn] = useState<boolean>(false);
  const [answerTime, setAnswerTime] = useState<number>(0);

  // Timers and UI
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyGames, setHistoryGames] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit/Add Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [qText, setQText] = useState("");
  const [qOptions, setQOptions] = useState<string[]>(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState("A");
  const [qTimeLimit, setQTimeLimit] = useState(15);

  const timerRef = useRef<any>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Initialize player info from sessionStorage
  useEffect(() => {
    if (!isHost) {
      const pid = sessionStorage.getItem("livequiz_player_id");
      const nick = sessionStorage.getItem("livequiz_player_nickname");
      const av = sessionStorage.getItem("livequiz_player_avatar") || "⚡";
      if (pid && nick) {
        setMyPlayerId(pid);
        setMyNickname(nick);
        setMyAvatar(av);
      } else {
        router.push(`/quizgenerator/join?pin=${pin}`);
      }
    }
  }, [isHost, pin, router]);

  // Generate QR Code URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const joinUrl = `${window.location.origin}/quizgenerator/join?pin=${pin}`;
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#0ea5e9", light: "#070a12" },
      }).then((url: string) => setQrCodeUrl(url)).catch(console.error);
    }
  }, [pin]);

  // Fetch initial room state
  const fetchRoomState = async () => {
    try {
      const res = await axios.get(`/api/livequiz/${pin}/state`, { headers: hostHeaders });
      if (res.data?.success) {
        setRoom(res.data.room);
      }
    } catch (err: any) {
      console.error("Fetch room error:", err.message);
    }
  };

  // Setup Server-Sent Events (SSE) listener
  useEffect(() => {
    fetchRoomState();

    const streamUrl = hostToken
      ? `/api/livequiz/${pin}/stream?hostToken=${encodeURIComponent(hostToken)}`
      : `/api/livequiz/${pin}/stream`;
    const sse = new EventSource(streamUrl);
    sseRef.current = sse;

    const handleRoomUpdate = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.room) setRoom(data.room);
      } catch (err) {}
    };

    sse.addEventListener("ROOM_UPDATED", handleRoomUpdate);
    sse.addEventListener("QUESTION_START", (e: MessageEvent) => {
      handleRoomUpdate(e);
      setSelectedOption("");
      setLockedIn(false);
    });
    sse.addEventListener("PLAYER_ANSWERED", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalAnswered: data.totalAnswered,
            answerDistribution: data.answerDistribution,
          };
        });
      } catch (err) {}
    });
    sse.addEventListener("QUESTION_RESULT", handleRoomUpdate);
    sse.addEventListener("SHOW_LEADERBOARD", handleRoomUpdate);
    sse.addEventListener("GAME_FINISHED", (e: MessageEvent) => {
      handleRoomUpdate(e);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    });

    // Fallback polling heartbeat every 2 seconds
    const interval = setInterval(fetchRoomState, 2000);

    return () => {
      sse.close();
      clearInterval(interval);
    };
  }, [pin, hostToken]);

  // Countdown timer when QUESTION_ACTIVE
  useEffect(() => {
    if (room?.status === "QUESTION_ACTIVE") {
      const currentQ = room.questions[room.currentQuestionIndex];
      const maxLimit = currentQ?.timeLimit || 15;
      const startTime = room.questionStartTime || Date.now();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, maxLimit - elapsed);
      setTimeLeft(remaining);

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (isHost) {
              sendAction("END_QUESTION");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [room?.status, room?.currentQuestionIndex, room?.questionStartTime, isHost]);

  // Confetti on final finished screen
  useEffect(() => {
    if (room?.status === "FINISHED") {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.55 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } }), 800);
    }
  }, [room?.status]);

  // Send action to API
  const sendAction = async (action: string, extraData: any = {}) => {
    try {
      const res = await axios.post(
        `/api/livequiz/${pin}/action`,
        { action, ...extraData },
        { headers: hostHeaders }
      );
      if (res.data?.success && res.data?.room) {
        setRoom(res.data.room);
      }
      return res.data;
    } catch (err: any) {
      console.error(`Action ${action} error:`, err?.response?.data || err.message);
    }
  };

  // Player submits answer
  const handlePlayerSubmit = async (optionLabel: string) => {
    if (lockedIn || room?.status !== "QUESTION_ACTIVE") return;

    setSelectedOption(optionLabel);
    setLockedIn(true);

    const currentQ = room.questions[room.currentQuestionIndex];
    const maxLimit = currentQ?.timeLimit || 15;
    const timeTaken = Math.max(0.1, maxLimit - timeLeft);
    setAnswerTime(timeTaken);

    await sendAction("SUBMIT_ANSWER", {
      playerId: myPlayerId,
      chosenOption: optionLabel,
    });
  };

  // Copy helper
  const handleCopyLink = () => {
    const url = `${window.location.origin}/quizgenerator/join?pin=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Fetch History for History Tab
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get("/api/livequiz/history");
      if (res.data?.games) {
        setHistoryGames(res.data.games);
      }
    } catch (err: any) {
      console.error("History fetch error:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  // Export CSV
  const handleExportCSV = (game: any) => {
    const rows = [
      ["Rank", "Nickname", "Score", "Streak", "Questions Answered"],
      ...game.players
        .sort((a: any, b: any) => b.score - a.score)
        .map((p: any, idx: number) => [
          idx + 1,
          p.nickname,
          p.score,
          p.streak || 0,
          p.answersHistory?.length || 0,
        ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arena-${game.pin}-results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Question editing / adding handlers
  const handleOpenAddQuestion = () => {
    setEditingQuestionIdx(null);
    setQText("");
    setQOptions(["", "", "", ""]);
    setQCorrect("A");
    setQTimeLimit(15);
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (idx: number) => {
    if (!room) return;
    const q = room.questions[idx];
    setEditingQuestionIdx(idx);
    setQText(q.questionText);
    setQOptions(q.answers.map((a) => a.option));
    setQCorrect(q.correctAnswer);
    setQTimeLimit(q.timeLimit || 15);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!room || !qText.trim()) return;

    const newQuestion: Question = {
      questionText: qText,
      answers: qOptions.map((opt, i) => ({
        label: String.fromCharCode(65 + i),
        option: opt || `Option ${String.fromCharCode(65 + i)}`,
      })),
      correctAnswer: qCorrect,
      timeLimit: qTimeLimit,
      points: 1000,
    };

    let updatedQuestions = [...room.questions];
    if (editingQuestionIdx !== null) {
      updatedQuestions[editingQuestionIdx] = newQuestion;
    } else {
      updatedQuestions.push(newQuestion);
    }

    await sendAction("UPDATE_QUESTIONS", { questions: updatedQuestions });
    setShowQuestionModal(false);
  };

  const handleDeleteQuestion = async (idx: number) => {
    if (!room || room.questions.length <= 1) {
      alert("At least one question is required for the arena.");
      return;
    }
    const updatedQuestions = room.questions.filter((_, i) => i !== idx);
    await sendAction("UPDATE_QUESTIONS", { questions: updatedQuestions });
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-[#070a12] text-[#38bdf8] font-body flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold tracking-widest font-tag">[CONNECTING TO BATTLE ARENA...]</span>
      </div>
    );
  }

  const currentQ = room.questions[room.currentQuestionIndex];
  const myPlayer = room.players.find((p) => p.id === myPlayerId);
  const rankedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const myRank = rankedPlayers.findIndex((p) => p.id === myPlayerId) + 1;

  // -------------------------------------------------------------
  // HOST VIEW (Big Screen Admin Panel)
  // -------------------------------------------------------------
  if (isHost) {
    return (
      <div className="relative min-h-screen bg-[#070a12] text-white font-body flex flex-col">
        {/* Host Header */}
        <header className="bg-[#0d1527] border-b border-[#16243f] px-6 py-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              <Gamepad2 className="w-5 h-5 text-[#070a12]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-tag text-lg font-bold text-[#38bdf8] spray-glow">
                  {room.title || "AssistIQ Live"}
                </span>
                <span className="bg-[#0ea5e9]/20 text-[#38bdf8] border border-[#0ea5e9]/40 text-[10px] font-bold px-2 py-0.5 rounded-full font-stencil">
                  PIN: {room.pin}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">
                {room.players.length} players · {room.questions.length} Qs
              </span>
            </div>
          </div>

          {/* Navigation Tabs (Image 1 top tabs) */}
          <div className="hidden md:flex items-center gap-1 bg-black/60 p-1 rounded-2xl border border-[#16243f]">
            <button
              onClick={() => setActiveTab("questions")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold font-tag transition-all cursor-pointer ${
                activeTab === "questions"
                  ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📝 Questions
            </button>
            <button
              onClick={() => setActiveTab("host_qr")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold font-tag transition-all cursor-pointer ${
                activeTab === "host_qr"
                  ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📱 Host / QR
            </button>
            <button
              onClick={() => setActiveTab("control")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold font-tag transition-all cursor-pointer ${
                activeTab === "control"
                  ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🎮 Game Control
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold font-tag transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📋 History
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/quizgenerator")}
              className="p-2 text-gray-400 hover:text-red-400 rounded-xl hover:bg-black/40 transition-colors cursor-pointer"
              title="Exit Arena"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab 1: Questions Management Tab (Image 1 left) */}
        {activeTab === "questions" && (
          <div className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black font-tag text-white">Questions Playlist</h2>
                <p className="text-xs text-gray-400">Reorder, edit, or append questions before starting the battle.</p>
              </div>
              {room.status === "LOBBY" && (
                <button
                  onClick={handleOpenAddQuestion}
                  className="bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-tag"
                >
                  <Plus className="w-4 h-4" /> Add Question
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {room.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-[#0d1527] border border-[#16243f] hover:border-[#0ea5e9]/40 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-black/60 border border-[#16243f] flex items-center justify-center font-tag text-xs font-bold text-[#38bdf8]">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1.5">{q.questionText}</h4>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {q.answers.map((ans) => {
                          const isCorrect = ans.label.toUpperCase() === q.correctAnswer.toUpperCase();
                          return (
                            <span
                              key={ans.label}
                              className={`px-2 py-0.5 rounded-lg border font-medium ${
                                isCorrect
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : "bg-black/40 text-gray-400 border-[#16243f]"
                              }`}
                            >
                              {ans.label}: {ans.option}
                            </span>
                          );
                        })}
                        <span className="text-gray-500 text-[10px] flex items-center gap-1 self-center ml-2">
                          ⏱ {q.timeLimit}s · max {q.points} pts
                        </span>
                      </div>
                    </div>
                  </div>

                  {room.status === "LOBBY" && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleOpenEditQuestion(idx)}
                        className="p-2 bg-black/40 hover:bg-[#131e36] text-gray-300 hover:text-[#38bdf8] rounded-xl border border-[#16243f] transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-2 bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl border border-[#16243f] transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Host / QR / Big Screen Live Arena (Image 1 right, 2, 3, 4) */}
        {activeTab === "host_qr" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
            {/* 1. LOBBY SCREEN (Image 1 right) */}
            {room.status === "LOBBY" && (
              <div className="w-full max-w-4xl flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-3">
                  <span>✦ JOIN LIVE ARENA ✦</span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-black text-white tracking-wider font-tag mb-1">
                  AssistIQ <span className="text-[#38bdf8] spray-glow">Live</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mb-6">
                  Scan the QR Code or go to{" "}
                  <span className="text-white font-bold underline cursor-pointer" onClick={handleCopyLink}>
                    {typeof window !== "undefined" ? window.location.host : "localhost:3000"}/quizgenerator/join
                  </span>
                </p>

                {/* Big QR Code Card */}
                <div className="rounded-3xl bg-gradient-to-br from-[#38bdf8]/40 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow mb-6">
                  <div className="bg-[#0d1527] p-6 rounded-3xl flex flex-col items-center border border-[#16243f]">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="Join QR Code"
                        className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-black p-2 border border-[#0ea5e9]/30 shadow-[0_0_30px_rgba(14,165,233,0.3)]"
                      />
                    ) : (
                      <div className="w-56 h-56 bg-black/60 rounded-2xl animate-pulse" />
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs uppercase text-gray-400 font-tag font-bold">GAME PIN:</span>
                      <span className="font-tag text-3xl font-black text-[#38bdf8] tracking-widest spray-glow">
                        {room.pin}
                      </span>
                      <button
                        onClick={handleCopyPin}
                        className="p-1.5 bg-black/40 hover:bg-[#131e36] text-gray-300 rounded-lg border border-[#16243f] transition-colors cursor-pointer"
                        title="Copy PIN"
                      >
                        {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Joined Players Grid */}
                <div className="w-full max-w-2xl bg-[#0d1527] border border-[#16243f] rounded-2xl p-4 mb-6">
                  <div className="flex justify-between items-center pb-2 border-b border-[#16243f] mb-3">
                    <span className="text-xs font-bold text-[#38bdf8] uppercase font-tag flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Joined Gladiators ({room.players.length})
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      {room.players.length > 0 ? "Ready to launch" : "Waiting for players to scan"}
                    </span>
                  </div>

                  {room.players.length === 0 ? (
                    <div className="py-6 text-gray-500 text-xs italic">
                      No gladiators have joined yet. Scan the QR code or enter PIN to enter the lobby!
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center max-h-36 overflow-y-auto custom-scroll">
                      {room.players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 bg-[#131e36] border border-[#0ea5e9]/30 text-white px-3 py-1.5 rounded-xl font-tag text-xs transform -rotate-1 hover:rotate-0 transition-transform shadow-[0_0_10px_rgba(14,165,233,0.2)]"
                        >
                          <span className="text-base">{p.avatar}</span>
                          <span className="font-bold">{p.nickname}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Start Game Action */}
                <button
                  onClick={() => sendAction("START_GAME")}
                  disabled={room.players.length === 0}
                  className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-black text-base px-10 py-4 rounded-2xl transition-all shadow-[0_0_25px_rgba(14,165,233,0.5)] flex items-center gap-3 cursor-pointer font-tag disabled:opacity-50 tracking-wider"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START GAME NOW</span>
                </button>
              </div>
            )}

            {/* 2. QUESTION ACTIVE SCREEN (Image 2) */}
            {room.status === "QUESTION_ACTIVE" && currentQ && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                {/* Header Bar */}
                <div className="w-full flex justify-between items-center mb-6 px-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-[#0ea5e9]/20 text-[#38bdf8] border border-[#0ea5e9]/40 rounded-full font-tag text-xs font-bold uppercase">
                      Q {room.currentQuestionIndex + 1} / {room.questions.length}
                    </span>
                    <span className="text-xs text-gray-400">Battle in Progress</span>
                  </div>

                  {/* Circular / Pill Countdown Timer */}
                  <div className={`px-4 py-1.5 rounded-full font-tag text-lg font-black border flex items-center gap-1.5 transition-colors ${
                    timeLeft <= 5
                      ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
                      : "bg-[#0ea5e9]/20 text-[#38bdf8] border-[#0ea5e9]/40"
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{timeLeft}s</span>
                  </div>
                </div>

                {/* Question Big Banner */}
                <div className="w-full rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow mb-6">
                  <div className="w-full bg-[#0d1527] p-8 rounded-3xl text-center border border-[#16243f]">
                    <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                      {currentQ.questionText}
                    </h2>
                  </div>
                </div>

                {/* 4 Colored Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-6">
                  {currentQ.answers.map((ans, i) => {
                    const c = OPTION_COLORS[i % OPTION_COLORS.length];
                    return (
                      <div
                        key={ans.label}
                        className={`rounded-2xl bg-gradient-to-r ${c.bg} p-4 text-white flex items-center gap-3 shadow-lg border border-white/10`}
                      >
                        <span className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center font-black text-sm font-tag">
                          {c.label}
                        </span>
                        <span className="text-sm sm:text-base font-bold flex-1">{ans.option}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Host Control Action Footer */}
                <div className="w-full flex justify-between items-center bg-[#0d1527] border border-[#16243f] p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-tag">
                    <span className="text-[#38bdf8] font-bold">Answers In:</span>
                    <span className="text-white font-black">
                      {room.totalAnswered} / {room.players.length} Players
                    </span>
                  </div>

                  <button
                    onClick={() => sendAction("END_QUESTION")}
                    className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer font-tag"
                  >
                    End Question Early ⏱
                  </button>
                </div>
              </div>
            )}

            {/* 3. QUESTION RESULT / DISTRIBUTION SCREEN (Image 3 right) */}
            {room.status === "QUESTION_RESULT" && currentQ && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                <div className="text-center mb-6">
                  <span className="text-xs font-tag font-bold text-[#38bdf8] uppercase">Question {room.currentQuestionIndex + 1} Breakdown</span>
                  <h3 className="text-xl sm:text-3xl font-bold text-white mt-1">{currentQ.questionText}</h3>
                </div>

                {/* Answer Distribution Bar Chart */}
                <div className="w-full bg-[#0d1527] border border-[#16243f] rounded-3xl p-6 sm:p-8 flex flex-col gap-4 mb-6">
                  {currentQ.answers.map((ans, i) => {
                    const isCorrect = ans.label.toUpperCase() === currentQ.correctAnswer.toUpperCase();
                    const voteCount = room.answerDistribution[ans.label.toUpperCase()] || 0;
                    const pct = room.players.length > 0 ? Math.round((voteCount / room.players.length) * 100) : 0;

                    return (
                      <div key={ans.label} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className={isCorrect ? "text-emerald-400 flex items-center gap-1.5 font-tag" : "text-gray-300"}>
                            {ans.label}: {ans.option} {isCorrect && "✓ (CORRECT)"}
                          </span>
                          <span className="font-tag text-xs text-gray-400">
                            {voteCount} votes ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-8 bg-black/60 rounded-xl overflow-hidden border border-[#16243f] p-0.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, voteCount > 0 ? 8 : 0)}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-lg flex items-center justify-end pr-2 text-[10px] font-bold ${
                              isCorrect
                                ? "bg-emerald-500 text-[#070a12] shadow-[0_0_15px_rgba(16,185,129,0.5)] font-tag"
                                : "bg-rose-500/60 text-white"
                            }`}
                          >
                            {voteCount > 0 && voteCount}
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Host Control Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => sendAction("SHOW_LEADERBOARD")}
                    className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-[#070a12] font-black text-sm px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center gap-2 cursor-pointer font-tag"
                  >
                    <span>SHOW LEADERBOARD</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => sendAction("NEXT_QUESTION")}
                    className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer font-tag"
                  >
                    Skip to Next Q
                  </button>
                </div>
              </div>
            )}

            {/* 4. LEADERBOARD SCREEN (Image 4 right) */}
            {room.status === "LEADERBOARD" && (
              <div className="w-full max-w-3xl flex flex-col items-center">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-2">
                    <Trophy className="w-4 h-4" /> Live Standings
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white font-tag">
                    LEADER<span className="text-[#38bdf8] spray-glow">BOARD</span>
                  </h2>
                </div>

                {/* Leaderboard Table */}
                <div className="w-full bg-[#0d1527] border border-[#16243f] rounded-3xl p-6 flex flex-col gap-3 mb-6">
                  {rankedPlayers.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        idx === 0
                          ? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                          : idx === 1
                          ? "bg-slate-300/10 border-slate-300/30"
                          : idx === 2
                          ? "bg-amber-700/10 border-amber-700/30"
                          : "bg-black/40 border-[#16243f]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-black/60 font-black text-xs flex items-center justify-center font-tag text-[#38bdf8]">
                          #{idx + 1}
                        </span>
                        <span className="text-xl">{p.avatar}</span>
                        <span className="font-bold text-sm text-white">{p.nickname}</span>
                        {p.streak >= 2 && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-tag">
                            <Flame className="w-3 h-3" /> {p.streak} streak
                          </span>
                        )}
                      </div>
                      <span className="font-tag text-base font-black text-[#38bdf8]">
                        {p.score} pts
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Host Control Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => sendAction("NEXT_QUESTION")}
                    className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-[#070a12] font-black text-sm px-10 py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center gap-2 cursor-pointer font-tag"
                  >
                    <span>
                      {room.currentQuestionIndex + 1 < room.questions.length
                        ? `NEXT QUESTION (${room.currentQuestionIndex + 2}/${room.questions.length})`
                        : "SHOW FINAL PODIUM 🏆"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 5. FINISHED SCREEN: 3D WINNER PODIUM (Image 4 right) */}
            {room.status === "FINISHED" && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-tag text-xs uppercase mb-2">
                    <Crown className="w-4 h-4" /> Grand Champions
                  </div>
                  <h1 className="text-4xl sm:text-6xl font-black text-white font-tag tracking-wider">
                    VICTORY <span className="text-[#38bdf8] spray-glow">PODIUM</span>
                  </h1>
                </div>

                {/* 3D Visual Podium (Image 4 right) */}
                <div className="w-full max-w-2xl flex items-end justify-center gap-4 mb-8 h-80 px-4">
                  {/* 2nd Place (Silver - Left) */}
                  {rankedPlayers[1] ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "65%", opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="w-1/3 bg-gradient-to-t from-slate-600 to-slate-400 rounded-t-3xl p-4 flex flex-col items-center justify-between text-center relative border-t-2 border-slate-200 shadow-[0_0_20px_rgba(203,213,225,0.3)]"
                    >
                      <div className="absolute -top-12 flex flex-col items-center">
                        <span className="text-3xl mb-1">{rankedPlayers[1].avatar}</span>
                        <span className="font-bold text-xs text-white truncate max-w-[100px]">
                          {rankedPlayers[1].nickname}
                        </span>
                      </div>
                      <span className="text-2xl font-black text-slate-900 font-tag mt-4">2ND</span>
                      <span className="font-tag text-xs font-bold text-slate-900">{rankedPlayers[1].score} pts</span>
                    </motion.div>
                  ) : (
                    <div className="w-1/3 h-1/2 bg-black/20 rounded-t-3xl" />
                  )}

                  {/* 1st Place (Gold - Center) */}
                  {rankedPlayers[0] ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "85%", opacity: 1 }}
                      transition={{ duration: 0.8 }}
                      className="w-1/3 bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-300 rounded-t-3xl p-4 flex flex-col items-center justify-between text-center relative border-t-2 border-yellow-200 shadow-[0_0_35px_rgba(245,158,11,0.6)]"
                    >
                      <div className="absolute -top-14 flex flex-col items-center">
                        <Crown className="w-6 h-6 text-yellow-300 fill-current animate-bounce" />
                        <span className="text-4xl mb-1">{rankedPlayers[0].avatar}</span>
                        <span className="font-black text-sm text-white truncate max-w-[120px]">
                          {rankedPlayers[0].nickname}
                        </span>
                      </div>
                      <span className="text-3xl font-black text-yellow-950 font-tag mt-6">1ST</span>
                      <span className="font-tag text-sm font-black text-yellow-950">{rankedPlayers[0].score} pts</span>
                    </motion.div>
                  ) : null}

                  {/* 3rd Place (Bronze - Right) */}
                  {rankedPlayers[2] ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "50%", opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="w-1/3 bg-gradient-to-t from-amber-900 to-amber-700 rounded-t-3xl p-4 flex flex-col items-center justify-between text-center relative border-t-2 border-amber-600 shadow-[0_0_20px_rgba(180,83,9,0.3)]"
                    >
                      <div className="absolute -top-12 flex flex-col items-center">
                        <span className="text-3xl mb-1">{rankedPlayers[2].avatar}</span>
                        <span className="font-bold text-xs text-white truncate max-w-[100px]">
                          {rankedPlayers[2].nickname}
                        </span>
                      </div>
                      <span className="text-2xl font-black text-amber-200 font-tag mt-2">3RD</span>
                      <span className="font-tag text-xs font-bold text-amber-200">{rankedPlayers[2].score} pts</span>
                    </motion.div>
                  ) : (
                    <div className="w-1/3 h-1/3 bg-black/20 rounded-t-3xl" />
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab("history")}
                    className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs px-6 py-3 rounded-xl transition-colors cursor-pointer font-tag"
                  >
                    View Game History
                  </button>
                  <button
                    onClick={() => router.push("/quizgenerator")}
                    className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-[#070a12] font-black text-xs px-6 py-3 rounded-xl transition-all font-tag cursor-pointer"
                  >
                    Host Another Arena
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Game Control Tab (Image 3 middle, Image 4 middle) */}
        {activeTab === "control" && (
          <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-6">
            <h2 className="text-2xl font-black font-tag text-white">Battle Director Dashboard</h2>

            <div className="bg-[#0d1527] border border-[#16243f] rounded-3xl p-6 flex flex-col gap-5">
              <div className="flex justify-between items-center pb-3 border-b border-[#16243f]">
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase font-tag">Current Arena Status</span>
                  <div className="text-lg font-black text-[#38bdf8] font-tag">{room.status}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-bold uppercase font-tag">Current Question</span>
                  <div className="text-lg font-black text-white font-tag">
                    {room.currentQuestionIndex + 1} / {room.questions.length}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {room.status === "LOBBY" && (
                  <button
                    onClick={() => sendAction("START_GAME")}
                    className="bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer font-tag col-span-2"
                  >
                    ▶ Launch Battle (Question 1)
                  </button>
                )}

                {room.status === "QUESTION_ACTIVE" && (
                  <button
                    onClick={() => sendAction("END_QUESTION")}
                    className="bg-amber-500 hover:bg-amber-400 text-[#070a12] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer font-tag col-span-2"
                  >
                    ⏹ Stop Timer & Show Results
                  </button>
                )}

                {room.status === "QUESTION_RESULT" && (
                  <>
                    <button
                      onClick={() => sendAction("SHOW_LEADERBOARD")}
                      className="bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer font-tag"
                    >
                      🏆 Show Leaderboard
                    </button>
                    <button
                      onClick={() => sendAction("NEXT_QUESTION")}
                      className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer font-tag"
                    >
                      ⏩ Next Question
                    </button>
                  </>
                )}

                {room.status === "LEADERBOARD" && (
                  <button
                    onClick={() => sendAction("NEXT_QUESTION")}
                    className="bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs py-3 rounded-xl transition-all cursor-pointer font-tag col-span-2"
                  >
                    {room.currentQuestionIndex + 1 < room.questions.length ? "⏩ Next Question" : "🏆 Show Victory Podium"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: History Tab (Image 5) */}
        {activeTab === "history" && (
          <div className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black font-tag text-white">Arena Battle Archives</h2>
                <p className="text-xs text-gray-400">Past completed live games with podium results & CSV exports.</p>
              </div>
              <button
                onClick={fetchHistory}
                className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer font-tag"
              >
                Refresh Archives
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyGames.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs italic bg-[#0d1527] rounded-3xl border border-[#16243f]">
                No completed arena games recorded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {historyGames.map((game) => {
                  const sorted = (game.players || []).sort((a: any, b: any) => b.score - a.score);
                  return (
                    <div
                      key={game._id}
                      className="bg-[#0d1527] border border-[#16243f] rounded-3xl p-6 flex flex-col gap-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white font-tag">{game.title || "AssistIQ Live Arena"}</h3>
                          <span className="text-[11px] text-gray-400">
                            {new Date(game.createdAt).toLocaleString()} · PIN: {game.pin} · {game.players?.length || 0} gladiators
                          </span>
                        </div>

                        <button
                          onClick={() => handleExportCSV(game)}
                          className="bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-tag"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>CSV EXPORT</span>
                        </button>
                      </div>

                      {/* Top 3 Podium Cards (Image 5) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1st Place */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col items-center text-center">
                          <span className="text-xl mb-1">🥇</span>
                          <span className="font-bold text-sm text-white truncate max-w-[140px]">
                            {sorted[0]?.nickname || "—"}
                          </span>
                          <span className="text-xs text-amber-400 font-tag font-bold">
                            {sorted[0]?.score || 0} pts
                          </span>
                        </div>

                        {/* 2nd Place */}
                        <div className="bg-slate-300/10 border border-slate-300/30 rounded-2xl p-4 flex flex-col items-center text-center">
                          <span className="text-xl mb-1">🥈</span>
                          <span className="font-bold text-sm text-white truncate max-w-[140px]">
                            {sorted[1]?.nickname || "—"}
                          </span>
                          <span className="text-xs text-slate-300 font-tag font-bold">
                            {sorted[1]?.score || 0} pts
                          </span>
                        </div>

                        {/* 3rd Place */}
                        <div className="bg-amber-700/10 border border-amber-700/30 rounded-2xl p-4 flex flex-col items-center text-center">
                          <span className="text-xl mb-1">🥉</span>
                          <span className="font-bold text-sm text-white truncate max-w-[140px]">
                            {sorted[2]?.nickname || "—"}
                          </span>
                          <span className="text-xs text-amber-600 font-tag font-bold">
                            {sorted[2]?.score || 0} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal: Add/Edit Question */}
        {showQuestionModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#0d1527] border border-[#38bdf8] rounded-3xl p-6 flex flex-col gap-4 card-spray-shadow">
              <h3 className="text-lg font-bold text-white font-tag">
                {editingQuestionIdx !== null ? "Edit Question" : "Add New Question"}
              </h3>

              <div>
                <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag mb-1 block">Question Title</label>
                <input
                  type="text"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. What is the time complexity of QuickSort in best case?"
                  className="w-full bg-black/60 border border-[#16243f] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* 4 Options */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag">Answer Options</label>
                {qOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-black/60 font-bold text-xs flex items-center justify-center text-[#38bdf8] font-tag">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...qOptions];
                        copy[i] = e.target.value;
                        setQOptions(copy);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="flex-1 bg-black/60 border border-[#16243f] focus:border-[#38bdf8] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag mb-1 block">Correct Option</label>
                  <select
                    value={qCorrect}
                    onChange={(e) => setQCorrect(e.target.value)}
                    className="w-full bg-black/60 border border-[#16243f] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag mb-1 block">Time Limit (Sec)</label>
                  <select
                    value={qTimeLimit}
                    onChange={(e) => setQTimeLimit(Number(e.target.value))}
                    className="w-full bg-black/60 border border-[#16243f] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={20}>20s</option>
                    <option value={30}>30s</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 bg-black/40 hover:bg-[#131e36] text-gray-400 hover:text-white py-2 rounded-xl text-xs font-tag cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuestion}
                  className="flex-1 bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold py-2 rounded-xl text-xs font-tag cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PLAYER VIEW (Mobile / Participant Screen)
  // -------------------------------------------------------------
  return (
    <div className="relative min-h-screen bg-[#070a12] text-white font-body flex flex-col">
      {/* Player Top Bar */}
      <header className="bg-[#0d1527] border-b border-[#16243f] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{myAvatar}</span>
          <span className="font-tag font-bold text-sm text-white">{myNickname}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-tag text-xs font-black text-[#38bdf8]">
            {myPlayer?.score || 0} PTS
          </span>
          {myPlayer && myPlayer.streak >= 2 && (
            <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-tag">
              <Flame className="w-3 h-3" /> {myPlayer.streak}
            </span>
          )}
        </div>
      </header>

      {/* Player Screen Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* LOBBY: Waiting for host */}
        {room.status === "LOBBY" && (
          <div className="w-full max-w-sm text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center text-4xl mb-4 shadow-[0_0_25px_rgba(14,165,233,0.3)] animate-pulse">
              {myAvatar}
            </div>
            <h2 className="text-2xl font-black text-white font-tag">YOU&apos;RE IN THE ARENA!</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Waiting for the host to launch the game. Look up at the big screen!
            </p>
          </div>
        )}

        {/* QUESTION_ACTIVE: 4 Big Tap Buttons (Image 2) */}
        {room.status === "QUESTION_ACTIVE" && currentQ && (
          <div className="w-full max-w-md flex flex-col gap-4">
            {/* Timer and Question Counter */}
            <div className="flex justify-between items-center text-xs font-tag px-1">
              <span className="text-gray-400 font-bold">
                Q {room.currentQuestionIndex + 1} / {room.questions.length}
              </span>
              <span className={`px-3 py-1 rounded-full font-black ${
                timeLeft <= 5 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-[#0ea5e9]/20 text-[#38bdf8]"
              }`}>
                ⏱ {timeLeft}s
              </span>
            </div>

            {/* Question Text */}
            <div className="bg-[#0d1527] border border-[#16243f] p-5 rounded-2xl text-center">
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                {currentQ.questionText}
              </h3>
            </div>

            {/* 4 Colored Massive Answer Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              {currentQ.answers.map((ans, i) => {
                const c = OPTION_COLORS[i % OPTION_COLORS.length];
                const isSelected = selectedOption === ans.label;

                return (
                  <button
                    key={ans.label}
                    onClick={() => handlePlayerSubmit(ans.label)}
                    disabled={lockedIn}
                    className={`h-24 sm:h-28 rounded-2xl bg-gradient-to-r ${c.bg} p-4 text-white flex items-center justify-between transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-75 ${
                      isSelected ? "ring-4 ring-white scale-[1.02]" : ""
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center font-black text-lg font-tag">
                      {c.label}
                    </span>
                    <span className="text-sm font-bold flex-1 text-center px-2">{ans.option}</span>
                  </button>
                );
              })}
            </div>

            {lockedIn && (
              <div className="bg-black/60 border border-[#38bdf8] p-3 rounded-xl text-center text-xs text-[#38bdf8] font-tag animate-pulse">
                🔒 ANSWER LOCKED! WAITING FOR TIMER...
              </div>
            )}
          </div>
        )}

        {/* QUESTION_RESULT: Player Instant Feedback (Image 3 left) */}
        {room.status === "QUESTION_RESULT" && myPlayer && (
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            {myPlayer.lastAnswer?.isCorrect ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full bg-[#0d1527] border border-emerald-500/40 rounded-3xl p-8 flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-white font-tag">CORRECT!</h2>
                <span className="text-xl font-tag font-black text-emerald-400">
                  +{myPlayer.lastAnswer.pointsEarned} PTS
                </span>
                <span className="text-xs text-gray-400">Answered in {myPlayer.lastAnswer.timeTakenSeconds}s</span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full bg-[#0d1527] border border-rose-500/40 rounded-3xl p-8 flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(244,63,94,0.2)]"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400">
                  <XCircle className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-white font-tag">WRONG!</h2>
                <span className="text-xl font-tag font-black text-rose-400">+0 PTS</span>
                <span className="text-xs text-gray-400">Correct was option {currentQ?.correctAnswer}</span>
              </motion.div>
            )}
          </div>
        )}

        {/* LEADERBOARD: Personal Standing (Image 4 left) */}
        {room.status === "LEADERBOARD" && (
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <div className="w-full bg-gradient-to-br from-[#0ea5e9]/30 to-[#0d1527] border border-[#0ea5e9]/40 rounded-3xl p-6 mb-4 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
              <span className="text-xs font-tag uppercase text-[#38bdf8] font-bold">Your Standing</span>
              <div className="text-4xl font-black font-tag text-white my-1">
                RANK #{myRank}
              </div>
              <div className="text-sm font-tag text-[#38bdf8] font-bold">
                {myPlayer?.score || 0} TOTAL PTS
              </div>
            </div>

            <p className="text-xs text-gray-400 italic">Look up at the big screen for full scoreboard!</p>
          </div>
        )}

        {/* FINISHED: Final Victory Standing */}
        {room.status === "FINISHED" && (
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-4xl mb-3 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
              {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎮"}
            </div>
            <h2 className="text-3xl font-black text-white font-tag">GAME OVER!</h2>
            <div className="text-xl font-black text-amber-400 font-tag my-2">
              YOU FINISHED #{myRank}
            </div>
            <span className="text-sm font-bold text-gray-300 font-tag">
              FINAL SCORE: {myPlayer?.score || 0} PTS
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
