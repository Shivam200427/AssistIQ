"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Circle, Loader2, X } from "lucide-react";

export type StepStatus = "pending" | "active" | "done" | "failed";
export interface ProcessStep {
  label: string;
  status: StepStatus;
  detail?: string;
}
export interface ProcessAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/**
 * Shows real processing steps. A step only becomes "done" when the request behind it has actually
 * succeeded — there is no simulated progress. On failure it shows the server's message and actions.
 */
export default function ProcessDialog({
  show,
  title,
  steps,
  error,
  actions = [],
  onClose,
}: {
  show: boolean;
  title: string;
  steps: ProcessStep[];
  error?: string;
  actions?: ProcessAction[];
  onClose?: () => void;
}) {
  const busy = steps.some((s) => s.status === "active");
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4 font-body backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="relative w-[440px] max-w-full rounded-3xl border border-[#0ea5e9]/40 bg-[#0d1527] p-6 text-white shadow-[0_0_50px_rgba(14,165,233,0.25)]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-extrabold">{title}</h2>
              {!busy && onClose && (
                <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-gray-400 hover:text-white" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <ol className="mt-4 space-y-3" aria-live="polite">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center">
                    {s.status === "done" && <Check className="h-5 w-5 text-emerald-400" />}
                    {s.status === "active" && <Loader2 className="h-5 w-5 animate-spin text-[#38bdf8]" />}
                    {s.status === "failed" && <AlertTriangle className="h-5 w-5 text-red-400" />}
                    {s.status === "pending" && <Circle className="h-4 w-4 text-gray-600" />}
                  </span>
                  <span>
                    <span
                      className={
                        s.status === "pending"
                          ? "text-sm text-gray-500"
                          : s.status === "failed"
                            ? "text-sm font-semibold text-red-300"
                            : "text-sm font-semibold text-white"
                      }
                    >
                      {s.label}
                    </span>
                    {s.detail && <span className="block text-xs text-gray-400">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>

            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                {error}
              </div>
            )}

            {actions.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className={
                      a.primary
                        ? "cursor-pointer rounded-xl bg-[#38bdf8] px-4 py-2 text-sm font-bold text-[#070a12] hover:bg-[#7dd3fc]"
                        : "cursor-pointer rounded-xl border border-[#16243f] px-4 py-2 text-sm font-semibold text-gray-200 hover:border-[#38bdf8]/60"
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
