"use client";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

const features = [
  {
    id: "email",
    tag: "STENCIL // 01",
    streetName: "INBOX SNIPER",
    name: "Email Summarizer",
    desc: "Slice through bloated lecture threads and announcements with rapid AI summaries, auto-draft replies, and instant calendar deadline sync.",
    img: "/graffiti-email.jpg",
    url: "/EmailSummarizer",
    accent: "#38bdf8",
    badge: "STREET INTEL",
    stickerColor: "bg-[#0ea5e9]",
    pills: ["TL;DR Digest", "Auto-Draft Reply", "Calendar Sync"],
    rotation: "-rotate-2",
  },
  {
    id: "pdf",
    tag: "WILDSTYLE // 02",
    streetName: "DOC WILDSTYLE",
    name: "PDF Notes Extractor",
    desc: "Transform dense handouts and slide decks into crisp structured notes with interactive AI chat, knowledge graphs, and study blueprints.",
    img: "/graffiti-pdf.jpg",
    url: "/pdfNotesExtractor",
    accent: "#0ea5e9",
    badge: "RAG ENGINE",
    stickerColor: "bg-[#0284c7]",
    pills: ["Interactive RAG Chat", "Mind Mapping", "Study Digest"],
    rotation: "rotate-1",
  },
  {
    id: "quiz",
    tag: "ARENA // 03",
    streetName: "QUIZ ARENA",
    name: "Quiz Generator",
    desc: "Test your mastery on the street with instant custom practice quizzes, high-yield options, real-time score tracking, and answer breakdowns.",
    img: "/graffiti-quiz.jpg",
    url: "/quizgenerator",
    accent: "#60a5fa",
    badge: "BATTLE TEST",
    stickerColor: "bg-[#2563eb]",
    pills: ["Active Recall", "Instant Distractors", "Accuracy Meter"],
    rotation: "-rotate-1",
  }
];

const GreenCircle = () => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0.15, 0.32, 0.15],
          scale: [0.95, 1.15, 0.95],
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="bg-[#0ea5e9] h-[340px] w-[340px] rounded-full blur-[130px] pointer-events-none z-10"
      />
    </AnimatePresence>
  );
};

const PurpleCircle = () => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0.1, 0.25, 0.1],
          scale: [1, 1.2, 1],
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          duration: 7,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="bg-[#38bdf8] h-[300px] w-[300px] rounded-full blur-[120px] pointer-events-none z-10"
      />
    </AnimatePresence>
  );
};

export { GreenCircle, PurpleCircle, features };
