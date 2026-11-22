"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { usePlanly } from "../lib/store";
import { addDays, dayKey, formatDuration } from "../lib/utils";
import { Button, Modal } from "./ui";

const W = 1200;
const H = 630;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws a branded 1200×630 PNG (the size Discord/WhatsApp previews use). */
function drawCard(canvas: HTMLCanvasElement, opts: { current: number; longest: number; weekFocusSec: number; totalPomodoros: number; focusByDay: Record<string, number>; accent: string; name: string }) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#070a12");
  bg.addColorStop(1, "#0d1527");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W - 180, 120, 20, W - 180, 120, 420);
  glow.addColorStop(0, `${opts.accent}55`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = opts.accent;
  ctx.font = "bold 30px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("PLANLY", 70, 90);
  const brandW = ctx.measureText("PLANLY").width;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("by AssistIQ", 70 + brandW + 14, 90);

  ctx.fillStyle = "#f1f5f9";
  ctx.font = "800 200px 'Plus Jakarta Sans', system-ui, sans-serif";
  const num = String(opts.current);
  ctx.fillText(num, 64, 330);
  const numW = ctx.measureText(num).width;
  ctx.font = "120px system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.fillText("🔥", 64 + numW + 20, 315);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "700 40px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("day study streak", 70, 395);
  if (opts.name) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 28px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(opts.name, 70, 440);
  }

  const stats = [
    { label: "LONGEST", value: `${opts.longest}d` },
    { label: "FOCUS · 7 DAYS", value: formatDuration(opts.weekFocusSec) },
    { label: "POMODOROS", value: String(opts.totalPomodoros) },
  ];
  stats.forEach((s, i) => {
    const x = 70 + i * 260;
    const y = 480;
    roundRect(ctx, x, y, 230, 90, 18);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = "#16243f";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 16px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(s.label, x + 20, y + 32);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "800 34px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(s.value, x + 20, y + 72);
  });

  // Last 12 weeks of activity
  const weeks = 12;
  const cell = 22;
  const gap = 6;
  const gridX = W - 70 - weeks * (cell + gap) + gap;
  const gridY = 200;
  const today = new Date();
  const start = addDays(today, -(weeks * 7 - 1));
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 16px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("LAST 12 WEEKS", gridX, gridY - 20);
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const min = opts.focusByDay[dayKey(d)] || 0;
    const col = Math.floor(i / 7);
    const row = i % 7;
    roundRect(ctx, gridX + col * (cell + gap), gridY + row * (cell + gap), cell, cell, 5);
    if (min <= 0) {
      ctx.fillStyle = "#16243f";
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = opts.accent;
      ctx.globalAlpha = min < 25 ? 0.35 : min < 60 ? 0.55 : min < 120 ? 0.8 : 1;
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "500 20px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), W - 70 - 260, H - 50);
}

export default function StreakCardModal({ open, onClose, streak, focusByDay }: { open: boolean; onClose: () => void; streak: { current: number; longest: number }; focusByDay: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessions = usePlanly((s) => s.sessions);
  const accent = usePlanly((s) => s.settings.accent);
  const [name, setName] = useState("");
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    if (!open) return;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const draw = () =>
      canvasRef.current &&
      drawCard(canvasRef.current, {
        current: streak.current,
        longest: streak.longest,
        weekFocusSec: sessions.filter((s) => s.start >= weekAgo).reduce((a, s) => a + s.durationSec, 0),
        totalPomodoros: sessions.filter((s) => s.type === "pomodoro" && s.completed).length,
        focusByDay,
        accent,
        name: name.trim().slice(0, 40),
      });
    // Wait one frame so the canvas is mounted inside the modal, and for web fonts.
    const id = requestAnimationFrame(() => {
      draw();
      document.fonts?.ready.then(draw);
    });
    return () => cancelAnimationFrame(id);
  }, [open, streak, sessions, focusByDay, accent, name]);

  const toBlob = () => new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png"));

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planly-streak-${dayKey()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    setShareError("");
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], `planly-streak-${dayKey()}.png`, { type: "image/png" });
    const text = `I'm on a ${streak.current}-day study streak with Planly 🔥`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else if (navigator.clipboard && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setShareError("Image copied — paste it into Discord, WhatsApp Web or anywhere.");
      } else {
        await download();
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setShareError("Sharing isn't available here — use Download instead.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your streak" wide>
      <canvas ref={canvasRef} className="w-full rounded-xl border border-[var(--pl-border)]" style={{ aspectRatio: `${W}/${H}` }} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="min-w-[160px] flex-1 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-card2)] px-3 py-2 text-sm text-[var(--pl-text)] outline-none focus:border-[var(--pl-accent)]"
        />
        <Button variant="soft" onClick={download}>
          <Download className="h-4 w-4" /> Download PNG
        </Button>
        <Button variant="primary" onClick={share}>
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>
      {shareError && <p className="mt-2 text-xs text-[var(--pl-muted)]">{shareError}</p>}
    </Modal>
  );
}
