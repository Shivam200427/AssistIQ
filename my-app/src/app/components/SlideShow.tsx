"use client";
import React from "react";
import { motion } from "framer-motion";
import { Paintbrush } from "lucide-react";

const tags = [
  "EMAIL SUMMARIZER",
  "PDF NOTES EXTRACTOR",
  "QUIZ GENERATOR",
  "ASSISTIQ",
  "STREET ACADEMICS",
  "NO BLOAT",
  "RAG TUTOR",
  "STREET SMART",
];

const SlideShow = () => {
  const tickerItems = [...tags, ...tags, ...tags];

  return (
    <div className="relative w-full h-[64px] flex justify-center items-center overflow-hidden bg-[#080e1a] border-y border-[#0ea5e9]/30 my-10 shadow-[inset_0_0_20px_rgba(0,0,0,0.7)]">
      {/* Edge Gradient Fades */}
      <div className="pointer-events-none w-full absolute inset-0 flex justify-between items-center z-10">
        <div className="w-28 h-full bg-gradient-to-r from-[#070a12] to-transparent" />
        <div className="w-28 h-full bg-gradient-to-l from-[#070a12] to-transparent" />
      </div>

      {/* Sliding Track */}
      <div className="w-full overflow-hidden">
        <motion.div
          className="flex items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {tickerItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-6 text-center whitespace-nowrap"
            >
              <Paintbrush className="w-4 h-4 text-[#38bdf8]" />
              <span className="font-tag text-base md:text-lg text-white hover:text-[#38bdf8] transition-colors tracking-wide">
                {item}
              </span>
              <span className="text-[#0ea5e9]/50 text-sm font-bold ml-2">✦</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default SlideShow;
