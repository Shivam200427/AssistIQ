"use client";

import { useRef, useState } from "react";
import { Database, FileJson, FileSpreadsheet, FileText, Moon, Palette, Sun, Timer, Trash2, Upload } from "lucide-react";
import { exportableData, usePlanly } from "../lib/store";
import { ACCENTS, dayKey, downloadFile, formatDuration, toCsv } from "../lib/utils";
import { htmlToText } from "../lib/markdown";
import { Button, Card, CardTitle, Input, cx } from "./ui";

async function exportPdf() {
  const { jsPDF } = await import("jspdf");
  const st = usePlanly.getState();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const line = (text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    doc.setTextColor(...(opts.color || [20, 20, 20]));
    const wrapped = doc.splitTextToSize(text, 500);
    for (const w of wrapped) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(w, margin, y);
      y += (opts.size || 10) * 1.4;
    }
    y += opts.gap || 0;
  };

  const assignments = new Map(st.assignments.map((a) => [a.id, a.name]));
  const focusSec = st.sessions.reduce((a, s) => a + s.durationSec, 0);

  line("Planly report", { size: 22, bold: true, gap: 4 });
  line(`Generated ${new Date().toLocaleString()}`, { color: [110, 110, 110], gap: 12 });
  line("Summary", { size: 14, bold: true, gap: 2 });
  line(`Total focus time: ${formatDuration(focusSec)} across ${st.sessions.length} sessions`);
  line(`Pomodoros completed: ${st.sessions.filter((s) => s.type === "pomodoro" && s.completed).length}`);
  line(`Tasks: ${st.tasks.length} (${st.tasks.filter((t) => t.status === "done").length} done)`);
  line(`Habits: ${st.habits.length} · Notes: ${st.notes.length}`, { gap: 12 });

  line("Tasks", { size: 14, bold: true, gap: 2 });
  if (!st.tasks.length) line("No tasks.");
  for (const t of [...st.tasks].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))) {
    const bits = [t.status.toUpperCase(), t.difficulty, t.due ? `due ${t.due}` : "", t.assignmentId ? assignments.get(t.assignmentId) : "", t.tags.map((x) => `#${x}`).join(" ")].filter(Boolean);
    line(`${t.status === "done" ? "[x]" : "[ ]"} ${t.title}`, { bold: true });
    line(`     ${bits.join(" · ")}`, { size: 9, color: [110, 110, 110] });
  }
  y += 8;

  line("Recent focus sessions", { size: 14, bold: true, gap: 2 });
  const recent = [...st.sessions].sort((a, b) => b.start - a.start).slice(0, 60);
  if (!recent.length) line("No sessions.");
  for (const s of recent) line(`${new Date(s.start).toLocaleString()} — ${s.area} · ${s.type} · ${formatDuration(s.durationSec)}`, { size: 9 });
  y += 8;

  line("Habits", { size: 14, bold: true, gap: 2 });
  if (!st.habits.length) line("No habits.");
  for (const h of st.habits) line(`${h.name}: ${Object.keys(h.log).length} check-ins`);
  y += 8;

  if (st.notes.length) {
    line("Notes", { size: 14, bold: true, gap: 2 });
    for (const n of st.notes) {
      line(n.title || "Untitled", { bold: true });
      line(htmlToText(n.html).slice(0, 1500) || "(empty)", { size: 9, color: [60, 60, 60], gap: 6 });
    }
  }

  doc.save(`planly-report-${dayKey()}.pdf`);
}

function exportCsv(kind: "tasks" | "sessions" | "habits") {
  const st = usePlanly.getState();
  const assignments = new Map(st.assignments.map((a) => [a.id, a.name]));
  let rows: (string | number | boolean | null)[][] = [];
  if (kind === "tasks") {
    rows = [["title", "status", "assignment", "difficulty", "due", "tags", "pinned", "created", "completed", "notes"]];
    st.tasks.forEach((t) =>
      rows.push([
        t.title,
        t.status,
        t.assignmentId ? assignments.get(t.assignmentId) || "" : "",
        t.difficulty,
        t.due,
        t.tags.join(" "),
        t.pinned,
        new Date(t.createdAt).toISOString(),
        t.completedAt ? new Date(t.completedAt).toISOString() : "",
        t.notes,
      ])
    );
  } else if (kind === "sessions") {
    rows = [["type", "area", "start", "end", "minutes", "completed"]];
    st.sessions.forEach((s) => rows.push([s.type, s.area, new Date(s.start).toISOString(), new Date(s.end).toISOString(), Math.round(s.durationSec / 6) / 10, s.completed]));
  } else {
    rows = [["habit", "date", "done"]];
    st.habits.forEach((h) => Object.keys(h.log).sort().forEach((k) => rows.push([h.name, k, true])));
  }
  downloadFile(`planly-${kind}-${dayKey()}.csv`, "﻿" + toCsv(rows), "text/csv;charset=utf-8");
}

