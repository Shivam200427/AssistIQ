"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface UploadDialogProps {
  show: boolean;
  onClose?: () => void;
  status: "loading" | "done";
  title?: string;
  subtitle?: string;
}

const UploadDialog = ({
  show,
  onClose,
  status,
  title = "PROCESSING...",
  subtitle = "AssistIQ street engine is running...",
}: UploadDialogProps) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"uploading" | "ready">("uploading");

  useEffect(() => {
    if (!show) return;

    let progressTimer: NodeJS.Timeout | null = null;
    let closeTimer: NodeJS.Timeout | null = null;

    if (status === "loading") {
      setStage("uploading");
      setProgress(0);

      progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev < 95) return prev + Math.random() * 5;
          return prev;
        });
      }, 250);
    }

    if (status === "done") {
      setProgress(100);
      setStage("ready");

      closeTimer = setTimeout(() => {
        onClose?.();
        setProgress(0);
        setStage("uploading");
      }, 1800);
    }

    return () => {
      if (progressTimer) clearInterval(progressTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [show, status, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center backdrop-blur-md bg-black/85 font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative bg-[#0d1527] text-white p-8 rounded-3xl shadow-[0_0_50px_rgba(14,165,233,0.35)] border-2 border-[#0ea5e9]/50 flex flex-col items-center justify-center w-[420px] max-w-[90vw]"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
          >
            {/* Ambient blue spray glow */}
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.2),transparent)] blur-xl pointer-events-none" />

            <div className="mb-2 text-[10px] tracking-widest text-[#38bdf8] bg-[#0ea5e9]/15 px-3 py-1 rounded-full border border-[#0ea5e9]/30 uppercase font-tag">
              ✦ ASSISTIQ // SYSTEM PROCESS ✦
            </div>

            {/* Uploading stage */}
            {stage === "uploading" && (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                  className="mt-4"
                >
                  <Loader2 className="w-14 h-14 text-[#38bdf8]" />
                </motion.div>
                <h2 className="text-lg mt-5 font-bold tracking-tight text-white uppercase text-center font-tag">
                  {title}
                </h2>
                <p className="text-gray-400 text-xs mt-1 text-center font-body">
                  {subtitle}
                </p>

                <div className="w-full mt-6 h-2 rounded-full bg-black/80 border border-[#0ea5e9]/30 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#38bdf8] to-[#0284c7] shadow-[0_0_12px_#38bdf8]"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.3 }}
                  />
                </div>
                <div className="w-full flex justify-between text-[11px] text-[#38bdf8] mt-2 font-tag">
                  <span>INDEXING...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </>
            )}

            {/* Done stage */}
            {stage === "ready" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center py-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#0ea5e9]/20 border border-[#38bdf8] flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)] mb-4 text-[#38bdf8]">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white tracking-wide uppercase text-center font-tag">
                  READY TO ROLL ⚡
                </h2>
                <p className="text-gray-400 text-xs mt-1 text-center font-body">
                  Your academic assets are prepared and indexed!
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadDialog;
