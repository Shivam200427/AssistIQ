"use client";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

const features = [
  {
    id: "pdf",
    tag: "01",
    streetName: "PDF Notes",
    name: "PDF Notes",
    desc: "Upload a PDF to get study notes that cite their pages, a chat that answers only from your document, a concept map and quizzes built from it.",
    img: "/graffiti-pdf.jpg",
    url: "/pdfNotesExtractor",
    accent: "#0ea5e9",
    badge: "Start here",
    stickerColor: "bg-[#0284c7]",
    pills: ["Cited notes", "Chat with your PDF", "Concept map"],
    rotation: "rotate-1",
  },
  {
    id: "quiz",
    tag: "02",
    streetName: "Quiz Generator",
    name: "Quiz Generator",
    desc: "Practise with multiple-choice quizzes on any topic or your own PDF, choose difficulty and length, review explanations and retake any time.",
    img: "/graffiti-quiz.jpg",
    url: "/quizgenerator",
    accent: "#60a5fa",
    badge: "Practice",
    stickerColor: "bg-[#2563eb]",
    pills: ["From your PDF", "Difficulty & length", "Live multiplayer"],
    rotation: "-rotate-1",
  },
  {
    id: "email",
    tag: "03",
    streetName: "Email Summary",
    name: "Email Summary",
    desc: "Connect Outlook to get short summaries of long emails, suggested replies, and deadlines you can review and add to your calendar.",
    img: "/graffiti-email.jpg",
    url: "/EmailSummarizer",
    accent: "#38bdf8",
    badge: "Outlook",
    stickerColor: "bg-[#0ea5e9]",
    pills: ["Summaries", "Reply drafts", "Deadlines"],
    rotation: "-rotate-2",
  },
  {
    id: "planly",
    tag: "04",
    streetName: "Study Planner",
    name: "Study Planner",
    desc: "Planly: Pomodoro and study timers, a task board with AI planning, calendar, streaks, notes, habits and focus sounds.",
    img: "/graffiti-planly.svg",
    url: "/planly",
    accent: "#38bdf8",
    badge: "Planly",
    stickerColor: "bg-[#0ea5e9]",
    pills: ["Timers", "Task board", "Streaks & habits"],
    rotation: "rotate-1",
  },
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
