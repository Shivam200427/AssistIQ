import type { Session, Task } from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Local-time day key, e.g. 2026-11-22 */
export function dayKey(d: Date | number = new Date()): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // Monday-based week
  return addDays(x, -diff);
}

export function lastNDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - n + 1)));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Focus minutes per day key. */
export function focusByDay(sessions: Session[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const k = dayKey(s.start);
    out[k] = (out[k] || 0) + s.durationSec / 60;
  }
  return out;
}

/** A day counts towards the streak if you focused at least a minute or finished a task. */
export function activeDays(sessions: Session[], tasks: Task[]): Set<string> {
  const days = new Set<string>();
  const focus = focusByDay(sessions);
  for (const [k, min] of Object.entries(focus)) if (min >= 1) days.add(k);
  for (const t of tasks) if (t.completedAt) days.add(dayKey(t.completedAt));
  return days;
}

export function streakStats(days: Set<string>): { current: number; longest: number } {
  // Current streak: counts back from today (or yesterday, so a streak is not "lost" before you study today).
  let current = 0;
  let cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = parseDayKey(k);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current) };
}

export function habitStreak(log: Record<string, boolean>): number {
  let streak = 0;
  let cursor = new Date();
  if (!log[dayKey(cursor)]) cursor = addDays(cursor, -1);
  while (log[dayKey(cursor)]) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function downloadFile(name: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell === null || cell === undefined ? "" : String(cell);
          // Quote everything that needs it, and neutralise spreadsheet formula injection.
          const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
          return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
        })
        .join(",")
    )
    .join("\n");
}

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** iCalendar file that Google Calendar, Outlook and Apple Calendar can import. */
export function buildIcs(tasks: Task[], sessions: Session[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AssistIQ//Planly//EN", "CALSCALE:GREGORIAN"];
  const stamp = icsDate(Date.now());
  for (const t of tasks) {
    if (!t.due) continue;
    const start = t.due.replace(/-/g, "");
    const end = dayKey(addDays(parseDayKey(t.due), 1)).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${t.id}@planly`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEscape((t.status === "done" ? "✓ " : "") + t.title)}`,
      `DESCRIPTION:${icsEscape(t.notes || "Planly task")}`,
      "END:VEVENT"
    );
  }
  for (const s of sessions) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${s.id}@planly`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.start)}`,
      `DTEND:${icsDate(s.end)}`,
      `SUMMARY:${icsEscape(`Focus: ${s.area || "General"} (${s.type})`)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarLink(task: Task): string {
  const start = task.due!.replace(/-/g, "");
  const end = dayKey(addDays(parseDayKey(task.due!), 1)).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title,
    dates: `${start}/${end}`,
    details: task.notes || "From Planly (AssistIQ)",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const ACCENTS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#fb923c", "#22d3ee"];
export const COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#fb923c", "#94a3b8"];
