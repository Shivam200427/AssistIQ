"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, Timer } from "lucide-react";
import { usePlanly } from "../lib/store";
import { addDays, buildIcs, dayKey, downloadFile, formatDuration, googleCalendarLink, startOfWeek } from "../lib/utils";
import type { Session, Task } from "../lib/types";
import { Button, Card, EmptyState, Modal, cx } from "./ui";

type View = "month" | "week" | "day";

function useDayIndex() {
  const tasks = usePlanly((s) => s.tasks);
  const sessions = usePlanly((s) => s.sessions);
  return useMemo(() => {
    const byDay = new Map<string, { tasks: Task[]; sessions: Session[] }>();
    const get = (k: string) => {
      if (!byDay.has(k)) byDay.set(k, { tasks: [], sessions: [] });
      return byDay.get(k)!;
    };
    tasks.forEach((t) => t.due && get(t.due).tasks.push(t));
    sessions.forEach((s) => get(dayKey(s.start)).sessions.push(s));
    byDay.forEach((v) => v.sessions.sort((a, b) => a.start - b.start));
    return byDay;
  }, [tasks, sessions]);
}

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function TaskChip({ task }: { task: Task }) {
  const assignments = usePlanly((s) => s.assignments);
  const color = assignments.find((a) => a.id === task.assignmentId)?.color || "var(--pl-accent)";
  return (
    <div
      className={cx("truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold", task.status === "done" && "line-through opacity-60")}
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

function SessionChip({ s }: { s: Session }) {
  return (
    <div className="flex items-center gap-1 truncate rounded-md bg-[var(--pl-card2)] px-1.5 py-0.5 text-[11px] text-[var(--pl-muted)]" title={`${s.area} · ${formatDuration(s.durationSec)}`}>
      <Timer className="h-3 w-3 flex-shrink-0 text-[var(--pl-accent-ink)]" />
      {time(s.start)} · {formatDuration(s.durationSec)}
    </div>
  );
}

function DayDetail({ day, onClose }: { day: string | null; onClose: () => void }) {
  const index = useDayIndex();
  if (!day) return null;
  const entry = index.get(day) || { tasks: [], sessions: [] };
  const total = entry.sessions.reduce((a, s) => a + s.durationSec, 0);
  const label = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return (
    <Modal open onClose={onClose} title={label}>
      <DayContent tasks={entry.tasks} sessions={entry.sessions} total={total} />
    </Modal>
  );
}

function DayContent({ tasks, sessions, total }: { tasks: Task[]; sessions: Session[]; total: number }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">Tasks due</div>
        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--pl-muted)]">Nothing due.</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--pl-card2)] px-3 py-2">
                <span className={cx("text-sm text-[var(--pl-text)]", t.status === "done" && "text-[var(--pl-muted)] line-through")}>{t.title}</span>
                <a
                  href={googleCalendarLink(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-[var(--pl-accent-ink)] hover:underline"
                >
                  Google Calendar <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">Focus sessions · {formatDuration(total)}</div>
        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--pl-muted)]">No focus sessions.</p>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-[var(--pl-card2)] px-3 py-2 text-sm">
                <span className="text-[var(--pl-text)]">
                  {time(s.start)}–{time(s.end)} · {s.area}
                </span>
                <span className="text-xs text-[var(--pl-muted)]">
                  {s.type}
                  {s.completed && s.type === "pomodoro" ? " ✓" : ""} · {formatDuration(s.durationSec)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const index = useDayIndex();
  const tasks = usePlanly((s) => s.tasks);
  const sessions = usePlanly((s) => s.sessions);
  const today = dayKey();

  const move = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
    setCursor(d);
  };

  const title =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${startOfWeek(cursor).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const exportIcs = () => {
    downloadFile(`planly-calendar-${today}.ics`, buildIcs(tasks, sessions), "text/calendar;charset=utf-8");
  };

  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date()), i).toLocaleDateString(undefined, { weekday: "short" }));

  let body: React.ReactNode;
  if (view === "month") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    body = (
      <>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-bold uppercase text-[var(--pl-muted)]">
          {weekdays.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = dayKey(d);
            const entry = index.get(k);
            const inMonth = d.getMonth() === cursor.getMonth();
            const focus = entry?.sessions.reduce((a, s) => a + s.durationSec, 0) || 0;
            const items = entry?.tasks || [];
            return (
              <button
                key={k}
                onClick={() => setOpenDay(k)}
                className={cx(
                  "flex min-h-[92px] cursor-pointer flex-col gap-0.5 rounded-xl border p-1.5 text-left transition-colors hover:border-[var(--pl-accent)]",
                  k === today ? "border-[var(--pl-accent)] bg-[var(--pl-accent-soft)]" : "border-[var(--pl-border)] bg-[var(--pl-card2)]",
                  !inMonth && "opacity-40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cx("text-xs font-bold", k === today ? "text-[var(--pl-accent-ink)]" : "text-[var(--pl-text)]")}>{d.getDate()}</span>
                  {focus > 0 && <span className="text-[10px] font-semibold text-[var(--pl-accent-ink)]">{formatDuration(focus)}</span>}
                </div>
                {items.slice(0, 2).map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {items.length > 2 && <span className="text-[10px] text-[var(--pl-muted)]">+{items.length - 2} more</span>}
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (view === "week") {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    body = (
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const entry = index.get(k) || { tasks: [], sessions: [] };
          const focus = entry.sessions.reduce((a, s) => a + s.durationSec, 0);
          return (
            <div
              key={k}
              className={cx("min-h-[220px] rounded-xl border p-2", k === today ? "border-[var(--pl-accent)] bg-[var(--pl-accent-soft)]" : "border-[var(--pl-border)] bg-[var(--pl-card2)]")}
            >
              <button onClick={() => setOpenDay(k)} className="mb-2 w-full cursor-pointer text-left">
                <div className="text-[11px] font-bold uppercase text-[var(--pl-muted)]">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div className="text-lg font-extrabold text-[var(--pl-text)]">{d.getDate()}</div>
                {focus > 0 && <div className="text-[11px] font-semibold text-[var(--pl-accent-ink)]">{formatDuration(focus)} focus</div>}
              </button>
              <div className="space-y-1">
                {entry.tasks.map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {entry.sessions.map((s) => (
                  <SessionChip key={s.id} s={s} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const k = dayKey(cursor);
    const entry = index.get(k) || { tasks: [], sessions: [] };
    const hours = Array.from({ length: 24 }, (_, h) => h);
    body = (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DayContent tasks={entry.tasks} sessions={entry.sessions} total={entry.sessions.reduce((a, s) => a + s.durationSec, 0)} />
        </div>
        <div className="max-h-[560px] overflow-y-auto rounded-xl border border-[var(--pl-border)] lg:col-span-2 custom-scroll">
          {hours.map((h) => {
            const inHour = entry.sessions.filter((s) => new Date(s.start).getHours() === h);
            return (
              <div key={h} className="flex min-h-[44px] border-b border-[var(--pl-border)] last:border-0">
                <div className="w-14 flex-shrink-0 border-r border-[var(--pl-border)] p-1.5 text-right text-[11px] text-[var(--pl-muted)]">
                  {String(h).padStart(2, "0")}:00
                </div>
                <div className="flex flex-1 flex-wrap gap-1 p-1">
                  {inHour.map((s) => (
                    <div key={s.id} className="rounded-lg bg-[var(--pl-accent-soft)] px-2 py-1 text-xs text-[var(--pl-text)]">
                      {time(s.start)}–{time(s.end)} · {s.area} · {formatDuration(s.durationSec)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 !p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => move(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => move(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="flex flex-1 items-center gap-2 text-base font-bold text-[var(--pl-text)]">
          <CalendarDays className="h-4 w-4 text-[var(--pl-accent-ink)]" /> {title}
        </h2>
        <div className="flex rounded-xl bg-[var(--pl-card2)] p-1">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cx(
                "cursor-pointer rounded-lg px-3 py-1 text-xs font-bold capitalize",
                view === v ? "bg-[var(--pl-accent)] text-[var(--pl-on-accent)]" : "text-[var(--pl-muted)] hover:text-[var(--pl-text)]"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Button variant="soft" size="sm" onClick={exportIcs} title="Download an .ics file — import it in Google Calendar (Settings → Import)">
          <Download className="h-4 w-4" /> Export to Google Calendar
        </Button>
      </Card>
      {tasks.length === 0 && sessions.length === 0 && <EmptyState>Add tasks with due dates or run a timer — they'll show up here.</EmptyState>}
      <Card>{body}</Card>
      <p className="text-xs text-[var(--pl-muted)]">
        Export downloads an .ics file. In Google Calendar open <b>Settings → Import &amp; export</b> and choose the file to add everything at once, or use the
        per-task Google Calendar links in the day view.
      </p>
      <DayDetail day={openDay} onClose={() => setOpenDay(null)} />
    </div>
  );
}
