"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Clock, Flame, Share2, Table2, Timer, Trophy } from "lucide-react";
import { usePlanly } from "../lib/store";
import { activeDays, addDays, dayKey, formatDuration, lastNDays, startOfWeek, streakStats } from "../lib/utils";
import { Button, Card, CardTitle, EmptyState, Select, Stat, cx } from "./ui";
import StreakCardModal from "./StreakCard";

const axisProps = {
  stroke: "var(--pl-muted)",
  tick: { fill: "var(--pl-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--pl-border)" },
} as const;

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--pl-border)] bg-[var(--pl-card)] px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-semibold text-[var(--pl-text)]">{label}</div>
      <div className="text-[var(--pl-muted)]">
        {payload[0].value} {unit}
      </div>
    </div>
  );
}

function SingleBar({ data, dataKey, xKey, unit, height = 220, layout = "horizontal" }: { data: any[]; dataKey: string; xKey: string; unit: string; height?: number; layout?: "horizontal" | "vertical" }) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: vertical ? 8 : -16, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke="var(--pl-border)" strokeDasharray="0" vertical={vertical} horizontal={!vertical} strokeOpacity={0.6} />
        {vertical ? (
          <>
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey={xKey} {...axisProps} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
            <YAxis {...axisProps} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={{ fill: "var(--pl-accent-soft)" }} content={<ChartTooltip unit={unit} />} />
        <Bar dataKey={dataKey} fill="var(--pl-accent)" radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Heatmap({ days }: { days: Record<string, number> }) {
  // 17 weeks, Monday-first columns. Opacity steps of the accent = one-hue sequential scale.
  const weeks = 17;
  const start = addDays(startOfWeek(new Date()), -(weeks - 1) * 7);
  const today = dayKey();
  const levels = (min: number) => (min <= 0 ? 0 : min < 25 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4);
  const opacity = [0, 0.3, 0.5, 0.75, 1];
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((__, d) => {
              const date = addDays(start, w * 7 + d);
              const k = dayKey(date);
              const future = k > today;
              const min = Math.round(days[k] || 0);
              const lvl = levels(min);
              return (
                <div
                  key={d}
                  title={future ? "" : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${min} min`}
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    background: future ? "transparent" : lvl === 0 ? "var(--pl-border)" : "var(--pl-accent)",
                    opacity: future ? 0 : lvl === 0 ? 0.6 : opacity[lvl],
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--pl-muted)]">
        Less
        {opacity.map((o, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: i === 0 ? "var(--pl-border)" : "var(--pl-accent)", opacity: i === 0 ? 0.6 : o }} />
        ))}
        More · daily focus minutes
      </div>
    </div>
  );
}

export default function Analytics() {
  const sessions = usePlanly((s) => s.sessions);
  const tasks = usePlanly((s) => s.tasks);
  const [range, setRange] = useState(14);
  const [showTable, setShowTable] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const stats = useMemo(() => {
    const keys = lastNDays(range);
    const inRange = new Set(keys);
    const perDay = Object.fromEntries(keys.map((k) => [k, { focus: 0, pomodoros: 0, sessions: 0, tasks: 0 }]));
    const byArea: Record<string, number> = {};
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}h`, sessions: 0 }));
    for (const s of sessions) {
      const k = dayKey(s.start);
      if (!inRange.has(k)) continue;
      perDay[k].focus += s.durationSec / 60;
      perDay[k].sessions += 1;
      if (s.type === "pomodoro" && s.completed) perDay[k].pomodoros += 1;
      byArea[s.area || "General"] = (byArea[s.area || "General"] || 0) + s.durationSec / 60;
      byHour[new Date(s.start).getHours()].sessions += 1;
    }
    for (const t of tasks) {
      if (!t.completedAt) continue;
      const k = dayKey(t.completedAt);
      if (inRange.has(k)) perDay[k].tasks += 1;
    }
    const daily = keys.map((k) => {
      const d = new Date(`${k}T00:00:00`);
      return {
        key: k,
        label: d.toLocaleDateString(undefined, range > 14 ? { month: "short", day: "numeric" } : { weekday: "short", day: "numeric" }),
        focus: Math.round(perDay[k].focus),
        pomodoros: perDay[k].pomodoros,
        sessions: perDay[k].sessions,
        tasks: perDay[k].tasks,
      };
    });
    const areas = Object.entries(byArea)
      .map(([area, min]) => ({ area, minutes: Math.round(min) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);

    const allFocus: Record<string, number> = {};
    for (const s of sessions) allFocus[dayKey(s.start)] = (allFocus[dayKey(s.start)] || 0) + s.durationSec / 60;
    const streak = streakStats(activeDays(sessions, tasks));
    const totalFocusSec = daily.reduce((a, d) => a + d.focus * 60, 0);
    return {
      daily,
      areas,
      byHour,
      allFocus,
      streak,
      totalFocusSec,
      pomodoros: daily.reduce((a, d) => a + d.pomodoros, 0),
      sessionCount: daily.reduce((a, d) => a + d.sessions, 0),
      tasksDone: daily.reduce((a, d) => a + d.tasks, 0),
      activeInRange: daily.filter((d) => d.focus >= 1 || d.tasks > 0).length,
    };
  }, [sessions, tasks, range]);

  const hasData = sessions.length > 0 || tasks.some((t) => t.completedAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onChange={(e) => setRange(Number(e.target.value))} className="w-auto" aria-label="Date range">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </Select>
        <Button variant={showTable ? "soft" : "ghost"} onClick={() => setShowTable((v) => !v)}>
          <Table2 className="h-4 w-4" /> {showTable ? "Show charts" : "Data table"}
        </Button>
        <div className="flex-1" />
        <Button variant="primary" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4" /> Share streak card
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Current streak" value={`${stats.streak.current}d`} hint="days in a row" />
        <Stat icon={<Trophy className="h-3.5 w-3.5" />} label="Longest streak" value={`${stats.streak.longest}d`} />
        <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Focus time" value={formatDuration(stats.totalFocusSec)} hint={`last ${range} days`} />
        <Stat icon={<Timer className="h-3.5 w-3.5" />} label="Pomodoros" value={stats.pomodoros} hint="completed" />
        <Stat icon={<BarChart3 className="h-3.5 w-3.5" />} label="Sessions" value={stats.sessionCount} hint={`${stats.activeInRange}/${range} active days`} />
        <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Tasks done" value={stats.tasksDone} />
      </div>

      <Card>
        <CardTitle icon={<Flame className="h-4 w-4" />}>Consistency</CardTitle>
        <Heatmap days={stats.allFocus} />
      </Card>

      {!hasData ? (
        <EmptyState>Run a timer or finish a task to start building your stats.</EmptyState>
      ) : showTable ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--pl-border)] text-left text-[11px] uppercase tracking-wider text-[var(--pl-muted)]">
                <th className="py-2 pr-3">Day</th>
                <th className="py-2 pr-3 text-right">Focus (min)</th>
                <th className="py-2 pr-3 text-right">Pomodoros</th>
                <th className="py-2 pr-3 text-right">Sessions</th>
                <th className="py-2 text-right">Tasks done</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.daily].reverse().map((d) => (
                <tr key={d.key} className="border-b border-[var(--pl-border)] last:border-0 text-[var(--pl-text)]">
                  <td className="py-1.5 pr-3">{d.key}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.focus}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.pomodoros}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.sessions}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle icon={<Clock className="h-4 w-4" />}>Focus minutes per day</CardTitle>
            <SingleBar data={stats.daily} dataKey="focus" xKey="label" unit="min" />
          </Card>
          <Card>
            <CardTitle icon={<Timer className="h-4 w-4" />}>Pomodoros completed</CardTitle>
            <SingleBar data={stats.daily} dataKey="pomodoros" xKey="label" unit="pomodoros" />
          </Card>
          <Card>
            <CardTitle icon={<CheckCircle2 className="h-4 w-4" />}>Tasks completed — trend</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--pl-border)" vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "var(--pl-muted)", strokeDasharray: "3 3" }} content={<ChartTooltip unit="tasks" />} />
                <Line type="monotone" dataKey="tasks" stroke="var(--pl-accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--pl-accent)", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--pl-card)", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <CardTitle icon={<BarChart3 className="h-4 w-4" />}>When you study — sessions by hour</CardTitle>
            <SingleBar data={stats.byHour} dataKey="sessions" xKey="hour" unit="sessions" />
          </Card>
          <Card className={cx("lg:col-span-2")}>
            <CardTitle icon={<BarChart3 className="h-4 w-4" />}>Focus by area (minutes)</CardTitle>
            {stats.areas.length ? (
              <SingleBar data={stats.areas} dataKey="minutes" xKey="area" unit="min" layout="vertical" height={Math.max(160, stats.areas.length * 36)} />
            ) : (
              <EmptyState>No focus sessions in this range.</EmptyState>
            )}
          </Card>
        </div>
      )}

      <StreakCardModal open={shareOpen} onClose={() => setShareOpen(false)} streak={stats.streak} focusByDay={stats.allFocus} />
    </div>
  );
}
