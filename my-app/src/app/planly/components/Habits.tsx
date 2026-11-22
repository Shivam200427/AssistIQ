"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Flame, Plus, Repeat, Trash2 } from "lucide-react";
import { usePlanly } from "../lib/store";
import { COLORS, addDays, dayKey, habitStreak, startOfWeek } from "../lib/utils";
import type { Habit } from "../lib/types";
import { Button, Card, CardTitle, EmptyState, Input, cx } from "./ui";

function MiniHeatmap({ habit }: { habit: Habit }) {
  const weeks = 12;
  const start = addDays(startOfWeek(new Date()), -(weeks - 1) * 7);
  const today = dayKey();
  return (
    <div className="flex gap-[2px]" aria-label={`${habit.name}: last 12 weeks`}>
      {Array.from({ length: weeks }).map((_, w) => (
        <div key={w} className="flex flex-col gap-[2px]">
          {Array.from({ length: 7 }).map((__, d) => {
            const k = dayKey(addDays(start, w * 7 + d));
            const done = !!habit.log[k];
            return (
              <div
                key={d}
                title={k}
                className="h-2 w-2 rounded-[2px]"
                style={{ background: k > today ? "transparent" : done ? habit.color : "var(--pl-border)", opacity: k > today ? 0 : done ? 1 : 0.6 }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function longestHabitStreak(log: Record<string, boolean>): number {
  const keys = Object.keys(log).filter((k) => log[k]).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const k of keys) {
    run = prev && dayKey(addDays(new Date(`${prev}T00:00:00`), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export default function Habits() {
  const habits = usePlanly((s) => s.habits);
  const { addHabit, toggleHabit, deleteHabit, updateHabit } = usePlanly.getState();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[2]);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = dayKey();

  const doneToday = habits.filter((h) => h.log[today]).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          icon={<Repeat className="h-4 w-4" />}
          right={
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center text-xs font-semibold text-[var(--pl-muted)]">
                {weekOffset === 0 ? "This week" : weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setWeekOffset((w) => Math.min(0, w + 1))} disabled={weekOffset === 0} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          Habit tracker {habits.length > 0 && <span className="font-medium normal-case text-[var(--pl-muted)]">· {doneToday}/{habits.length} today</span>}
        </CardTitle>

        {habits.length === 0 ? (
          <EmptyState>Add a habit like “Read 20 pages”, “Revise flashcards” or “No phone before 10am”.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[var(--pl-muted)]">
                  <th className="text-left font-bold">Habit</th>
                  {days.map((d) => (
                    <th key={dayKey(d)} className={cx("w-11 text-center font-bold", dayKey(d) === today && "text-[var(--pl-accent-ink)]")}>
                      {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                      <div className="text-[10px] font-medium">{d.getDate()}</div>
                    </th>
                  ))}
                  <th className="w-20 text-center font-bold">Streak</th>
                  <th className="hidden text-left font-bold md:table-cell">12 weeks</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const streak = habitStreak(h.log);
                  return (
                    <tr key={h.id} className="bg-[var(--pl-card2)]">
                      <td className="rounded-l-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input type="color" value={h.color} onChange={(e) => updateHabit(h.id, { color: e.target.value })} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent" aria-label="Colour" />
                          <input
                            value={h.name}
                            onChange={(e) => updateHabit(h.id, { name: e.target.value.slice(0, 80) })}
                            className="w-full min-w-[120px] bg-transparent text-sm font-semibold text-[var(--pl-text)] outline-none"
                            aria-label="Habit name"
                          />
                        </div>
                      </td>
                      {days.map((d) => {
                        const k = dayKey(d);
                        const done = !!h.log[k];
                        const future = k > today;
                        return (
                          <td key={k} className="text-center">
                            <button
                              disabled={future}
                              onClick={() => toggleHabit(h.id, k)}
                              className={cx(
                                "mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-30",
                                done ? "border-transparent text-[#070a12]" : "border-[var(--pl-border)] hover:border-[var(--pl-accent)]"
                              )}
                              style={done ? { background: h.color } : undefined}
                              aria-label={`${h.name} on ${k}: ${done ? "done" : "not done"}`}
                              aria-pressed={done}
                            >
                              {done && <Check className="h-4 w-4" strokeWidth={3} />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--pl-text)]" title={`Longest: ${longestHabitStreak(h.log)} days`}>
                          <Flame className={cx("h-4 w-4", streak > 0 ? "text-orange-400" : "text-[var(--pl-muted)]")} />
                          {streak}
                        </span>
                      </td>
                      <td className="hidden py-2 md:table-cell">
                        <MiniHeatmap habit={h} />
                      </td>
                      <td className="rounded-r-xl pr-2 text-center">
                        <button
                          onClick={() => confirm(`Delete habit “${h.name}” and its history?`) && deleteHabit(h.id)}
                          className="cursor-pointer rounded p-1 text-[var(--pl-muted)] hover:text-red-400"
                          aria-label="Delete habit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--pl-border)] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            addHabit(name, color);
            setName("");
            setColor(COLORS[(habits.length + 3) % COLORS.length]);
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent" aria-label="Habit colour" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New habit" className="min-w-[180px] flex-1" />
          <Button variant="primary" type="submit" disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add habit
          </Button>
        </form>
      </Card>
    </div>
  );
}
