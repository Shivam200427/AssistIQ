'use client'

import React, { useRef, useState } from 'react'
import Back from '../components/Back'
import { FileUp, Loader2, SquareChevronRight, Upload, Paintbrush, CircleHelp, Gamepad2, Users } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import UploadDialog from '../components/Loading';
import { motion } from 'framer-motion';

const Page = () => {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [file, setfile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [prompt, setprompt] = useState("");
    const [showDialog, setShowDialog] = useState(false);
    const [status, setStatus] = useState<"loading" | "done">("loading");
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const handleclick = () => {
        fileRef.current?.click();
    };

    const handlefileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setfile(e.target.files[0]);
        }
    };

    const handleHostQuickArena = async () => {
        try {
            const res = await axios.post("/api/livequiz/create", {
                title: prompt.trim() || "Multiplayer Speed Battle",
            });
            if (res.data?.success && res.data?.pin) {
              localStorage.setItem(`livequiz_host_token_${res.data.pin}`, res.data.hostToken);
                router.push(`/quizgenerator/arena/${res.data.pin}?role=host`);
            }
        } catch (e: any) {
            alert("Could not start live arena: " + (e?.response?.data?.error || e.message));
        }
    };

    const handledrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setfile(e.dataTransfer.files[0]);
        }
    };

    const handledragover = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(true);
    };

    const handledragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
    };

    const handlegeneratequiz = async () => {
        if (!prompt.trim() && !file) {
            alert("Please enter a topic or upload a reference PDF.");
            return;
        }

        try {
            setIsGenerating(true);
            setShowDialog(true);
            setStatus("loading");

            const formdata = new FormData();
            formdata.append("prompt", prompt);
            if (file) {
                formdata.append("pdf", file);
            }

            const res = await axios.post('/api/quiz/generate', formdata, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setStatus("done");
            setTimeout(() => {
                router.push(`/quizgenerator/${res.data.quiz._id}`);
            }, 600);

        } catch (err: any) {
            console.error(err);
            setShowDialog(false);
            alert(err?.response?.data?.message || "Failed to generate quiz. Check server connection.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className='relative min-h-screen bg-[#070a12] text-white font-body py-10 px-4'>
            <Back />
            <input
                ref={fileRef}
                className='hidden'
                type='file'
                accept="application/pdf"
                onChange={handlefileChange}
            />

            <div className='flex flex-col justify-center items-center max-w-4xl mx-auto pt-10'>
                <motion.div
                    className='w-full rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow'
                    initial={{ opacity: 0, scale: 0.96, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="flex flex-col items-center rounded-3xl bg-[#0d1527] p-6 sm:p-10 border border-[#16243f] text-center">
                        {/* Tag Badge */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="font-tag text-xs tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 px-3.5 py-1 rounded-full border border-[#0ea5e9]/30 uppercase transform -rotate-1">
                                ✦ ARSENAL 03: QUIZ ARENA ✦
                            </span>
                        </div>

                        <h1 className='text-3xl sm:text-5xl font-extrabold text-white tracking-tight'>
                            Quiz <span className='font-tag text-[#38bdf8] spray-glow'>Generator</span>
                        </h1>
                        <p className='text-sm text-gray-300 mt-2 max-w-lg leading-relaxed'>
                            Test your recall with instant AI mock quizzes. Enter any curriculum concept or upload reference study notes.
                        </p>

                        {/* Multiplayer Live Arena Banner */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => router.push("/quizgenerator/join")}
                                className="px-4 py-2 bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/40 text-[#38bdf8] rounded-xl text-xs font-bold font-tag flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>JOIN WITH PIN</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleHostQuickArena}
                                className="px-4 py-2 bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] rounded-xl text-xs font-black font-tag flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                            >
                                <Gamepad2 className="w-3.5 h-3.5" />
                                <span>HOST LIVE ARENA</span>
                            </button>
                        </div>

                        {/* Prompt Input Box */}
                        <div className='text-left w-full mt-8 max-w-xl'>
                            <label className='text-xs font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-2 mb-2 font-tag'>
                                <SquareChevronRight className="w-4 h-4" /> Study Prompt / Topic:
                            </label>
                            <input
                                className='w-full p-3.5 bg-black/50 border border-[#16243f] focus:border-[#38bdf8] outline-none rounded-2xl text-xs sm:text-sm text-white placeholder-gray-500 transition-colors'
                                placeholder='Ex: Neural Network backpropagation, activation functions, and gradient descent'
                                value={prompt}
                                onChange={(e) => setprompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlegeneratequiz()}
                            />
                        </div>

                        {/* Optional PDF Box */}
                        <div className='w-full max-w-xl my-6 text-left'>
                            <label className='text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2 mb-2'>
                                <Upload className="w-4 h-4 text-[#38bdf8]" /> Reference PDF Document (Optional):
                            </label>
                            <div
                                className={`w-full h-[140px] cursor-pointer flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 ${
                                    dragging
                                        ? "border-[#38bdf8] bg-[#0ea5e9]/20 scale-[1.01]"
                                        : file
                                        ? "border-[#0ea5e9] bg-[#0ea5e9]/10"
                                        : "border-[#16243f] bg-black/40 hover:border-[#0ea5e9]/50 hover:bg-[#11192e]"
                                }`}
                                onClick={handleclick}
                                onDrop={handledrop}
                                onDragOver={handledragover}
                                onDragLeave={handledragLeave}
                            >
                                {file ? (
                                    <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                                        <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/20 border border-[#0ea5e9] flex items-center justify-center text-[#38bdf8]">
                                            <FileUp className="w-5 h-5" />
                                        </div>
                                        <span className='font-bold text-white text-xs sm:text-sm max-w-md truncate'>
                                            {file.name}
                                        </span>
                                        <span className='text-[10px] text-[#38bdf8] font-tag'>ATTACHED TO QUIZ CONTEXT</span>
                                    </div>
                                ) : (
                                    <div className='flex flex-col items-center gap-2 p-3 text-center'>
                                        <FileUp className="w-8 h-8 text-[#38bdf8]/70" />
                                        <p className='text-xs text-gray-300'>
                                            Click to attach or drag & drop reference PDF
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            className="w-full max-w-xl flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-extrabold uppercase tracking-wider py-4 px-8 text-sm shadow-[0_4px_25px_rgba(14,165,233,0.35)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-tag"
                            onClick={handlegeneratequiz}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-[#070a12]" /> : <CircleHelp className="h-4 w-4 text-[#070a12]" />}
                            <span>{isGenerating ? "CRAFTING QUIZ..." : "GENERATE QUIZ // START TEST"}</span>
                        </button>
                    </div>
                </motion.div>
            </div>

            <UploadDialog
                show={showDialog}
                onClose={() => setShowDialog(false)}
                status={status}
                title="Generating Your Quiz..."
                subtitle="Generating active recall questions, distractors, and answer keys..."
            />
        </div>
    )
}

export default Page
