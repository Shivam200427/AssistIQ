"use client";

import { useMemo, useState } from "react";
import { Bell, BellOff, Clock, Hourglass, Link2, Pause, Play, RotateCcw, SkipForward, Timer, Volume2, VolumeX } from "lucide-react";
import { phaseMs, usePlanly } from "../lib/store";
import { useNow } from "../lib/hooks";
import { requestNotificationPermission, unlockAudio, notificationsSupported } from "../lib/alerts";
import { dayKey, formatClock, formatDuration } from "../lib/utils";
import type { PomodoroPhase, TimerId } from "../lib/types";
import { Button, Card, CardTitle, Input, cx } from "./ui";
import Scratchpad from "./Scratchpad";

function Ring({ progress, children }: { progress: number; children: React.ReactNode }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--pl-border)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--pl-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function useAreas(): string[] {
  const assignments = usePlanly((s) => s.assignments);
  const sessions = usePlanly((s) => s.sessions);
  return useMemo(() => {
    const set = new Set<string>(["General"]);
    assignments.forEach((a) => set.add(a.name));
    sessions.slice(-200).forEach((s) => s.area && set.add(s.area));
    return [...set];
  }, [assignments, sessions]);
}

function PomodoroCard() {
  const p = usePlanly((s) => s.pomodoro);
  const settings = usePlanly((s) => s.settings);
  const { startTimer, pauseTimer, resetTimer, skipPomodoro, setPomodoroPhase, updateSettings } = usePlanly.getState();
  const now = useNow(p.running);
  const remaining = p.running && p.endsAt ? p.endsAt - now : p.remainingMs;
  const total = phaseMs(p.phase, settings);
  const areas = useAreas();
  const phases: { id: PomodoroPhase; label: string }[] = [
    { id: "work", label: "Focus" },
    { id: "short", label: "Short break" },
    { id: "long", label: "Long break" },
  ];
  const cycleDone = p.completedInCycle % Math.max(1, settings.longEvery);

  return (
    <Card>
      <CardTitle icon={<Timer className="h-4 w-4" />} right={<span className="text-xs text-[var(--pl-muted)]">#{p.completedInCycle + (p.phase === "work" ? 1 : 0)}</span>}>
        Pomodoro
      </CardTitle>
      <div className="mb-4 flex rounded-xl bg-[var(--pl-card2)] p-1">
        {phases.map((ph) => (
          <button
            key={ph.id}
            onClick={() => setPomodoroPhase(ph.id)}
            className={cx(
              "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors cursor-pointer",
              p.phase === ph.id ? "bg-[var(--pl-accent)] text-[var(--pl-on-accent)]" : "text-[var(--pl-muted)] hover:text-[var(--pl-text)]"
            )}
          >
            {ph.label}
          </button>
        ))}
      </div>
      <Ring progress={1 - remaining / total}>
        <div className="font-mono text-5xl font-bold tabular-nums text-[var(--pl-text)]">{formatClock(remaining)}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--pl-muted)]">
          {p.phase === "work" ? "Focus" : "Break"}
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: Math.max(1, settings.longEvery) }).map((_, i) => (
            <span key={i} className={cx("h-1.5 w-4 rounded-full", i < cycleDone ? "bg-[var(--pl-accent)]" : "bg-[var(--pl-border)]")} />
          ))}
        </div>
      </Ring>
      <div className="mt-4 flex justify-center gap-2">
        {p.running ? (
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
            <Play className="h-5 w-5" /> Start
          </Button>
        )}
        <Button variant="ghost" onClick={() => resetTimer("pomodoro")} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={skipPomodoro} title="Skip to next phase">
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">Working on</label>
        <Input
          list="planly-areas"
          value={settings.currentArea}
          onChange={(e) => updateSettings({ currentArea: e.target.value.slice(0, 60) })}
          placeholder="e.g. Maths, Physics lab"
        />
        <datalist id="planly-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
    </Card>
  );
}

