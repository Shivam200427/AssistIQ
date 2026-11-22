"use client";

import { useState } from "react";
import axios from "axios";
import { Send, Terminal, Bot, User, Copy, Check } from "lucide-react";

export default function ChatWithPdf({ persist_dir }: { persist_dir: string; documentId?: string }) {
  type Citation = { page: number; excerpt: string };
  type Msg = { role: string; text: string; citations?: Citation[]; grounded?: boolean; error?: boolean; question?: string };
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "⚡ Yo! I'm your AssistIQ document agent. Ask me anything about this PDF and I'll extract answers directly from the indexed text.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const askQuestion = async (retryText?: string) => {
    const userText = (retryText ?? input).trim();
    if (!userText || loading) return;

    if (!retryText) setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
      const res = await axios.post(`${backendUrl}/askquestion`, {
        question: userText,
        store: persist_dir,
        mode: "qa",
      });

      setMessages((prev) => [
        ...prev,
        { role: "bot", text: res.data?.answer || "No answer was returned.", citations: res.data?.citations || [], grounded: !!res.data?.grounded },
      ]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || (err?.code === "ERR_NETWORK" ? "Can't reach the document service. It may be waking up — try again in a minute." : err?.message) || "The document search failed.";
      setMessages((prev) => [...prev, { role: "bot", text: errMsg, error: true, question: userText }]);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#070a12] text-white font-body rounded-2xl overflow-hidden border border-[#0ea5e9]/25">
      {/* Header Bar */}
      <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-[#38bdf8] font-tag font-bold">
          <Terminal className="w-3.5 h-3.5" /> [DOC CHAT // RAG ACTIVE]
        </span>
        <span className="text-gray-400 text-[10px] font-tag">CHROMA VECTORSTORE</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll bg-black/40">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 font-tag">
              {msg.role === "user" ? (
                <>
                  <User className="w-3 h-3 text-[#38bdf8]" /> [YOU]
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-[#60a5fa]" /> [ASSISTIQ]
                </>
              )}
            </div>

            <div
              className={`group relative px-4 py-3 rounded-2xl max-w-[85%] text-xs leading-relaxed transition-all ${
                msg.role === "user"
                  ? "bg-[#0ea5e9]/20 text-white border border-[#38bdf8]/60 shadow-[0_0_15px_rgba(14,165,233,0.25)]"
                  : "bg-[#0d1527] text-gray-200 border border-[#16243f] shadow-lg"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {msg.role === "bot" && msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#16243f] pt-2">
                  <span className="text-[10px] text-gray-400">Sources:</span>
                  {msg.citations.map((c) => (
                    <span key={c.page} title={c.excerpt} className="rounded-md border border-[#38bdf8]/40 bg-[#0ea5e9]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#38bdf8]">
                      Page {c.page}
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "bot" && msg.grounded === false && !msg.error && (
                <div className="mt-2 text-[10px] text-amber-300">Not answered: the document doesn&apos;t contain enough evidence.</div>
              )}
              {msg.error && msg.question && (
                <button onClick={() => askQuestion(msg.question)} className="mt-2 rounded-lg border border-red-400/40 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/10 cursor-pointer">
                  Retry
                </button>
              )}

              {msg.role === "bot" && (
                <button
                  onClick={() => copyText(msg.text, i)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-[#38bdf8] transition-opacity"
                  title="Copy text"
                >
                  {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-[#38bdf8]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 font-tag">
              <Bot className="w-3 h-3 text-[#38bdf8]" /> [SCANNING_INDEX]
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#0d1527] border border-[#0ea5e9]/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
              <span className="text-xs text-[#38bdf8]">Searching vector chunks...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0d1527] border-t border-[#16243f] flex gap-2">
        <input
          className="flex-1 bg-black/50 border border-[#16243f] text-white placeholder-gray-500 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-[#38bdf8] transition-all"
          placeholder="Ask anything about the uploaded document..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              askQuestion();
            }
          }}
        />
        <button
          onClick={() => askQuestion()}
          disabled={loading || !input.trim()}
          className="bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)]"
        >
          <Send className="w-3.5 h-3.5" /> Send
        </button>
      </div>
    </div>
  );
}
