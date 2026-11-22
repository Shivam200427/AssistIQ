"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const Back = ({ label = "Back to AssistIQ", className = "" }) => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/home")}
      className={`fixed z-50 left-6 top-20 text-[#38bdf8] bg-[#070a12]/95 border border-[#0ea5e9]/40 hover:bg-[#0ea5e9] hover:text-[#070a12] flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm tracking-wider backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_25px_#0ea5e9] transition-all duration-200 cursor-pointer ${className}`}
    >
      <ArrowLeft size={16} />
      <span>{label}</span>
    </button>
  );
};

export default Back;
