'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import UploadDialog from "../Loading";
import { CircleHelp, ArrowRight } from "lucide-react";

export default function QuizGenerator({ persist_dir }: { persist_dir: string }) {
    const [questions, setQuestions] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [status, setStatus] = useState<"loading" | "done">("loading");
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        const generateQuizTopics = async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
                const res = await axios.post(`${backendUrl}/askquestion`, {
                    question: "Suggest 5 high-yield quiz topics based on this PDF. Return ONLY a comma-separated list of topics, no numbers or extra text.",
                    store: persist_dir
                });

                if (mounted) {
                    const raw = res.data?.answer || "";
                    let topics: string[] = [];
                    if (Array.isArray(raw)) {
                        topics = raw.map(String);
                    } else if (typeof raw === "string") {
                        try {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) topics = parsed.map(String);
                        } catch {
                            topics = raw.split(/[\n,]+/).map(t => t.replace(/^[-*0-9.]+\s*/, '').trim()).filter(Boolean);
                        }
                    }
                    setQuestions(topics.slice(0, 6));
                }
            } catch (err) {
                if (mounted) {
                    setQuestions([
                        "Key Concepts & Fundamentals",
                        "Core Architecture & Workflow",
                        "Practical Application & Edge Cases",
                        "Performance & Best Practices"
                    ]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (persist_dir) {
            generateQuizTopics();
        }
        return () => { mounted = false; };
    }, [persist_dir]);

    const onhandleSubmit = async (value: string) => {
        if (!value.trim()) return;
        try {
            setShowDialog(true);
            setStatus("loading");
            const formdata = new FormData();
            formdata.append("prompt", value);
            const res = await axios.post('/api/quiz/generate', formdata, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            setStatus("done");
            if (res.data?.quiz?._id) {
                router.push(`/quizgenerator/${res.data.quiz._id}`);
            }
        } catch (err: any) {
            console.error("Quiz generate error:", err);
            setShowDialog(false);
        }
    };

    return (
        <div className="flex flex-col w-full h-full font-body text-white bg-[#070a12] rounded-2xl border border-[#0ea5e9]/25 overflow-hidden">
            <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#38bdf8] font-tag font-bold">
                    <CircleHelp className="w-3.5 h-3.5" /> [AI QUIZ GEN // SMART TEST]
                </span>
                <span className="text-gray-400 text-[10px] font-tag">TAP TOPIC TO LAUNCH</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scroll bg-black/40">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Extracting high-yield topics...</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-[11px] text-[#38bdf8] tracking-widest uppercase font-tag">
                            RECOMMENDED EXAM TOPICS:
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                            {questions.map((topic, index) => (
                                <button
                                    key={index}
                                    onClick={() => onhandleSubmit(topic)}
                                    className="text-left p-3.5 rounded-xl bg-[#0d1527] border border-[#16243f] hover:border-[#38bdf8] hover:bg-[#131e36] text-xs text-gray-200 transition-all flex items-center justify-between group"
                                >
                                    <span>{topic}</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-[#38bdf8] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-3 bg-[#0d1527] border-t border-[#16243f] flex gap-2">
                <input
                    className="flex-1 bg-black/50 border border-[#16243f] text-white placeholder-gray-500 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-[#38bdf8] transition-all"
                    placeholder="Or enter custom quiz topic..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onhandleSubmit(input);
                    }}
                />
                <button
                    disabled={!input.trim()}
                    onClick={() => onhandleSubmit(input)}
                    className="bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] px-4 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all font-tag shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                >
                    Generate
                </button>
            </div>

            <UploadDialog
                show={showDialog}
                onClose={() => setShowDialog(false)}
                status={status}
                title="Generating your quiz..."
                subtitle="Please wait while AssistIQ prepares active recall questions 🪄"
            />
        </div>
    );
}
