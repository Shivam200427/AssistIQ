"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Paintbrush, Play, Sparkles, User, KeyRound, ArrowRight } from "lucide-react";
import Back from "../../components/Back";
import axios from "axios";

const AVATARS = ["⚡", "🔥", "👑", "🚀", "💀", "🎯", "🐺", "🏆", "💎", "👾"];

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPin = searchParams?.get("pin") || "";

  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialPin) {
      setPin(initialPin);
    }
  }, [initialPin]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPin = pin.trim().toUpperCase();
    const cleanNick = nickname.trim();

    if (!cleanPin) {
      setError("Please enter a valid Game PIN.");
      return;
    }
    if (!cleanNick) {
      setError("Please enter your gamer nickname.");
      return;
    }

    try {
      setLoading(true);
      // Verify room exists
      const res = await axios.get(`/api/livequiz/${cleanPin}/state`);
      if (res.data?.success) {
        // Store player info in sessionStorage
        const playerId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        sessionStorage.setItem("livequiz_player_id", playerId);
        sessionStorage.setItem("livequiz_player_nickname", cleanNick);
        sessionStorage.setItem("livequiz_player_avatar", selectedAvatar);

        // Join room
        await axios.post(`/api/livequiz/${cleanPin}/action`, {
          action: "JOIN",
          id: playerId,
          nickname: cleanNick,
          avatar: selectedAvatar,
        });

        router.push(`/quizgenerator/arena/${cleanPin}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || "Game PIN not found. Please check with your host.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md z-10">
      {/* Brand Tag */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-2 transform -rotate-1">
          <Paintbrush className="w-3.5 h-3.5" />
          <span>✦ ASSISTIQ LIVE ARENA ✦</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-wider font-tag">
          JOIN <span className="text-[#38bdf8] spray-glow">BATTLE</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Enter your game PIN and claim your tag to enter the live multiplayer arena.
        </p>
      </div>

      {/* Join Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#38bdf8]/40 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow">
        <form onSubmit={handleJoin} className="bg-[#0d1527] rounded-3xl p-6 sm:p-8 border border-[#16243f] flex flex-col gap-5">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-400 font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Game PIN Input */}
          <div>
            <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Game PIN
            </label>
            <input
              type="text"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="e.g. 598881"
              className="w-full bg-black/60 border border-[#16243f] focus:border-[#38bdf8] rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-[#38bdf8] outline-none transition-colors font-tag"
            />
          </div>

          {/* Nickname Input */}
          <div>
            <label className="text-xs font-bold text-[#38bdf8] uppercase font-tag flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5" /> Gamer Tag / Nickname
            </label>
            <input
              type="text"
              maxLength={18}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Chhetri, Pessi, Cyber"
              className="w-full bg-black/60 border border-[#16243f] focus:border-[#38bdf8] rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none transition-colors"
            />
          </div>

          {/* Avatar Picker */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase font-tag mb-1.5 block">
              Choose Battle Badge
            </label>
            <div className="flex flex-wrap gap-2 justify-center py-1">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                    selectedAvatar === av
                      ? "bg-[#0ea5e9] scale-110 shadow-[0_0_15px_rgba(14,165,233,0.6)] border-2 border-white"
                      : "bg-black/50 border border-[#16243f] hover:border-[#0ea5e9]/40 hover:scale-105"
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-black text-sm py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center gap-2 cursor-pointer font-tag disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#070a12] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>ENTER LIVE ARENA</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Host Link Notice */}
      <div className="text-center mt-5 text-xs text-gray-500">
        Want to create your own arena?{" "}
        <span
          onClick={() => router.push("/quizgenerator")}
          className="text-[#38bdf8] hover:underline cursor-pointer font-bold font-tag"
        >
          Host a Quiz Here
        </span>
      </div>
    </div>
  );
}

export default function JoinQuizPage() {
  return (
    <div className="relative min-h-screen bg-[#070a12] text-white font-body flex flex-col items-center justify-center p-4">
      <Back />

      {/* Background Street Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#0ea5e9]/10 rounded-full blur-[120px] pointer-events-none" />

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20 text-[#38bdf8] gap-3">
          <div className="w-8 h-8 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">LOADING ARENA...</span>
        </div>
      }>
        <JoinForm />
      </Suspense>
    </div>
  );
}
