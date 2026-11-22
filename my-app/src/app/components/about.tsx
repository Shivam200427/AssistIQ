"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Paintbrush, Target, ShieldCheck, Sparkles } from "lucide-react";

const AboutUs = () => {
  const [rotate, setRotate] = useState(0);

  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width / 2;
    setRotate(x > width ? 6 : -6);
  };

  const handleMouseLeave = () => setRotate(0);

  return (
    <motion.div
      onMouseMove={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateY: rotate }}
      transition={{ type: "spring", stiffness: 180, damping: 15 }}
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
      }}
      className="bg-gradient-to-br from-[#0ea5e9]/40 via-[#16243f] to-[#070a12] max-w-[680px] w-full rounded-3xl p-[2px] card-spray-shadow card-spray-hover"
    >
      <div className="bg-[#0d1527] w-full h-full rounded-3xl flex flex-col justify-center items-center text-center p-8 md:p-12 border border-[#16243f] relative overflow-hidden">
        
        {/* Subtle blue spray flare */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#0ea5e9]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(14,165,233,0.4)] transform -rotate-3">
          <Paintbrush className="w-7 h-7 text-[#070a12]" />
        </div>

        <div className="font-tag text-xs tracking-wider text-[#38bdf8] uppercase bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 px-3.5 py-1 rounded-full mb-3 transform rotate-1">
          ✦ THE STREET MANIFESTO ✦
        </div>

        <h2 className="text-3xl md:text-4xl font-extrabold mb-3 text-white font-body">
          About <span className="font-tag text-[#38bdf8] spray-glow">AssistIQ</span>
        </h2>

        <p className="text-gray-300 text-sm md:text-base leading-relaxed max-w-lg mb-8 font-body">
          AssistIQ is academic intelligence inspired by street art: raw, fast, and authentic.
          We cut away bloated enterprise features to leave only the 3 essential superpowers:
          zero-effort email digests, instant PDF notes extraction with interactive RAG chat,
          and high-speed active-recall quiz generation.
        </p>

        <div className="grid grid-cols-3 gap-4 w-full pt-6 border-t border-[#16243f]">
          <div className="flex flex-col items-center p-3.5 rounded-xl bg-black/40 border border-[#0ea5e9]/20">
            <Sparkles size={20} className="text-[#38bdf8] mb-1.5" />
            <p className="text-xs font-bold text-gray-200">Zero Bloat</p>
            <p className="text-[10px] text-gray-400 mt-0.5">4 study tools</p>
          </div>
          <div className="flex flex-col items-center p-3.5 rounded-xl bg-black/40 border border-[#0ea5e9]/20">
            <Target size={20} className="text-[#38bdf8] mb-1.5" />
            <p className="text-xs font-bold text-gray-200">RAG Precision</p>
            <p className="text-[10px] text-gray-400 mt-0.5">ChromaDB + LLM</p>
          </div>
          <div className="flex flex-col items-center p-3.5 rounded-xl bg-black/40 border border-[#0ea5e9]/20">
            <ShieldCheck size={20} className="text-[#38bdf8] mb-1.5" />
            <p className="text-xs font-bold text-gray-200">Secure Sync</p>
            <p className="text-[10px] text-gray-400 mt-0.5">MS Graph + S3</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AboutUs;
