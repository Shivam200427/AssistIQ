"use client";

import { motion } from "framer-motion";
import { AlertCircle, BookOpen, FileText, FileUp, Loader2, Upload } from "lucide-react";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";

import Back from "../components/Back";
import PdfViewer from "../components/pdfViewer";
import ProcessDialog, { type ProcessStep } from "../components/ProcessDialog";
import { MAX_PDF_BYTES } from "../api/utils/upload";

const MAX_MB = Math.round(MAX_PDF_BYTES / 1024 / 1024);
const RECENT_KEY = "assistiq_recent_pdfs";

type Recent = { id: string; title: string; at: number };
type Opened = { documentId: string; link: string; persist: string; notesStatus?: string | null };

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function rememberRecent(item: Recent) {
  try {
    const list = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — nothing else depends on it
  }
}

function errorMessage(err: any, fallback: string) {
  if (err?.response?.status === 413) return `This PDF is larger than the server accepts. Try a smaller file (max ${MAX_MB} MB).`;
  if (err?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  return err?.response?.data?.message || fallback;
}

const UPLOAD = "Uploading your PDF";
const PROCESS = "Reading pages, building the search index and writing cited notes";

function PdfNotesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<ProcessStep[] | null>(null);
  const [runError, setRunError] = useState("");
  const [pendingDoc, setPendingDoc] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [opening, setOpening] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setRecent(readRecent()), []);

  // Reopen a saved document: always fetch a fresh, authorized link (stored links would expire).
  const openDocument = useCallback(async (id: string) => {
    setOpening(true);
    setError("");
    try {
      const res = await axios.get(`/api/documents/${id}/link`);
      setOpened({ documentId: id, link: res.data.url, persist: res.data.persist, notesStatus: res.data.notesStatus });
    } catch (err: any) {
      setError(errorMessage(err, "This document couldn't be opened."));
    } finally {
      setOpening(false);
    }
  }, []);

  useEffect(() => {
    const id = params.get("doc");
    if (id && !opened) openDocument(id);
  }, [params, opened, openDocument]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.type && f.type !== "application/pdf") return setError("Only PDF files are supported.");
    if (f.size > MAX_PDF_BYTES) return setError(`This PDF is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
    setError("");
    setFile(f);
  };

  const process = async (documentId: string) => {
    setSteps([{ label: UPLOAD, status: "done" }, { label: PROCESS, status: "active", detail: "This usually takes 20–60 seconds." }]);
    setRunError("");
    try {
      const res = await axios.post("/api/uploadpdf/process", { documentId });
      setSteps([{ label: UPLOAD, status: "done" }, { label: PROCESS, status: "done" }]);
      rememberRecent({ id: documentId, title: file?.name || "PDF", at: Date.now() });
      setPendingDoc(null);
      setSteps(null);
      setOpened({ documentId, link: res.data.link, persist: res.data.persist, notesStatus: res.data.notesStatus });
      router.replace(`/pdfNotesExtractor?doc=${documentId}`);
    } catch (err: any) {
      setPendingDoc(documentId);
      setSteps([{ label: UPLOAD, status: "done" }, { label: PROCESS, status: "failed" }]);
      setRunError(errorMessage(err, "Processing failed."));
    }
  };

  const start = async () => {
    if (!file) return setError("Choose a PDF first.");
    setSteps([{ label: UPLOAD, status: "active" }, { label: PROCESS, status: "pending" }]);
    setRunError("");
    try {
      const form = new FormData();
      form.append("pdf", file);
      const res = await axios.post("/api/uploadpdf", form);
      await process(res.data.documentId);
    } catch (err: any) {
      setSteps([{ label: UPLOAD, status: "failed" }, { label: PROCESS, status: "pending" }]);
      setRunError(errorMessage(err, "Upload failed."));
    }
  };

  if (opened) {
    return <PdfViewer documentId={opened.documentId} pdfurl={opened.link} initialPersistDir={opened.persist} notesStatus={opened.notesStatus} />;
  }

  const busy = !!steps?.some((s) => s.status === "active");

  return (
    <div className="relative min-h-screen bg-[#070a12] text-white font-body py-10 px-4">
      <Back />
      <div className="flex flex-col justify-center items-center max-w-3xl mx-auto pt-10">
        <input className="hidden" ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => pickFile(e.target.files?.[0])} />

        <motion.div
          className="w-full rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center rounded-3xl bg-[#0d1527] p-6 sm:p-10 border border-[#16243f] text-center">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              PDF <span className="font-tag text-[#38bdf8] spray-glow">Notes</span>
            </h1>
            <p className="text-sm text-gray-300 mt-2 max-w-lg leading-relaxed">
              Upload a PDF and start studying: you get notes with page references, a chat that answers from your document, and quizzes built from it.
            </p>

            <div
              role="button"
              tabIndex={0}
              aria-label="Choose a PDF"
              className={`w-full mt-8 h-[200px] cursor-pointer flex flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 ${
                dragging ? "border-[#38bdf8] bg-[#0ea5e9]/20" : file ? "border-[#0ea5e9] bg-[#0ea5e9]/10" : "border-[#16243f] bg-black/40 hover:border-[#0ea5e9]/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
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
                <div className="flex flex-col items-center gap-2 p-4">
                  <FileUp className="w-8 h-8 text-[#38bdf8]" />
                  <span className="text-sm font-bold text-white max-w-md truncate">{file.name}</span>
                  <span className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · click to change</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-4">
                  <Upload className="w-8 h-8 text-[#38bdf8]" />
                  <span className="text-sm font-semibold text-white">Drop your PDF here, or click to choose</span>
                  <span className="text-xs text-gray-400">PDF only, up to {MAX_MB} MB</span>
                </div>
              )}
            </div>

            {error && (
              <div role="alert" className="w-full mt-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={start}
              disabled={busy || !file}
              className="mt-6 w-full sm:w-auto min-w-[260px] bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#070a12] font-bold text-base py-4 px-8 rounded-2xl transition-all shadow-[0_4px_25px_rgba(14,165,233,0.35)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
              <span>{busy ? "Working…" : "Upload and start studying"}</span>
            </button>

            {recent.length > 0 && (
              <div className="mt-8 w-full text-left">
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Your recent PDFs</h2>
                <ul className="space-y-1.5">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => router.push(`/pdfNotesExtractor?doc=${r.id}`)}
                        disabled={opening}
                        className="w-full flex items-center gap-2 rounded-xl border border-[#16243f] bg-black/30 px-3 py-2 text-sm text-gray-200 hover:border-[#38bdf8]/60 cursor-pointer disabled:opacity-50"
                      >
                        <FileText className="w-4 h-4 text-[#38bdf8]" />
                        <span className="flex-1 truncate">{r.title}</span>
                        <span className="text-xs text-gray-500">{new Date(r.at).toLocaleDateString()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {opening && <p className="mt-4 text-sm text-gray-400">Opening your document…</p>}
          </div>
        </motion.div>
      </div>

      <ProcessDialog
        show={!!steps}
        title="Preparing your PDF"
        steps={steps || []}
        error={runError}
        actions={
          busy || !steps
            ? []
            : [
                pendingDoc
                  ? { label: "Retry processing", primary: true, onClick: () => process(pendingDoc) }
                  : { label: "Try again", primary: true, onClick: start },
                { label: "Close", onClick: () => setSteps(null) },
              ]
        }
        onClose={() => setSteps(null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PdfNotesPage />
    </Suspense>
  );
}
