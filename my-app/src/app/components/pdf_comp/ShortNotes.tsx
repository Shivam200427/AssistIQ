'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import { Copy, Check, FileText } from "lucide-react";

export default function ShortNotes({ persist_dir }: { persist_dir: string }) {
    const [notes, setNotes] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const generateNotes = async () => {
            try {
                setLoading(true);
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
                const res = await axios.post(`${backendUrl}/askquestion`, {
                    question: "Give me short notes of this whole PDF in bullet points. Give structured headings and bullet takeaways. Clean formatting.",
                    store: persist_dir
                });
                if (mounted) {
                    setNotes(res.data.answer || "No notes generated.");
                }
            } catch (err: any) {
                if (mounted) {
                    setNotes("⚠️ Failed to generate short notes. Check that backend is running.");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (persist_dir) {
            generateNotes();
        }
        return () => { mounted = false; };
    }, [persist_dir]);

    const handleCopy = () => {
        navigator.clipboard.writeText(notes);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full flex flex-col font-body text-white bg-[#070a12] rounded-2xl border border-[#0ea5e9]/25 overflow-hidden">
            <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#38bdf8] font-tag font-bold">
                    <FileText className="w-3.5 h-3.5" /> [SHORT NOTES // DIGEST]
                </span>
                {notes && (
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[11px] text-[#38bdf8] hover:underline font-tag"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "COPIED" : "COPY NOTES"}
                    </button>
                )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scroll bg-black/40">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Synthesizing short notes...</span>
                    </div>
                ) : (
                    <div className="bg-[#0d1527] p-4 rounded-2xl border border-[#16243f] text-xs leading-relaxed text-gray-200 whitespace-pre-line">
                        {notes}
                    </div>
                )}
            </div>
        </div>
    );
}
