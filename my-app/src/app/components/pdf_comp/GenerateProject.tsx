'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { Rocket, Sparkles } from "lucide-react";

export default function GenerateProject({ persist_dir }: { persist_dir: string }) {
    const [projects, setProjects] = useState<{ title: string; description: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const generateProject = async () => {
            try {
                setLoading(true);
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
                const res = await axios.post(`${backendUrl}/askquestion`, {
                    question: "Suggest 3 unique project ideas based on this PDF. Return ONLY a JSON array of objects with keys 'title' and 'description'. No markdown fences.",
                    store: persist_dir
                });
                if (mounted) {
                    const raw = res.data?.answer;
                    let list: { title: string; description: string }[] = [];
                    if (Array.isArray(raw)) {
                        list = raw;
                    } else if (typeof raw === "string") {
                        try {
                            const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
                            const parsed = JSON.parse(cleaned);
                            if (Array.isArray(parsed)) list = parsed;
                        } catch {
                            list = [
                                { title: "Automated Domain Knowledge Pipeline", description: raw.slice(0, 200) }
                            ];
                        }
                    }
                    if (list.length === 0) {
                        list = [
                            { title: "Smart Study Assistant", description: "Build an interactive platform leveraging this PDF's concepts with automated testing and flashcards." },
                            { title: "Real-time Concept Graph Engine", description: "Develop a visual knowledge graph modeling relationships extracted from this curriculum." }
                        ];
                    }
                    setProjects(list);
                }
            } catch (err) {
                if (mounted) {
                    setProjects([
                        { title: "Smart Document Intelligence System", description: "Implement vector search and interactive Q&A over lecture resources." },
                        { title: "Concept Visualizer Application", description: "Interactive web dashboard visualizing key topic hierarchies." }
                    ]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (persist_dir) {
            generateProject();
        }
        return () => { mounted = false; };
    }, [persist_dir]);

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
