'use client'

import React, { useRef, useState } from 'react'
import Back from '../components/Back'
import { FileUp, Loader2, Upload, CircleHelp, Gamepad2, Users, X } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ProcessDialog, { type ProcessStep } from '../components/ProcessDialog';
import { MAX_PDF_BYTES, MAX_PDF_MB } from '../api/utils/upload';

const MAX_MB = MAX_PDF_MB;

type Run = {
    steps: ProcessStep[];
    error?: string;
    fallbackAvailable?: boolean;
    signIn?: boolean;
};

const Page = () => {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [file, setfile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [prompt, setprompt] = useState("");
    const [difficulty, setDifficulty] = useState("mixed");
    const [count, setCount] = useState(5);
    const [run, setRun] = useState<Run | null>(null);
    const [fileError, setFileError] = useState("");
    const router = useRouter();

    const pickFile = (f: File | undefined | null) => {
        if (!f) return;
        if (f.type && f.type !== "application/pdf") return setFileError("Only PDF files are supported.");
        if (f.size > MAX_PDF_BYTES) return setFileError(`This PDF is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
        setFileError("");
        setfile(f);
    };

    const handleHostQuickArena = async () => {
        try {
            const res = await axios.post("/api/livequiz/create", { title: prompt.trim() || "Multiplayer Speed Battle" });
            if (res.data?.success && res.data?.pin) {
                localStorage.setItem(`livequiz_host_token_${res.data.pin}`, res.data.hostToken);
                router.push(`/quizgenerator/arena/${res.data.pin}?role=host`);
            }
        } catch (e: any) {
            alert("Could not start live quiz: " + (e?.response?.data?.error || e.message));
        }
    };

    const generate = async (allowTopicFallback = false) => {
        if (!prompt.trim() && !file) {
            setFileError("Enter a topic or attach a PDF.");
            return;
        }
        const usingPdf = !!file && !allowTopicFallback;
        const label = usingPdf
            ? `Uploading your PDF and writing ${count} questions from it`
            : `Writing ${count} questions about “${prompt.trim()}”`;
        setRun({ steps: [{ label, status: "active" }, { label: "Checking every question has a real answer key", status: "pending" }] });

        try {
            const formdata = new FormData();
            formdata.append("prompt", prompt.trim());
            formdata.append("difficulty", difficulty);
            formdata.append("count", String(count));
            if (file) formdata.append("pdf", file);
            if (allowTopicFallback) formdata.append("allowTopicFallback", "true");

            const res = await axios.post('/api/quiz/generate', formdata);
            const dropped = res.data?.dropped || 0;
            setRun({
                steps: [
                    { label, status: "done" },
                    {
                        label: "Checking every question has a real answer key",
                        status: "done",
                        detail: dropped ? `${dropped} question${dropped > 1 ? "s were" : " was"} removed because they were incomplete.` : undefined,
                    },
                ],
            });
            router.push(`/quizgenerator/${res.data.quiz._id}`);
        } catch (err: any) {
            const data = err?.response?.data || {};
            const message =
                data.message ||
                (err?.code === "ERR_NETWORK" ? "Can't reach the server. Check your connection and try again." : "Quiz generation failed. Please try again.");
            setRun({
                steps: [
                    { label, status: data.stage === "validate" ? "done" : "failed" },
                    { label: "Checking every question has a real answer key", status: data.stage === "validate" ? "failed" : "pending" },
                ],
                error: message,
                fallbackAvailable: !!data.fallbackAvailable,
                signIn: err?.response?.status === 401,
            });
        }
    };

    const runActions = run && !run.steps.some((s) => s.status === "active")
        ? [
            ...(run.signIn
                ? [{ label: "Sign in with Microsoft", primary: true, onClick: () => (window.location.href = "/api/auth/callback?redirect=/quizgenerator") }]
                : [{ label: "Try again", primary: true, onClick: () => generate(false) }]),
            ...(run.fallbackAvailable
                ? [{ label: "Make a topic-only quiz instead (won't use my PDF)", onClick: () => generate(true) }]
                : []),
            { label: "Close", onClick: () => setRun(null) },
        ]
        : [];

    return (
        <div className='relative min-h-screen bg-[#070a12] text-white font-body py-10 px-4'>
            <Back />
            <input ref={fileRef} className='hidden' type='file' accept="application/pdf" onChange={(e) => pickFile(e.target.files?.[0])} />

            <div className='flex flex-col justify-center items-center max-w-4xl mx-auto pt-10'>
                <motion.div
                    className='w-full rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow'
                    initial={{ opacity: 0, scale: 0.96, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="flex flex-col items-center rounded-3xl bg-[#0d1527] p-6 sm:p-10 border border-[#16243f] text-center">
                        <h1 className='text-3xl sm:text-5xl font-extrabold text-white tracking-tight'>
                            Quiz <span className='font-tag text-[#38bdf8] spray-glow'>Generator</span>
                        </h1>
                        <p className='text-sm text-gray-300 mt-2 max-w-lg leading-relaxed'>
                            Practise with AI-written multiple-choice questions on any topic, or on your own PDF.
                        </p>

                        <div className='text-left w-full mt-8 max-w-xl'>
                            <label htmlFor="quiz-topic" className='text-sm font-semibold text-gray-200 mb-2 block'>Topic</label>
                            <input
                                id="quiz-topic"
                                className='w-full p-3.5 bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-2xl text-sm text-white placeholder-gray-500 transition-colors'
                                placeholder='e.g. Backpropagation and gradient descent'
                                value={prompt}
                                onChange={(e) => setprompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && generate()}
                            />
                        </div>

                        <div className='grid w-full max-w-xl grid-cols-2 gap-3 mt-4 text-left'>
                            <label className='text-sm font-semibold text-gray-200'>
                                Difficulty
                                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className='mt-2 w-full rounded-2xl border border-[#16243f] bg-black/50 p-3 text-sm text-white outline-none focus:border-[#38bdf8] cursor-pointer'>
                                    <option value="mixed">Mixed</option>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </label>
                            <label className='text-sm font-semibold text-gray-200'>
                                Questions
                                <select value={count} onChange={(e) => setCount(Number(e.target.value))} className='mt-2 w-full rounded-2xl border border-[#16243f] bg-black/50 p-3 text-sm text-white outline-none focus:border-[#38bdf8] cursor-pointer'>
                                    {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </label>
                        </div>

                        <div className='w-full max-w-xl my-6 text-left'>
                            <span className='text-sm font-semibold text-gray-200 flex items-center gap-2 mb-2'>
                                <Upload className="w-4 h-4 text-[#38bdf8]" /> Your PDF (optional — questions will come only from it)
                            </span>
                            <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                                className={`w-full h-[130px] cursor-pointer flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 ${dragging ? "border-[#38bdf8] bg-[#0ea5e9]/20" : file ? "border-[#0ea5e9] bg-[#0ea5e9]/10" : "border-[#16243f] bg-black/40 hover:border-[#0ea5e9]/50"}`}
                                onClick={() => fileRef.current?.click()}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                            >
                                {file ? (
                                    <div className="flex items-center gap-3 p-3">
                                        <FileUp className="w-6 h-6 text-[#38bdf8]" />
                                        <span className='font-semibold text-white text-sm max-w-[240px] truncate'>{file.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setfile(null); }}
                                            className="rounded-lg p-1 text-gray-400 hover:text-white cursor-pointer"
                                            aria-label="Remove PDF"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className='flex flex-col items-center gap-2 p-3 text-center'>
                                        <FileUp className="w-7 h-7 text-[#38bdf8]/70" />
                                        <p className='text-sm text-gray-300'>Click or drop a PDF here</p>
                                        <p className='text-xs text-gray-500'>PDF only, up to {MAX_MB} MB</p>
                                    </div>
                                )}
                            </div>
                            {fileError && <p role="alert" className="mt-2 text-sm text-red-300">{fileError}</p>}
                        </div>

                        <button
                            className="w-full max-w-xl flex items-center justify-center gap-2 rounded-2xl bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#070a12] font-bold py-4 px-8 text-base shadow-[0_4px_25px_rgba(14,165,233,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            onClick={() => generate()}
                            disabled={!!run?.steps.some((s) => s.status === "active")}
                        >
                            {run?.steps.some((s) => s.status === "active") ? <Loader2 className="h-5 w-5 animate-spin" /> : <CircleHelp className="h-5 w-5" />}
                            <span>Generate quiz</span>
                        </button>

                        {/* Secondary: live multiplayer */}
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
                            <span className="text-gray-400">Live quiz with friends:</span>
                            <button type="button" onClick={() => router.push("/quizgenerator/join")} className="px-3 py-1.5 border border-[#16243f] hover:border-[#38bdf8]/60 text-gray-200 rounded-xl flex items-center gap-1.5 cursor-pointer">
                                <Users className="w-4 h-4" /> Join with PIN
                            </button>
                            <button type="button" onClick={handleHostQuickArena} className="px-3 py-1.5 border border-[#16243f] hover:border-[#38bdf8]/60 text-gray-200 rounded-xl flex items-center gap-1.5 cursor-pointer">
                                <Gamepad2 className="w-4 h-4" /> Host a live quiz
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>

            <ProcessDialog
                show={!!run}
                title="Making your quiz"
                steps={run?.steps || []}
                error={run?.error}
                actions={runActions}
                onClose={() => setRun(null)}
            />
        </div>
    )
}

export default Page
