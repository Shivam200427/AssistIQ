"use client";
import React, { useState } from "react";
import { features } from "./feature";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Paintbrush, Sparkles } from "lucide-react";

const FeatureCard = () => {
  const [activeIdx, setActiveIdx] = useState(-1);
  const router = useRouter();

  const handleClick = (url: string | null) => {
    if (!url) return;
    router.push(url);
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 sm:gap-10 justify-items-center max-w-7xl mx-auto px-2">
      {features.map((feat, index) => {
        const isHovered = activeIdx === index;
        return (
          <motion.div
            key={feat.id || index}
            onMouseEnter={() => setActiveIdx(index)}
            onMouseLeave={() => setActiveIdx(-1)}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className={`w-full max-w-[400px] rounded-3xl p-[2px] transition-all duration-300 cursor-pointer relative group ${feat.rotation} hover:rotate-0 hover:scale-[1.03]`}
            onClick={() => handleClick(feat.url)}
          >
            {/* Outer Electric Blue Spray Glow Frame */}
            <div className={`w-full h-full rounded-3xl p-[2px] transition-all duration-300 ${
              isHovered
                ? "bg-gradient-to-b from-[#38bdf8] via-[#0ea5e9] to-[#2563eb] shadow-[0_15px_45px_rgba(14,165,233,0.4)]"
                : "bg-gradient-to-b from-[#0ea5e9]/40 via-[#16243f] to-[#070a12] card-spray-shadow"
            }`}>

              {/* Main Wheatpaste Poster Body */}
              <div className="w-full h-full bg-[#0d1527] rounded-3xl p-6 flex flex-col justify-between border border-[#16243f] relative overflow-hidden">
                
                {/* Street Art Tape Corner Marks */}
                <div className="absolute -top-1 left-6 w-12 h-3.5 bg-white/15 backdrop-blur-md border border-white/20 transform -rotate-6 pointer-events-none rounded-sm shadow-sm" />
                <div className="absolute -top-1 right-6 w-12 h-3.5 bg-white/15 backdrop-blur-md border border-white/20 transform rotate-6 pointer-events-none rounded-sm shadow-sm" />

                {/* Ambient Blue Spray Background Glow */}
                <div className="absolute -top-20 -right-20 w-44 h-44 bg-[#0ea5e9]/15 rounded-full blur-3xl group-hover:bg-[#38bdf8]/25 transition-all pointer-events-none" />

                <div>
                  {/* Top Bar: Stencil Tag & Badge */}
                  <div className="flex justify-between items-center mb-4 pt-1">
                    <span className="font-tag text-xs px-3 py-1 rounded-full bg-[#0ea5e9]/15 text-[#38bdf8] border border-[#0ea5e9]/30 flex items-center gap-1.5 shadow-sm">
                      <Paintbrush className="w-3 h-3 text-[#38bdf8]" />
                      <span>{feat.tag}</span>
                    </span>
                    <span className="font-stencil text-[10px] tracking-widest text-gray-400 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                      {feat.badge}
                    </span>
                  </div>

                  {/* High-Impact Street Art Graffiti Card Illustration */}
                  <div className="relative w-full h-[220px] rounded-2xl overflow-hidden mb-5 border border-[#16243f] group-hover:border-[#38bdf8]/50 transition-all shadow-inner bg-black">
                    <img
                      src={feat.img}
                      alt={feat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    {/* Blue gradient vignette over the art */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1527] via-transparent to-transparent opacity-80" />

                    {/* Street Name Sticker Stamp in Image */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <span className="font-tag text-lg sm:text-xl text-white spray-glow transform -rotate-1 bg-[#070a12]/85 backdrop-blur-md px-3 py-1 rounded-xl border border-[#0ea5e9]/40">
                        ✦ {feat.streetName}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-white text-2xl font-extrabold tracking-tight group-hover:text-[#38bdf8] transition-colors flex items-center justify-between font-body">
                    <span>{feat.name}</span>
                    <div className="w-9 h-9 rounded-xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center text-[#38bdf8] group-hover:bg-[#0ea5e9] group-hover:text-[#070a12] transition-all transform group-hover:scale-110">
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </h3>

                  <p className="text-gray-300 text-xs sm:text-sm mt-2.5 leading-relaxed font-body">
                    {feat.desc}
                  </p>

                  {/* Feature Sticker Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {feat.pills.map((pill, pIdx) => (
                      <span
                        key={pIdx}
                        className="text-[10px] font-bold text-gray-300 bg-black/50 border border-[#16243f] px-2.5 py-1 rounded-lg group-hover:border-[#0ea5e9]/40 transition-colors"
                      >
                        ✓ {pill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-6 pt-4 border-t border-[#16243f] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 uppercase font-body">
                    <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" /> ZERO BLOAT
                  </span>
                  <span className="font-tag text-xs sm:text-sm text-[#38bdf8] group-hover:underline tracking-wider">
                    SLAP TO LAUNCH →
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default FeatureCard;
