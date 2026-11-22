'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { CircleHelp, ArrowRight } from "lucide-react";
import ProcessDialog, { type ProcessStep } from "../ProcessDialog";

/** Suggests topics from the PDF, then writes a quiz from the PDF itself (not just the topic name). */
export default function QuizGenerator({ persist_dir, documentId }: { persist_dir: string; documentId?: string }) {
    const [topics, setTopics] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [topicsError, setTopicsError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [difficulty, setDifficulty] = useState("mixed");
    const [count, setCount] = useState(5);
    const [run, setRun] = useState<{ steps: ProcessStep[]; error?: string; topic: string; fallbackAvailable?: boolean; signIn?: boolean } | null>(null);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setTopicsError("");
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
                const res = await axios.post(`${backendUrl}/askquestion`, {
                    question: "Suggest 5 high-yield quiz topics based on this PDF. Return ONLY a comma-separated list of topics, no numbers or extra text.",
                    store: persist_dir,
                    mode: "ideas",
                });
                if (!mounted) return;
                const raw = String(res.data?.answer || "");
                const list = raw.split(/[\n,]+/).map((t) => t.replace(/^[-*0-9.)\s]+/, "").trim()).filter((t) => t && t.length < 80);
                if (!list.length) setTopicsError("No topics could be suggested for this PDF.");
                setTopics(list.slice(0, 6));
            } catch (err: any) {
                if (mounted) setTopicsError(err?.response?.data?.message || "Couldn't reach the document service.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        if (persist_dir) load();
        return () => { mounted = false; };
    }, [persist_dir, attempt]);

    const generate = async (topic: string, allowTopicFallback = false) => {
        if (!topic.trim()) return;
        const label = allowTopicFallback ? `Writing ${count} topic-only questions (not from your PDF)` : `Writing ${count} questions from your PDF about “${topic}”`;
        setRun({ topic, steps: [{ label, status: "active" }] });
        try {
            const form = new FormData();
            form.append("prompt", topic);
            form.append("count", String(count));
            form.append("difficulty", difficulty);
            if (documentId) form.append("documentId", documentId);
            if (allowTopicFallback) form.append("allowTopicFallback", "true");
            const res = await axios.post("/api/quiz/generate", form);
            setRun({ topic, steps: [{ label, status: "done" }] });
            router.push(`/quizgenerator/${res.data.quiz._id}`);
        } catch (err: any) {
            const data = err?.response?.data || {};
            setRun({
                topic,
                steps: [{ label, status: "failed" }],
                error: data.message || "Quiz generation failed.",
                fallbackAvailable: !!data.fallbackAvailable,
                signIn: err?.response?.status === 401,
            });
        }
    };

    return (
        <div className="flex flex-col w-full h-full font-body text-white bg-[#070a12] rounded-2xl border border-[#0ea5e9]/25 overflow-hidden">
            <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center gap-2 text-xs text-[#38bdf8] font-bold">
                <CircleHelp className="w-3.5 h-3.5" /> Quiz from this PDF
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scroll bg-black/40">
                {!documentId && (
                    <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                        This PDF was opened from an old link, so quizzes can&apos;t read it. Re-upload it to quiz from the document.
                    </p>
                )}
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                    <label className="text-gray-300">Difficulty
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full rounded-lg border border-[#16243f] bg-black/50 p-2 text-white cursor-pointer">
                            <option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                        </select>
                    </label>
                    <label className="text-gray-300">Questions
                        <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#16243f] bg-black/50 p-2 text-white cursor-pointer">
                            {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                </div>
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10">
                        <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Finding topics in your PDF…</span>
                    </div>
                ) : topicsError ? (
                    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-sm text-red-300">
                        <span>{topicsError}</span>
                        <button onClick={() => setAttempt((n) => n + 1)} className="rounded-xl border border-[#38bdf8]/50 px-4 py-2 text-[#38bdf8] cursor-pointer">Try again</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                        <div className="text-xs text-gray-400">Suggested topics from your PDF:</div>
                        {topics.map((topic, index) => (
                            <button
                                key={index}
                                disabled={!documentId}
                                onClick={() => generate(topic)}
                                className="text-left p-3.5 rounded-xl bg-[#0d1527] border border-[#16243f] hover:border-[#38bdf8] text-sm text-gray-200 transition-all flex items-center justify-between group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span>{topic}</span>
                                <ArrowRight className="w-4 h-4 text-[#38bdf8]" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-[#0d1527] border-t border-[#16243f] flex gap-2">
                <input
                    className="flex-1 bg-black/50 border border-[#16243f] text-white placeholder-gray-500 text-sm px-3.5 py-2.5 rounded-xl outline-none focus:border-[#38bdf8]"
                    placeholder="Or type a topic from this PDF…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && documentId && generate(input)}
                />
                <button disabled={!input.trim() || !documentId} onClick={() => generate(input)} className="bg-[#38bdf8] text-[#070a12] px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    Make quiz
                </button>
            </div>

            <ProcessDialog
                show={!!run}
                title="Making your quiz"
                steps={run?.steps || []}
                error={run?.error}
                onClose={() => setRun(null)}
                actions={
                    run && !run.steps.some((s) => s.status === "active")
                        ? [
                            run.signIn
                                ? { label: "Sign in with Microsoft", primary: true, onClick: () => (window.location.href = `/api/auth/callback?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`) }
                                : { label: "Try again", primary: true, onClick: () => generate(run.topic) },
                            ...(run.fallbackAvailable ? [{ label: "Topic-only quiz instead (won't use my PDF)", onClick: () => generate(run.topic, true) }] : []),
                            { label: "Close", onClick: () => setRun(null) },
                        ]
                        : []
                }
            />
        </div>
    );
}
