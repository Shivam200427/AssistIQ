'use client'

import React, { useEffect, useState } from 'react';
import { Worker, Viewer } from "@react-pdf-viewer/core";
import '@react-pdf-viewer/core/lib/styles/index.css';
import { selectionModePlugin } from '@react-pdf-viewer/selection-mode';
import { BookCheck, CircleHelp, MessageCircle, NotebookPen, Rocket, Undo2, Paintbrush, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import GenerateProject from './pdf_comp/GenerateProject';
import QuizGenerator from './pdf_comp/QuizGenerator';
import ShortNotes from './pdf_comp/ShortNotes';
import ChatWithPdf from './pdf_comp/ChatWithPdf';
import ConeptMap from './pdf_comp/ConeptMap';
import Back from './Back';

const pdffeature = [
  { name: "Chat with PDF", icon: MessageCircle, comp: ChatWithPdf, tag: "RAG CHAT" },
  { name: "Get Short Notes", icon: NotebookPen, comp: ShortNotes, tag: "DIGEST" },
  { name: "Generate Projects", icon: Rocket, comp: GenerateProject, tag: "BLUEPRINTS" },
  { name: "Get Quizzes", icon: CircleHelp, comp: QuizGenerator, tag: "MOCK TEST" },
  { name: "Concept Maps Generator", icon: BookCheck, comp: ConeptMap, tag: "MIND MAP" },
];

const PdfViewer = ({
  pdfurl,
  initialPersistDir = "",
  documentId,
  notesStatus,
}: {
  pdfurl: string;
  initialPersistDir?: string;
  documentId?: string;
  notesStatus?: string | null;
}) => {
  // Links are short-lived; if the viewer can't load the file, fetch a fresh authorized link.
  const [fileUrl, setFileUrl] = useState(pdfurl);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLink = async () => {
    if (!documentId) return;
    setRefreshing(true);
    try {
      const res = await axios.get(`/api/documents/${documentId}/link`);
      setFileUrl(res.data.url);
    } finally {
      setRefreshing(false);
    }
  };
  const selectionPlugin = selectionModePlugin();
  const [top, settop] = useState<Number | null>(null);
  const [left, setleft] = useState<Number | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectedfeature, setSelectedfeature] = useState<number | null>(null);
  const [persit_dir, setpersit_dir] = useState(initialPersistDir);

  const featureList = pdffeature;

  const handleSelect = (event: React.MouseEvent) => {
    const text = window.getSelection()?.toString().trim() || "";

    if (text.length > 0) {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        const containerRect = event.currentTarget.getBoundingClientRect();
        settop(rect.bottom - containerRect.top + 10);
        setleft(rect.left - containerRect.left);
        setSelectedText(text);
      }
    } else {
      setSelectedText("");
      settop(null);
      setleft(null);
    }
  };

  useEffect(() => {
    if (initialPersistDir) {
      setpersit_dir(initialPersistDir);
      return;
    }

    const getpersit = async () => {
      try {
        const res = await axios.get("/api/uploadpdf", {
          params: { pdfurl: pdfurl }
        });
        if (res.data?.persist) {
          setpersit_dir(res.data.persist);
        }
      } catch (err) {
        console.log("Vectorstore resolve notice:", err);
      }
    };

    if (pdfurl) {
      getpersit();
    }
  }, [pdfurl, initialPersistDir]);

  return (
    <div className='relative min-h-screen bg-[#070a12] text-white font-body py-8'>
      <Back />
      <div className='flex flex-col lg:flex-row gap-6 max-w-[1500px] mx-auto px-4 pt-10'>
        {/* PDF Document Container */}
        <div className='bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] w-full lg:w-[50vw] h-[85vh] rounded-3xl card-spray-shadow'>
          <div className='w-full h-full bg-[#0d1527] p-4 rounded-3xl flex flex-col gap-2 border border-[#16243f]'>
            <div className='flex items-center justify-between pb-2 border-b border-[#16243f]'>
              <span className='text-xs font-bold text-[#38bdf8] flex items-center gap-2 font-tag uppercase'>
                <Paintbrush className="w-4 h-4 text-[#38bdf8]" /> Document Viewport
              </span>
              <span className='text-xs text-gray-400'>
                Highlight text for quick tools
              </span>
            </div>

            {notesStatus === "extracted_text" && (
              <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                AI notes couldn&apos;t be generated, so this shows the text extracted from your PDF instead. Chat and quizzes still use your original pages.
              </div>
            )}
            <div className='w-full flex-1 overflow-y-auto p-2 custom-scroll relative rounded-2xl bg-black/60 border border-white/5' onMouseUp={handleSelect}>
              <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                {fileUrl && (
                  <Viewer
                    key={fileUrl}
                    fileUrl={fileUrl}
                    plugins={[selectionPlugin]}
                    renderError={() => (
                      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-gray-300">
                        <span>The notes file couldn&apos;t be loaded.</span>
                        {documentId && (
                          <button onClick={refreshLink} disabled={refreshing} className="rounded-xl bg-[#38bdf8] px-4 py-2 font-bold text-[#070a12] cursor-pointer disabled:opacity-50">
                            {refreshing ? "Getting a fresh link…" : "Reload notes"}
                          </button>
                        )}
                      </div>
                    )}
                  />
                )}
              </Worker>

              {selectedText !== "" && top !== null && left !== null && (
                <div
                  className="absolute bg-[#0d1527] text-[#38bdf8] border border-[#0ea5e9] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.6)] z-50 p-1 font-tag text-xs"
                  style={{ top: `${top}px`, left: `${left}px` }}
                >
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedText)}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[#0ea5e9] hover:text-[#070a12] rounded-lg transition-colors cursor-pointer"
                  >
                    📋 Copy Text
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Interactive RAG Tools Panel */}
        <AnimatePresence mode="wait">
          {selectedfeature === null ? (
            <motion.div
              key="feature-list"
              className="bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] w-full lg:w-[45vw] h-[85vh] rounded-3xl card-spray-shadow"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full h-full bg-[#0d1527] rounded-3xl p-6 sm:p-8 flex flex-col gap-5 border border-[#16243f]">
                <div>
                  <span className="font-tag text-xs tracking-wider text-[#38bdf8] bg-[#0ea5e9]/15 px-3 py-1 rounded-full border border-[#0ea5e9]/30 uppercase inline-block mb-2">
                    ✦ Study tools ✦
                  </span>
                  <h2 className="text-2xl sm:text-3xl text-white font-extrabold tracking-tight">
                    Smart Study Suite
                  </h2>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">
                    Select an AI tool below to query your document, extract core concepts, or generate practice tests.
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  {featureList.map((features, index) => {
                    const Icon = features.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedfeature(index)}
                        className="w-full bg-black/40 border border-[#16243f] hover:border-[#38bdf8]/60 hover:bg-[#131e36] transition-all duration-200 py-3.5 px-4 rounded-2xl flex items-center justify-between text-gray-200 text-sm font-semibold shadow-md cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center text-[#38bdf8] group-hover:bg-[#0ea5e9] group-hover:text-[#070a12] transition-colors">
                            <Icon size={16} />
                          </div>
                          <span>{features.name}</span>
                        </div>
                        <span className="font-tag text-xs text-[#38bdf8] group-hover:underline">
                          {features.tag} →
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-[#16243f] mt-auto flex items-center gap-2.5 text-xs text-gray-400">
                  <Sparkles className="w-4 h-4 text-[#38bdf8] flex-shrink-0" />
                  <span>Powered by ChromaDB local vector embeddings & deep LLM RAG</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="feature-details"
              className="bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] w-full lg:w-[45vw] h-[85vh] rounded-3xl card-spray-shadow"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full h-full bg-[#0d1527] rounded-3xl p-6 flex flex-col gap-3 border border-[#16243f]">
                <button
                  className="text-[#38bdf8] hover:text-white flex items-center gap-2 cursor-pointer text-xs tracking-wider mb-2"
                  onClick={() => setSelectedfeature(null)}
                >
                  <Undo2 size={16} /> ← Back to tools
                </button>

                {(() => {
                  const selectedItem = featureList[selectedfeature];
                  const Icon = selectedItem.icon;
                  return (
                    <div className='w-full flex-1 overflow-hidden flex flex-col'>
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#16243f]">
                        <div className="w-8 h-8 rounded-xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center text-[#38bdf8]">
                          <Icon size={18} />
                        </div>
                        <h2 className="text-xl text-white font-bold">
                          {selectedItem.name}
                        </h2>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scroll">
                        <selectedItem.comp persist_dir={persit_dir} documentId={documentId} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PdfViewer;
