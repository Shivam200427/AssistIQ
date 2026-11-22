"use client";

import { motion } from "framer-motion";
import { AlertCircle, FileUp, Loader2, Upload, Paintbrush, BookOpen } from "lucide-react";
import React, { useRef, useState } from "react";
import axios from "axios";

import Back from "../components/Back";
import UploadDialog from "../components/Loading";
import PdfViewer from "../components/pdfViewer";

const steps = [
  { step: "01", title: "DROP PDF", desc: "Upload lecture slides, handouts, or notes PDF" },
  { step: "02", title: "RAG OCR", desc: "Text is extracted, chunked, and indexed into vector DB" },
  { step: "03", title: "STUDY SUITE", desc: "Open interactive notes with AI Chat and quick tools" },
];

const Page = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfLink, setPdfLink] = useState("");
  const [persistDir, setPersistDir] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setError("");
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setError("");
    }
  };

  const handleGetNotes = async () => {
    if (!file) {
      setError("Please select or drop a PDF file first.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      setShowDialog(true);
      setStatus("loading");

      const formdata = new FormData();
      formdata.append("pdf", file);

      const response = await axios.post("/api/uploadpdf", formdata, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("done");
      setPersistDir(response.data.persist || "");
      setTimeout(() => {
        setPdfLink(response.data.link);
      }, 700);
    } catch (err: any) {
      setShowDialog(false);
      setError(err?.response?.data?.message || err.message || "We could not generate notes from this PDF.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pdfLink) {
    return <PdfViewer pdfurl={pdfLink} initialPersistDir={persistDir} />;
  }

  return (
    <div className="relative min-h-screen bg-[#070a12] text-white font-body py-10 px-4">
      <Back />
      <div className="flex flex-col justify-center items-center max-w-4xl mx-auto pt-10">
        <input
          className="hidden"
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />

        <motion.div
          className="w-full rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex flex-col items-center rounded-3xl bg-[#0d1527] p-6 sm:p-10 border border-[#16243f] text-center">
            {/* Tag Badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="font-tag text-xs tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 px-3.5 py-1 rounded-full border border-[#0ea5e9]/30 uppercase transform -rotate-1">
                ✦ ARSENAL 02: DOC WILDSTYLE ✦
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              PDF Notes <span className="font-tag text-[#38bdf8] spray-glow">Extractor</span>
            </h1>
            <p className="text-sm text-gray-300 mt-2 max-w-lg leading-relaxed">
              Extract clean text, generate structured bullet notes, and unlock interactive RAG chat from any academic document.
            </p>

            {/* Street Steps */}
            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3 text-left">
              {steps.map((st, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#16243f] bg-black/40 p-4 transition-colors hover:border-[#0ea5e9]/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-tag text-xs text-[#38bdf8]">
                      STEP_{st.step}
                    </span>
                    <Paintbrush className="w-3.5 h-3.5 text-[#0ea5e9]" />
                  </div>
                  <div className="font-bold text-sm text-white mt-1 uppercase font-body">{st.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{st.desc}</div>
                </div>
              ))}
            </div>

            {/* Drag & Drop Box */}
            <div className="w-full my-8">
              <div
                className={`w-full h-[200px] cursor-pointer flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 ${
                  dragging
                    ? "border-[#38bdf8] bg-[#0ea5e9]/20 scale-[1.01]"
                    : file
                    ? "border-[#0ea5e9] bg-[#0ea5e9]/10"
                    : "border-[#16243f] bg-black/40 hover:border-[#0ea5e9]/50 hover:bg-[#11192e]"
                }`}
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#0ea5e9]/20 border border-[#0ea5e9] flex items-center justify-center text-[#38bdf8]">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-white max-w-md truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center p-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/60 border border-[#16243f] flex items-center justify-center text-[#38bdf8] mb-1">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      Drop lecture slides or notes PDF here
                    </span>
                    <span className="text-xs text-gray-400">
                      or click to browse from device (supports up to 100MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleGetNotes}
              disabled={isSubmitting || !file}
              className="w-full sm:w-auto min-w-[240px] bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-extrabold uppercase tracking-wider text-xs sm:text-sm py-4 px-8 rounded-2xl transition-all shadow-[0_4px_25px_rgba(14,165,233,0.35)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-tag flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#070a12]" />
                  <span>ANALYZING DOCUMENT...</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 text-[#070a12]" />
                  <span>EXTRACT STUDY SUITE</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      <UploadDialog
        show={showDialog}
        onClose={() => setShowDialog(false)}
        status={status}
        title="Extracting Document Notes..."
        subtitle="Extracting text, computing vector embeddings, and priming AI..."
      />
    </div>
  );
};

export default Page;
