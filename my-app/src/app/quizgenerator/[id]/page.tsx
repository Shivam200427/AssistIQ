"use client";
import axios from "axios";
import { useCallback, useEffect, useState, use } from "react";
import { LogIn, RotateCcw } from "lucide-react";
import Quiz from "../Quiz";
import Back from "../../components/Back";

type LoadState = { kind: "loading" } | { kind: "ready"; quiz: any; attempt: any } | { kind: "signin" } | { kind: "error"; message: string };

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await axios.post("/api/quiz/getquiz", { id });
      setState({ kind: "ready", quiz: res.data.quiz, attempt: res.data.attempt });
    } catch (err: any) {
      if (err?.response?.status === 401) setState({ kind: "signin" });
      else setState({ kind: "error", message: err?.response?.data?.message || "Couldn't load this quiz. Check your connection and try again." });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading")
    return (
      <div className="min-h-screen bg-[#070a12] text-[#38bdf8] font-body flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold tracking-wide">Loading quiz…</span>
      </div>
    );

  if (state.kind === "signin" || state.kind === "error")
    return (
      <div className="min-h-screen bg-[#070a12] text-white font-body flex items-center justify-center p-6">
        <Back />
        <div className="max-w-md w-full rounded-3xl border border-[#16243f] bg-[#0d1527] p-8 text-center">
          {state.kind === "signin" ? (
            <>
              <h1 className="text-xl font-extrabold">Sign in to take this quiz</h1>
              <p className="mt-2 text-sm text-gray-400">Your answers and scores are private to your account, so you need to sign in with Microsoft first.</p>
              <button
                onClick={() => (window.location.href = `/api/auth/callback?redirect=${encodeURIComponent(`/quizgenerator/${id}`)}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-bold text-[#070a12] hover:bg-[#7dd3fc] cursor-pointer"
              >
                <LogIn className="h-4 w-4" /> Sign in with Microsoft
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold">Quiz didn&apos;t load</h1>
              <p className="mt-2 text-sm text-red-300">{state.message}</p>
              <button onClick={load} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-5 py-2.5 text-sm font-bold text-[#070a12] hover:bg-[#7dd3fc] cursor-pointer">
                <RotateCcw className="h-4 w-4" /> Try again
              </button>
            </>
          )}
        </div>
      </div>
    );

  return <Quiz quiz={state.quiz} attempt={state.attempt} />;
}
