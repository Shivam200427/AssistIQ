"use client";
import React from "react";
import SlideShow from "../components/SlideShow";
import { GreenCircle, PurpleCircle, features } from "../components/feature";
import FeatureCard from "../components/cards";
import AboutUs from "../components/about";
import ContactUs from "../components/ContactUs";
import { motion } from "framer-motion";
import { Paintbrush, ArrowDown, Sparkles, BookOpen, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const router = useRouter();

  const handleScrollToFeatures = () => {
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="bg-[#070a12] min-h-screen text-white font-body w-full relative overflow-x-hidden">
      {/* Background Soft Blue & Cyan Spray Glows */}
      <div className="absolute top-12 left-10 pointer-events-none">
        <GreenCircle />
      </div>
      <div className="absolute top-[400px] right-10 pointer-events-none">
        <PurpleCircle />
      </div>

      {/* Hero Section: Asymmetric Street Graffiti Alley */}
      <section
        id="home"
        className="relative w-full pt-14 pb-16 px-6 lg:px-12 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12"
      >
        {/* Left Column: Explosive Graffiti Manifesto */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="flex-1 flex flex-col items-start text-left"
        >
          {/* Iconic Street Art Slap Sticker */}
          <div className="mb-6 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <div className="graffiti-sticker px-4 py-1.5 border-2 border-black/90 shadow-[4px_5px_0px_rgba(0,0,0,0.7)] flex items-center gap-2.5">
              <span className="bg-[#ef4444] text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider font-body">
                HELLO
              </span>
              <span className="text-sm font-tag text-[#070a12] tracking-wide">
                my name is <span className="text-[#0284c7] font-black">AssistIQ</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400 pl-2 border-l border-gray-300">
                #2026
              </span>
            </div>
          </div>

          {/* Giant Street Graffiti Title */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight uppercase leading-[0.98] text-white">
            STREET-SMART <br />
            <span className="font-tag text-transparent bg-clip-text bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0ea5e9] spray-glow tracking-wider inline-block transform -rotate-1 mt-1">
              ACADEMICS.
            </span>
          </h1>

          <p className="text-gray-300 text-base sm:text-lg max-w-xl mt-5 leading-relaxed font-body">
            Raw, focused academic intelligence. We scrapped the corporate clutter and built only the 3 mission-critical weapons you need to dominate your coursework.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-8">
            <button
              onClick={handleScrollToFeatures}
              className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-[#070a12] hover:from-[#7dd3fc] hover:to-[#38bdf8] font-extrabold text-sm uppercase tracking-wider px-7 py-3.5 rounded-2xl shadow-[0_4px_25px_rgba(14,165,233,0.4)] transition-all flex items-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5 font-tag"
            >
              <span>SPRAY THE 3 ARSENALS</span>
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/pdfNotesExtractor")}
              className="border-2 border-[#0ea5e9]/40 bg-[#0d1527] text-[#38bdf8] hover:bg-[#0ea5e9]/15 font-bold text-sm tracking-wide px-6 py-3.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              <BookOpen className="w-4 h-4 text-[#38bdf8]" />
              <span>LAUNCH DOC WILDSTYLE</span>
            </button>
          </div>

          {/* Live Street Specs Bar */}
          <div className="mt-8 pt-6 border-t border-[#16243f] flex items-center gap-6 text-xs text-gray-400 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
              <span className="text-gray-300 font-bold font-tag">3 ARSENALS READY</span>
            </div>
            <span>•</span>
            <span>ZERO BLOAT</span>
            <span>•</span>
            <span>CHROMA RAG + LLM</span>
          </div>
        </motion.div>

        {/* Right Column: Live Street Art Weapon HUD */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="w-full lg:w-[460px] rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow"
        >
          <div className="bg-[#0d1527] rounded-3xl p-6 sm:p-7 border border-[#16243f] relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#16243f] mb-4">
              <span className="font-tag text-xs text-[#38bdf8] flex items-center gap-2">
                <Paintbrush className="w-4 h-4" /> STREET ARSENAL HUD
              </span>
              <span className="font-stencil text-[10px] text-gray-400 tracking-widest bg-black/60 px-2 py-0.5 rounded border border-white/10 uppercase">
                v2.6 LIVE
              </span>
            </div>

            {/* Quick Interactive Arsenal Selector */}
            <div className="space-y-3">
              {features.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(item.url)}
                  className="group p-3.5 rounded-2xl bg-black/40 border border-[#16243f] hover:border-[#38bdf8]/60 hover:bg-[#131e36] transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#16243f] group-hover:border-[#38bdf8] transition-colors relative flex-shrink-0 bg-black">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div>
                      <div className="font-tag text-sm text-white group-hover:text-[#38bdf8] transition-colors">
                        {item.streetName}
                      </div>
                      <div className="text-xs text-gray-400 font-body line-clamp-1">
                        {item.name}
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/15 flex items-center justify-center text-[#38bdf8] group-hover:bg-[#0ea5e9] group-hover:text-[#070a12] transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>

            {/* Mini Street Art Stencil Banner */}
            <div className="mt-5 pt-4 border-t border-[#16243f] flex items-center justify-between text-xs text-gray-400 font-body">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" /> Tap any piece to launch
              </span>
              <span className="font-tag text-[#38bdf8] text-xs">
                INSTANT AI →
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Graffiti Running Ribbon / Ticker */}
      <SlideShow />

      {/* The 3 Core Services Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="flex flex-col justify-center items-center mb-14 text-center gap-3">
          <div className="font-tag text-xs tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 px-3.5 py-1 rounded-full uppercase transform -rotate-1">
            ✦ AUTHENTIC STREET ARSENALS ✦
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-body">
            The 3 Street Masterpieces
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mt-1 font-body">
            Custom-built academic intelligence tools to crush your emails, documents, and mock exams.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <FeatureCard />
      </section>

      {/* About Us Manifesto Section */}
      <section id="about" className="max-w-5xl mx-auto px-6 py-16 flex flex-col justify-center items-center">
        <AboutUs />
      </section>

      {/* Contact Section */}
      <section id="contact" className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="font-tag text-xs tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 px-3.5 py-1 rounded-full inline-block uppercase transform rotate-1 mb-3">
            ✦ DISPATCH THE CREW ✦
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Get In Touch
          </h2>
        </div>
        <ContactUs />
      </section>
    </div>
  );
};

export default HomePage;