export default function Settings() {
  const settings = usePlanly((s) => s.settings);
  const { updateSettings, importData, resetAll } = usePlanly.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

  const onImport = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("File is too large.");
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !("tasks" in data || "sessions" in data || "settings" in data)) {
        throw new Error("This doesn't look like a Planly backup.");
      }
      if (!confirm("Replace all current Planly data with this backup?")) return;
      importData(data);
      setMessage("Backup restored.");
    } catch (e: any) {
      setMessage(`Import failed: ${e.message || "invalid file"}`);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle icon={<Palette className="h-4 w-4" />}>Appearance</CardTitle>
        <div className="mb-4 flex gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateSettings({ theme: t })}
              className={cx(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold capitalize",
                settings.theme === t ? "border-[var(--pl-accent)] bg-[var(--pl-accent-soft)] text-[var(--pl-accent-ink)]" : "border-[var(--pl-border)] text-[var(--pl-muted)]"
              )}
            >
              {t === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {t}
            </button>
          ))}
        </div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">Accent colour</div>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => updateSettings({ accent: c })}
              className={cx("h-8 w-8 cursor-pointer rounded-full border-2 transition-transform hover:scale-110", settings.accent === c ? "border-[var(--pl-text)]" : "border-transparent")}
              style={{ background: c }}
              aria-label={`Accent ${c}`}
            />
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--pl-border)] px-2 py-1 text-xs text-[var(--pl-muted)]">
            <input type="color" value={settings.accent} onChange={(e) => updateSettings({ accent: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" />
            Custom
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Timer className="h-4 w-4" />}>Pomodoro intervals</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-[var(--pl-muted)]">
            Focus (min)
            <Input type="number" min={1} max={180} value={settings.workMin} onChange={(e) => updateSettings({ workMin: num(e.target.value, 1, 180) })} />
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Short break (min)
            <Input type="number" min={1} max={60} value={settings.shortMin} onChange={(e) => updateSettings({ shortMin: num(e.target.value, 1, 60) })} />
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Long break (min)
            <Input type="number" min={1} max={120} value={settings.longMin} onChange={(e) => updateSettings({ longMin: num(e.target.value, 1, 120) })} />
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Long break every
            <Input type="number" min={1} max={12} value={settings.longEvery} onChange={(e) => updateSettings({ longEvery: num(e.target.value, 1, 12) })} />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--pl-muted)]">Sound, desktop alerts, auto-start and timer sync live on the Timers tab.</p>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle icon={<Database className="h-4 w-4" />}>Your data</CardTitle>
        <p className="mb-3 text-xs text-[var(--pl-muted)]">
          Planly saves everything in this browser on every change, so it works offline. Export a JSON backup to move it to another device or keep it safe.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => downloadFile(`planly-backup-${dayKey()}.json`, JSON.stringify(exportableData(usePlanly.getState()), null, 2), "application/json")}>
            <FileJson className="h-4 w-4" /> JSON backup
          </Button>
          <Button variant="soft" onClick={() => exportCsv("tasks")}>
            <FileSpreadsheet className="h-4 w-4" /> Tasks CSV
          </Button>
          <Button variant="soft" onClick={() => exportCsv("sessions")}>
            <FileSpreadsheet className="h-4 w-4" /> Sessions CSV
          </Button>
          <Button variant="soft" onClick={() => exportCsv("habits")}>
            <FileSpreadsheet className="h-4 w-4" /> Habits CSV
          </Button>
          <Button
            variant="soft"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportPdf();
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileText className="h-4 w-4" /> PDF report
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--pl-border)] pt-4">
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <Button variant="ghost" className="border border-[var(--pl-border)]" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import backup
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Delete ALL Planly data in this browser? This can't be undone — export a backup first if you need one.")) {
                resetAll();
                setMessage("All Planly data was cleared.");
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Reset everything
          </Button>
        </div>
        {message && <p className="mt-2 text-xs text-[var(--pl-muted)]">{message}</p>}
      </Card>
    </div>
  );
}

