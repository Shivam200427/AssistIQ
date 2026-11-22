"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { LogIn, RotateCcw } from "lucide-react";
import Back from "../../components/Back";

type Mistake = {
  quizId: string;
  quizTitle: string;
  questionId: string;
  questionText: string;
  topic: string;
  yourAnswer: string;
  correctAnswer: string;
  answers: { label: string; option: string }[];
  explanation: string;
  attemptedAt: string;
};

/** Every question you got wrong in your latest attempt of each quiz, grouped by topic. */
export default function MistakesPage() {
  const [state, setState] = useState<"loading" | "ready" | "signin" | "error">("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Mistake[]>([]);
  const [topic, setTopic] = useState("all");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await axios.get("/api/quiz/mistakes");
      setItems(res.data.mistakes || []);
      setState("ready");
    } catch (err: any) {
      if (err?.response?.status === 401) return setState("signin");
      setError(err?.response?.data?.message || "Couldn't load your mistakes.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topics = useMemo(() => [...new Set(items.map((m) => m.topic || "General"))], [items]);
  const shown = topic === "all" ? items : items.filter((m) => (m.topic || "General") === topic);
  const optionText = (m: Mistake, label: string) => m.answers.find((a) => a.label === label)?.option || "";

  return (
    <div className="min-h-screen bg-[#070a12] px-4 py-12 font-body text-white">
      <Back />
      <div className="mx-auto max-w-3xl pt-8">
        <h1 className="text-3xl font-extrabold">
          Mistakes <span className="font-tag text-[#38bdf8]">notebook</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">Questions you got wrong in your latest attempt of each quiz. Only you can see this.</p>

        {state === "loading" && <p className="mt-8 text-sm text-gray-400">Loading…</p>}
        {state === "signin" && (
          <div className="mt-8 rounded-2xl border border-[#16243f] bg-[#0d1527] p-6 text-center">
            <p className="text-sm text-gray-300">Sign in to see your mistakes notebook.</p>
            <button onClick={() => (window.location.href = "/api/auth/callback?redirect=/quizgenerator/mistakes")} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#38bdf8] px-4 py-2 text-sm font-bold text-[#070a12] cursor-pointer">
              <LogIn className="h-4 w-4" /> Sign in with Microsoft
            </button>
          </div>
        )}
        {state === "error" && (
          <div role="alert" className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}{" "}
            <button onClick={load} className="ml-2 inline-flex items-center gap-1 underline cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}
        {state === "ready" && items.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-[#16243f] p-6 text-center text-sm text-gray-400">
            No mistakes yet. Submit a quiz and anything you miss will appear here.
          </p>
        )}
        {state === "ready" && items.length > 0 && (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {["all", ...topics].map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`rounded-xl px-3 py-1.5 text-sm cursor-pointer ${topic === t ? "bg-[#38bdf8] font-bold text-[#070a12]" : "border border-[#16243f] text-gray-300 hover:border-[#38bdf8]/60"}`}
                >
                  {t === "all" ? `All (${items.length})` : t}
                </button>
              ))}
            </div>
            <ul className="mt-6 space-y-4">
              {shown.map((m) => (
                <li key={`${m.quizId}-${m.questionId}`} className="rounded-2xl border border-[#16243f] bg-[#0d1527] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                    <span>
                      {m.quizTitle}
                      {m.topic && <> · {m.topic}</>}
                    </span>
                    <Link href={`/quizgenerator/${m.quizId}`} className="font-semibold text-[#38bdf8] hover:underline">
                      Retake quiz →
                    </Link>
                  </div>
                  <p className="mt-2 font-semibold text-white">{m.questionText}</p>
                  <p className="mt-2 text-sm text-red-300">
                    Your answer: {m.yourAnswer ? `${m.yourAnswer}. ${optionText(m, m.yourAnswer)}` : "not answered"}
                  </p>
                  <p className="text-sm text-emerald-300">
                    Correct: {m.correctAnswer}. {optionText(m, m.correctAnswer)}
                  </p>
                  {m.explanation && <p className="mt-2 text-sm text-gray-400">{m.explanation}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
