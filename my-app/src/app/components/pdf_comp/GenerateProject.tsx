'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { Rocket, Sparkles } from "lucide-react";

export default function GenerateProject({ persist_dir }: { persist_dir: string; documentId?: string }) {
    const [projects, setProjects] = useState<{ title: string; description: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;
        const generateProject = async () => {
            try {
                setLoading(true);
                setError("");
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
                const res = await axios.post(`${backendUrl}/askquestion`, {
                    question: "Suggest 3 unique project ideas based on this PDF. Return ONLY a JSON array of objects with keys 'title' and 'description'. No markdown fences.",
                    store: persist_dir,
                    mode: "ideas",
                });
                if (!mounted) return;
                const raw = String(res.data?.answer || "").replace(/```json/g, "").replace(/```/g, "").trim();
                let list: { title: string; description: string }[] = [];
                try {
                    const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || raw);
                    if (Array.isArray(parsed)) list = parsed.filter((p) => p && p.title && p.description);
                } catch {
                    list = [];
                }
                if (list.length === 0) {
                    setError("The AI's reply couldn't be read as project ideas.");
                }
                setProjects(list);
            } catch (err: any) {
                if (mounted) setError(err?.response?.data?.message || "Couldn't reach the document service.");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (persist_dir) {
            generateProject();
        }
        return () => { mounted = false; };
    }, [persist_dir, attempt]);

    return (
        <div className="h-full flex flex-col font-body text-white bg-[#070a12] rounded-2xl border border-[#0ea5e9]/25 overflow-hidden">
            <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#38bdf8] font-tag font-bold">
                    <Rocket className="w-3.5 h-3.5" /> [PROJECT INCUBATOR // BLUEPRINTS]
                </span>
                <span className="text-gray-400 text-[10px] font-tag">PRACTICAL BUILDS</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scroll bg-black/40">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Ideating project blueprints...</span>
                    </div>
                ) : error ? (
                    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm text-red-300">
                        <span>{error}</span>
                        <button onClick={() => setAttempt((n) => n + 1)} className="rounded-xl border border-[#38bdf8]/50 px-4 py-2 text-[#38bdf8] hover:bg-[#0ea5e9]/10 cursor-pointer">Try again</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-[11px] text-[#38bdf8] tracking-widest uppercase font-tag">
                            RECOMMENDED PRACTICAL PROJECTS:
                        </div>
                        {projects.map((item, index) => (
                            <div
                                key={index}
                                className="bg-[#0d1527] border border-[#16243f] hover:border-[#38bdf8] p-4 rounded-xl transition-all"
                            >
                                <div className="text-xs font-bold text-[#38bdf8] flex items-center gap-2 mb-1 font-tag">
                                    <Sparkles className="w-3 h-3" /> {item.title}
                                </div>
                                <div className="text-xs text-gray-300 leading-relaxed font-body">
                                    {item.description}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
