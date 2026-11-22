"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarClock, Check, CheckCircle2, Clock, Flame, ListTodo, Pause, Play, Repeat, Timer } from "lucide-react";
import { usePlanly } from "../lib/store";
import { useNow } from "../lib/hooks";
import { unlockAudio } from "../lib/alerts";
import { activeDays, dayKey, formatClock, formatDuration, parseDayKey, streakStats } from "../lib/utils";
import { Badge, Button, Card, CardTitle, EmptyState, Stat, cx } from "./ui";

export type TabId = "overview" | "timers" | "tasks" | "calendar" | "analytics" | "notes" | "habits" | "sounds" | "settings";

export default function Overview({ go }: { go: (tab: TabId) => void }) {
  const sessions = usePlanly((s) => s.sessions);
  const tasks = usePlanly((s) => s.tasks);
  const habits = usePlanly((s) => s.habits);
  const assignments = usePlanly((s) => s.assignments);
  const pomodoro = usePlanly((s) => s.pomodoro);
  const { startTimer, pauseTimer, toggleHabit } = usePlanly.getState();
  const now = useNow(pomodoro.running);
  const today = dayKey();

  const data = useMemo(() => {
    const todaySessions = sessions.filter((s) => dayKey(s.start) === today);
    const streak = streakStats(activeDays(sessions, tasks));
    const open = tasks.filter((t) => t.status !== "done");
    const overdue = open.filter((t) => t.due && t.due < today);
    const dueToday = open.filter((t) => t.due === today);
    const upNext = [...open]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (a.due || "9999").localeCompare(b.due || "9999") || a.order - b.order;
      })
      .slice(0, 6);
    return {
      focusSec: todaySessions.reduce((a, s) => a + s.durationSec, 0),
      pomodoros: todaySessions.filter((s) => s.type === "pomodoro" && s.completed).length,
      doneToday: tasks.filter((t) => t.completedAt && dayKey(t.completedAt) === today).length,
      streak,
      overdue,
      dueToday,
      upNext,
    };
  }, [sessions, tasks, today]);

  const remaining = pomodoro.running && pomodoro.endsAt ? pomodoro.endsAt - now : pomodoro.remainingMs;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const assignmentName = (id: string | null) => (id ? assignments.find((a) => a.id === id) : undefined);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--pl-text)]">{greeting} 👋</h2>
        <p className="text-sm text-[var(--pl-muted)]">
          {data.overdue.length > 0
            ? `${data.overdue.length} overdue task${data.overdue.length > 1 ? "s" : ""} need attention.`
            : data.dueToday.length > 0
              ? `${data.dueToday.length} task${data.dueToday.length > 1 ? "s" : ""} due today.`
              : "Nothing urgent — a great time to get ahead."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Focus today" value={formatDuration(data.focusSec)} />
        <Stat icon={<Timer className="h-3.5 w-3.5" />} label="Pomodoros today" value={data.pomodoros} />
        <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Study streak" value={`${data.streak.current}d`} hint={`best ${data.streak.longest}d`} />
        <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Tasks done today" value={data.doneToday} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardTitle icon={<Timer className="h-4 w-4" />} right={<button onClick={() => go("timers")} className="cursor-pointer text-xs font-semibold text-[var(--pl-accent-ink)] hover:underline">Open timers</button>}>
            {pomodoro.phase === "work" ? "Focus" : "Break"}
          </CardTitle>
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            <div className="font-mono text-5xl font-bold tabular-nums text-[var(--pl-text)]">{formatClock(remaining)}</div>
            <div className="mt-4">
              {pomodoro.running ? (
                <Button variant="primary" size="lg" onClick={() => pauseTimer("pomodoro")}>
                  <Pause className="h-5 w-5" /> Pause
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    unlockAudio();
                    startTimer("pomodoro");
                  }}
                >
                  <Play className="h-5 w-5" /> Start focus
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={<ListTodo className="h-4 w-4" />} right={<button onClick={() => go("tasks")} className="cursor-pointer text-xs font-semibold text-[var(--pl-accent-ink)] hover:underline">All tasks</button>}>
            Up next
          </CardTitle>
          {data.upNext.length === 0 ? (
            <EmptyState>
              No open tasks.{" "}
              <button onClick={() => go("tasks")} className="cursor-pointer font-semibold text-[var(--pl-accent-ink)] hover:underline">
                Plan something
              </button>
            </EmptyState>
          ) : (
            <div className="space-y-1.5">
              {data.upNext.map((t) => {
                const a = assignmentName(t.assignmentId);
                const overdue = t.due && t.due < today;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[var(--pl-card2)] px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[var(--pl-accent)]"
                      onChange={() => usePlanly.getState().updateTask(t.id, { status: "done" })}
                      aria-label={`Complete ${t.title}`}
                    />
                    {t.link ? (
                      <a href={t.link} className="flex-1 truncate text-sm font-semibold text-[var(--pl-accent-ink)] hover:underline">{t.title}</a>
                    ) : (
                      <span className="flex-1 truncate text-sm text-[var(--pl-text)]">{t.title}</span>
                    )}
                    {a && <Badge color={a.color}>{a.name}</Badge>}
                    {t.due && (
                      <span className={cx("flex items-center gap-1 text-xs", overdue ? "text-red-400" : "text-[var(--pl-muted)]")}>
                        <CalendarClock className="h-3 w-3" />
                        {t.due === today ? "Today" : parseDayKey(t.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle icon={<Repeat className="h-4 w-4" />} right={<button onClick={() => go("habits")} className="cursor-pointer text-xs font-semibold text-[var(--pl-accent-ink)] hover:underline">Habits</button>}>
          Today&apos;s habits
        </CardTitle>
        {habits.length === 0 ? (
          <EmptyState>Track daily habits to build momentum.</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => {
              const done = !!h.log[today];
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id, today)}
                  className={cx("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors", done ? "border-transparent text-[#070a12]" : "border-[var(--pl-border)] text-[var(--pl-text)] hover:border-[var(--pl-accent)]")}
                  style={done ? { background: h.color } : undefined}
                  aria-pressed={done}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="h-3 w-3 rounded-full" style={{ background: h.color }} />}
                  {h.name}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button onClick={() => go("analytics")} className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-[var(--pl-accent-ink)] hover:underline">
          See your analytics <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