function StudyCard() {
  const study = usePlanly((s) => s.study);
  const sessions = usePlanly((s) => s.sessions);
  const { startTimer, pauseTimer, setStudyArea } = usePlanly.getState();
  const now = useNow(study.running, 1000);
  const areas = useAreas();
  const current = study.running && study.startedAt ? now - study.startedAt : 0;
  const today = dayKey();
  const todaySec = sessions.filter((s) => dayKey(s.start) === today).reduce((a, s) => a + s.durationSec, 0);
  const areaSec = sessions.filter((s) => s.area === study.area).reduce((a, s) => a + s.durationSec, 0);

  return (
    <Card>
      <CardTitle icon={<Clock className="h-4 w-4" />}>Study timer</CardTitle>
      <div className="py-4 text-center">
        <div className="font-mono text-4xl font-bold tabular-nums text-[var(--pl-text)]">{formatClock(current)}</div>
        <div className="mt-1 text-xs text-[var(--pl-muted)]">{study.running ? `Tracking “${study.area}”` : "Stopwatch for open-ended focus"}</div>
      </div>
      <Input
        key={study.area}
        list="planly-areas"
        defaultValue={study.area}
        // Applied on blur / Enter: switching area while running closes the current segment.
        onBlur={(e) => {
          const next = e.target.value.trim().slice(0, 60) || "General";
          if (next !== study.area) setStudyArea(next);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="Area / subject"
      />
      <div className="mt-3 flex gap-2">
        {study.running ? (
          <Button variant="primary" className="flex-1" onClick={() => pauseTimer("study")}>
            <Pause className="h-4 w-4" /> Stop & save
          </Button>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              unlockAudio();
              startTimer("study");
            }}
          >
            <Play className="h-4 w-4" /> Start
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-[var(--pl-card2)] p-2">
          <div className="text-[10px] font-bold uppercase text-[var(--pl-muted)]">Today, all areas</div>
          <div className="text-sm font-bold text-[var(--pl-text)]">{formatDuration(todaySec + current / 1000)}</div>
        </div>
        <div className="rounded-xl bg-[var(--pl-card2)] p-2">
          <div className="text-[10px] font-bold uppercase text-[var(--pl-muted)]">All time, {study.area}</div>
          <div className="text-sm font-bold text-[var(--pl-text)]">{formatDuration(areaSec + current / 1000)}</div>
        </div>
      </div>
    </Card>
  );
}

function CountdownCard() {
  const c = usePlanly((s) => s.countdown);
  const { startTimer, pauseTimer, resetTimer, setCountdown } = usePlanly.getState();
  const now = useNow(c.running);
  const remaining = c.running && c.endsAt ? c.endsAt - now : c.remainingMs;
  const [h, setH] = useState("0");
  const [m, setM] = useState("10");
  const [s, setS] = useState("0");
  const [targetTime, setTargetTime] = useState("");

  const applyCustom = () => {
    const ms = ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)) * 1000;
    if (ms > 0) setCountdown(Math.min(ms, 24 * 3600 * 1000));
  };
  const applyTarget = () => {
    if (!targetTime) return;
    const [hh, mm] = targetTime.split(":").map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    setCountdown(target.getTime() - Date.now(), `Until ${targetTime}`);
  };

  return (
    <Card>
      <CardTitle icon={<Hourglass className="h-4 w-4" />}>Countdown</CardTitle>
      <div className="py-3 text-center">
        <div className={cx("font-mono text-4xl font-bold tabular-nums", remaining <= 0 ? "text-red-400" : "text-[var(--pl-text)]")}>
          {formatClock(remaining)}
        </div>
        <div className="mt-1 text-xs text-[var(--pl-muted)]">{c.label || "Countdown"}</div>
      </div>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        {[5, 10, 15, 25, 45, 60].map((min) => (
          <Button key={min} size="sm" variant="ghost" className="border border-[var(--pl-border)]" onClick={() => setCountdown(min * 60 * 1000, `${min} min`)}>
            {min}m
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input aria-label="Hours" type="number" min={0} max={23} value={h} onChange={(e) => setH(e.target.value)} className="text-center" />
        <span className="text-[var(--pl-muted)]">:</span>
        <Input aria-label="Minutes" type="number" min={0} max={59} value={m} onChange={(e) => setM(e.target.value)} className="text-center" />
        <span className="text-[var(--pl-muted)]">:</span>
        <Input aria-label="Seconds" type="number" min={0} max={59} value={s} onChange={(e) => setS(e.target.value)} className="text-center" />
        <Button size="sm" onClick={applyCustom}>
          Set
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Input aria-label="Count down to a time" type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} />
        <Button size="sm" onClick={applyTarget} disabled={!targetTime}>
          Until
        </Button>
      </div>
      <div className="mt-3 flex gap-2">
        {c.running ? (
          <Button variant="primary" className="flex-1" onClick={() => pauseTimer("countdown")}>
            <Pause className="h-4 w-4" /> Pause
          </Button>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            disabled={remaining <= 0}
            onClick={() => {
              unlockAudio();
              startTimer("countdown");
            }}
          >
            <Play className="h-4 w-4" /> Start
          </Button>
        )}
        <Button variant="ghost" onClick={() => resetTimer("countdown")} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function SyncAndAlerts() {
  const settings = usePlanly((s) => s.settings);
  const { updateSettings } = usePlanly.getState();
  const [permissionNote, setPermissionNote] = useState("");
  const timers: { id: TimerId; label: string }[] = [
    { id: "pomodoro", label: "Pomodoro" },
    { id: "study", label: "Study timer" },
    { id: "countdown", label: "Countdown" },
  ];
  const toggleSync = (id: TimerId) => {
    const set = new Set(settings.syncTimers);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateSettings({ syncTimers: [...set] });
  };
  const toggleNotifications = async () => {
    if (settings.notifications) {
      updateSettings({ notifications: false });
      return;
    }
    if (!notificationsSupported()) {
      setPermissionNote("This browser doesn't support notifications.");
      return;
    }
    const ok = await requestNotificationPermission();
    if (ok) {
      updateSettings({ notifications: true });
      setPermissionNote("");
    } else {
      setPermissionNote("Notifications are blocked. Allow them for this site in your browser settings.");
    }
  };

  return (
    <Card>
      <CardTitle icon={<Link2 className="h-4 w-4" />}>Timer sync & alerts</CardTitle>
      <p className="mb-2 text-xs text-[var(--pl-muted)]">Linked timers start and pause together.</p>
      <div className="flex flex-wrap gap-2">
        {timers.map((t) => (
          <label
            key={t.id}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              settings.syncTimers.includes(t.id)
                ? "border-[var(--pl-accent)] bg-[var(--pl-accent-soft)] text-[var(--pl-accent-ink)]"
                : "border-[var(--pl-border)] text-[var(--pl-muted)]"
            )}
          >
            <input type="checkbox" className="accent-[var(--pl-accent)]" checked={settings.syncTimers.includes(t.id)} onChange={() => toggleSync(t.id)} />
            {t.label}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={settings.sound ? "soft" : "ghost"} onClick={() => updateSettings({ sound: !settings.sound })}>
          {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound {settings.sound ? "on" : "off"}
        </Button>
        <Button variant={settings.notifications ? "soft" : "ghost"} onClick={toggleNotifications}>
          {settings.notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} Desktop alerts {settings.notifications ? "on" : "off"}
        </Button>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--pl-muted)]">
          <input type="checkbox" className="accent-[var(--pl-accent)]" checked={settings.autoStart} onChange={(e) => updateSettings({ autoStart: e.target.checked })} />
          Auto-start next phase
        </label>
      </div>
      {permissionNote && <p className="mt-2 text-xs text-amber-400">{permissionNote}</p>}
    </Card>
  );
}

export default function Timers() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <PomodoroCard />
      </div>
      <div className="space-y-4">
        <StudyCard />
        <CountdownCard />
      </div>
      <div className="space-y-4">
        <SyncAndAlerts />
        <Scratchpad />
      </div>
    </div>
  );
}
