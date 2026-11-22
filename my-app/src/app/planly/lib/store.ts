"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Assignment,
  CountdownState,
  Habit,
  Note,
  PomodoroPhase,
  PomodoroState,
  ScratchLine,
  Session,
  Settings,
  SoundPreset,
  StudyState,
  Task,
  TaskStatus,
  TimerId,
} from "./types";
import { dayKey, uid } from "./utils";

const MIN_SEGMENT_MS = 60 * 1000; // ignore focus segments shorter than a minute

export const defaultSettings: Settings = {
  theme: "dark",
  accent: "#38bdf8",
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: false,
  sound: true,
  notifications: false,
  syncTimers: [],
  currentArea: "General",
};

export function phaseMs(phase: PomodoroPhase, s: Settings): number {
  const min = phase === "work" ? s.workMin : phase === "short" ? s.shortMin : s.longMin;
  return Math.max(1, min) * 60 * 1000;
}

const initialPomodoro = (s: Settings): PomodoroState => ({
  phase: "work",
  running: false,
  endsAt: null,
  remainingMs: phaseMs("work", s),
  phaseStartedAt: null,
  completedInCycle: 0,
});

const initialStudy: StudyState = { running: false, startedAt: null, area: "General" };

const initialCountdown: CountdownState = {
  durationMs: 10 * 60 * 1000,
  running: false,
  endsAt: null,
  remainingMs: 10 * 60 * 1000,
  startedAt: null,
  label: "Countdown",
};

export interface TimerEvent {
  kind: "pomodoro" | "countdown";
  title: string;
  body: string;
}

export interface PlanlyData {
  settings: Settings;
  sessions: Session[];
  assignments: Assignment[];
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  scratch: ScratchLine[];
  soundPresets: SoundPreset[];
  pomodoro: PomodoroState;
  study: StudyState;
  countdown: CountdownState;
}

interface PlanlyActions {
  updateSettings: (patch: Partial<Settings>) => void;

  // timers
  startTimer: (id: TimerId) => void;
  pauseTimer: (id: TimerId) => void;
  resetTimer: (id: TimerId) => void;
  skipPomodoro: () => void;
  setPomodoroPhase: (phase: PomodoroPhase) => void;
  setCountdown: (ms: number, label?: string) => void;
  setStudyArea: (area: string) => void;
  /** Called by the timer engine; returns the alert to show, if a timer just finished. */
  tick: (now: number) => TimerEvent[];
  deleteSession: (id: string) => void;

  // tasks
  addAssignment: (a: Omit<Assignment, "id" | "createdAt">) => string;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  addTask: (t: Partial<Task> & { title: string }) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus, beforeId?: string | null) => void;

  // notes
  addNote: () => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  // habits
  addHabit: (name: string, color: string) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  toggleHabit: (id: string, day: string) => void;
  deleteHabit: (id: string) => void;

  // scratchpad
  setScratch: (lines: ScratchLine[]) => void;

  // sounds
  saveSoundPreset: (name: string, volumes: Record<string, number>) => void;
  deleteSoundPreset: (id: string) => void;

  // data
  importData: (data: Partial<PlanlyData>) => void;
  resetAll: () => void;
}

export type PlanlyStore = PlanlyData & PlanlyActions;

const emptyData = (): PlanlyData => ({
  settings: { ...defaultSettings },
  sessions: [],
  assignments: [],
  tasks: [],
  notes: [],
  habits: [],
  scratch: [{ id: uid(), text: "", checkbox: false, checked: false }],
  soundPresets: [],
  pomodoro: initialPomodoro(defaultSettings),
  study: { ...initialStudy },
  countdown: { ...initialCountdown },
});

function makeSession(type: TimerId, area: string, start: number, end: number, completed: boolean): Session | null {
  if (end - start < MIN_SEGMENT_MS && !completed) return null;
  return {
    id: uid(),
    type,
    area: area || "General",
    start,
    end,
    durationSec: Math.round((end - start) / 1000),
    completed,
  };
}

export const usePlanly = create<PlanlyStore>()(
  persist(
    (set, get) => {
      const addSession = (s: Session | null) => {
        if (s) set((st) => ({ sessions: [...st.sessions, s] }));
      };

      const startOne = (id: TimerId, now: number) => {
        const st = get();
        if (id === "pomodoro" && !st.pomodoro.running) {
          set({
            pomodoro: {
              ...st.pomodoro,
              running: true,
              endsAt: now + st.pomodoro.remainingMs,
              phaseStartedAt: now,
            },
          });
        }
        if (id === "study" && !st.study.running) {
          set({ study: { ...st.study, running: true, startedAt: now } });
        }
        if (id === "countdown" && !st.countdown.running && st.countdown.remainingMs > 0) {
          set({
            countdown: { ...st.countdown, running: true, endsAt: now + st.countdown.remainingMs, startedAt: now },
          });
        }
      };

      const pauseOne = (id: TimerId, now: number) => {
        const st = get();
        if (id === "pomodoro" && st.pomodoro.running) {
          const p = st.pomodoro;
          if (p.phase === "work" && p.phaseStartedAt) {
            addSession(makeSession("pomodoro", st.settings.currentArea, p.phaseStartedAt, now, false));
          }
          set({
            pomodoro: { ...p, running: false, endsAt: null, remainingMs: Math.max(0, (p.endsAt || now) - now), phaseStartedAt: null },
          });
        }
        if (id === "study" && st.study.running && st.study.startedAt) {
          addSession(makeSession("study", st.study.area, st.study.startedAt, now, false));
          set({ study: { ...st.study, running: false, startedAt: null } });
        }
        if (id === "countdown" && st.countdown.running) {
          const c = st.countdown;
          if (c.startedAt) addSession(makeSession("countdown", st.settings.currentArea, c.startedAt, now, false));
          set({
            countdown: { ...c, running: false, endsAt: null, startedAt: null, remainingMs: Math.max(0, (c.endsAt || now) - now) },
          });
        }
      };

      const linked = (id: TimerId): TimerId[] => {
        const group = get().settings.syncTimers;
        return group.includes(id) ? group : [id];
      };

      const nextPhase = (p: PomodoroState, s: Settings, countedWork: boolean): PomodoroState => {
        if (p.phase === "work") {
          const completed = p.completedInCycle + (countedWork ? 1 : 0);
          const isLong = completed > 0 && completed % Math.max(1, s.longEvery) === 0;
          const phase: PomodoroPhase = isLong ? "long" : "short";
          return { ...p, phase, completedInCycle: completed, remainingMs: phaseMs(phase, s), running: false, endsAt: null, phaseStartedAt: null };
        }
        return { ...p, phase: "work", remainingMs: phaseMs("work", s), running: false, endsAt: null, phaseStartedAt: null };
      };

      return {
        ...emptyData(),

        updateSettings: (patch) =>
          set((st) => {
            const settings = { ...st.settings, ...patch };
            const durationsChanged = ["workMin", "shortMin", "longMin"].some((k) => k in patch);
            // Apply new interval lengths to an idle pomodoro right away.
            const pomodoro =
              durationsChanged && !st.pomodoro.running
                ? { ...st.pomodoro, remainingMs: phaseMs(st.pomodoro.phase, settings) }
                : st.pomodoro;
            return { settings, pomodoro };
          }),

        startTimer: (id) => {
          const now = Date.now();
          linked(id).forEach((t) => startOne(t, now));
        },
        pauseTimer: (id) => {
          const now = Date.now();
          linked(id).forEach((t) => pauseOne(t, now));
        },
        resetTimer: (id) => {
          pauseOne(id, Date.now());
          const st = get();
          if (id === "pomodoro") set({ pomodoro: { ...st.pomodoro, remainingMs: phaseMs(st.pomodoro.phase, st.settings) } });
          if (id === "countdown") set({ countdown: { ...st.countdown, remainingMs: st.countdown.durationMs } });
        },
        skipPomodoro: () => {
          pauseOne("pomodoro", Date.now());
          const st = get();
          set({ pomodoro: nextPhase(st.pomodoro, st.settings, false) });
        },
        setPomodoroPhase: (phase) => {
          pauseOne("pomodoro", Date.now());
          const st = get();
          set({ pomodoro: { ...st.pomodoro, phase, remainingMs: phaseMs(phase, st.settings) } });
        },
        setCountdown: (ms, label) => {
          pauseOne("countdown", Date.now());
          const st = get();
          const durationMs = Math.max(1000, ms);
          set({ countdown: { ...st.countdown, durationMs, remainingMs: durationMs, label: label ?? st.countdown.label } });
        },
        setStudyArea: (area) => {
          const st = get();
          if (st.study.running) {
            // Close the running segment under the old area, then continue under the new one.
            pauseOne("study", Date.now());
            set({ study: { ...get().study, area } });
            startOne("study", Date.now());
          } else {
            set({ study: { ...st.study, area } });
          }
        },

        tick: (now) => {
          const events: TimerEvent[] = [];
          const st = get();
          const p = st.pomodoro;
          if (p.running && p.endsAt && now >= p.endsAt) {
            if (p.phase === "work") {
              addSession(makeSession("pomodoro", st.settings.currentArea, p.phaseStartedAt || p.endsAt - phaseMs("work", st.settings), p.endsAt, true));
            }
            const next = nextPhase(p, st.settings, p.phase === "work");
            set({ pomodoro: next });
            events.push({
              kind: "pomodoro",
              title: p.phase === "work" ? "Focus session complete 🎉" : "Break's over",
              body: p.phase === "work" ? `Time for a ${next.phase === "long" ? "long" : "short"} break.` : "Back to focus mode.",
            });
            if (st.settings.autoStart) startOne("pomodoro", now);
          }
          const c = get().countdown;
          if (c.running && c.endsAt && now >= c.endsAt) {
            if (c.startedAt) addSession(makeSession("countdown", get().settings.currentArea, c.startedAt, c.endsAt, true));
            set({ countdown: { ...c, running: false, endsAt: null, startedAt: null, remainingMs: 0 } });
            events.push({ kind: "countdown", title: `${c.label || "Countdown"} finished ⏰`, body: "Your countdown timer reached zero." });
          }
          return events;
        },
        deleteSession: (id) => set((st) => ({ sessions: st.sessions.filter((s) => s.id !== id) })),

        addAssignment: (a) => {
          const id = uid();
          set((st) => ({ assignments: [...st.assignments, { ...a, id, createdAt: Date.now() }] }));
          return id;
        },
        updateAssignment: (id, patch) =>
          set((st) => ({ assignments: st.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
        deleteAssignment: (id) =>
          set((st) => ({
            assignments: st.assignments.filter((a) => a.id !== id),
            tasks: st.tasks.map((t) => (t.assignmentId === id ? { ...t, assignmentId: null } : t)),
          })),
        addTask: (t) => {
          const id = uid();
          const status = t.status || "todo";
          set((st) => {
            const minOrder = Math.min(0, ...st.tasks.filter((x) => x.status === status).map((x) => x.order));
            const task: Task = {
              id,
              title: t.title.trim().slice(0, 300),
              notes: t.notes || "",
              status,
              assignmentId: t.assignmentId ?? null,
              tags: t.tags || [],
              due: t.due ?? null,
              difficulty: t.difficulty || "medium",
              pinned: t.pinned || false,
              link: typeof t.link === "string" && t.link.startsWith("/") ? t.link : null,
              order: minOrder - 1,
              createdAt: Date.now(),
              completedAt: status === "done" ? Date.now() : null,
            };
            return { tasks: [...st.tasks, task] };
          });
          return id;
        },
        updateTask: (id, patch) =>
          set((st) => ({
            tasks: st.tasks.map((t) => {
              if (t.id !== id) return t;
              const next = { ...t, ...patch };
              if (patch.status && patch.status !== t.status) next.completedAt = patch.status === "done" ? Date.now() : null;
              return next;
            }),
          })),
        deleteTask: (id) => set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) })),
        moveTask: (id, status, beforeId) =>
          set((st) => {
            const task = st.tasks.find((t) => t.id === id);
            if (!task) return {};
            const column = st.tasks
              .filter((t) => t.status === status && t.id !== id)
              .sort((a, b) => a.order - b.order);
            const idx = beforeId ? column.findIndex((t) => t.id === beforeId) : -1;
            const insertAt = idx === -1 ? column.length : idx;
            column.splice(insertAt, 0, task);
            const orders = new Map(column.map((t, i) => [t.id, i]));
            return {
              tasks: st.tasks.map((t) => {
                if (t.id === id) {
                  return {
                    ...t,
                    status,
                    order: orders.get(id)!,
                    completedAt: status === "done" ? t.completedAt || Date.now() : null,
                  };
                }
                return orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t;
              }),
            };
          }),

        addNote: () => {
          const id = uid();
          const now = Date.now();
          set((st) => ({ notes: [{ id, title: "Untitled note", html: "", createdAt: now, updatedAt: now }, ...st.notes] }));
          return id;
        },
        updateNote: (id, patch) =>
          set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) })),
        deleteNote: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id) })),

        addHabit: (name, color) =>
          set((st) => ({ habits: [...st.habits, { id: uid(), name: name.trim().slice(0, 80), color, createdAt: Date.now(), log: {} }] })),
        updateHabit: (id, patch) => set((st) => ({ habits: st.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
        toggleHabit: (id, day) =>
          set((st) => ({
            habits: st.habits.map((h) => {
              if (h.id !== id) return h;
              const log = { ...h.log };
              if (log[day]) delete log[day];
              else log[day] = true;
              return { ...h, log };
            }),
          })),
        deleteHabit: (id) => set((st) => ({ habits: st.habits.filter((h) => h.id !== id) })),

        setScratch: (lines) => set({ scratch: lines.length ? lines : [{ id: uid(), text: "", checkbox: false, checked: false }] }),

        saveSoundPreset: (name, volumes) =>
          set((st) => ({ soundPresets: [...st.soundPresets, { id: uid(), name: name.trim().slice(0, 40) || "My mix", volumes }] })),
        deleteSoundPreset: (id) => set((st) => ({ soundPresets: st.soundPresets.filter((p) => p.id !== id) })),

        importData: (data) =>
          set(() => {
            const base = emptyData();
            return {
              settings: { ...base.settings, ...(data.settings || {}) },
              sessions: Array.isArray(data.sessions) ? data.sessions : [],
              assignments: Array.isArray(data.assignments) ? data.assignments : [],
              tasks: Array.isArray(data.tasks) ? data.tasks : [],
              notes: Array.isArray(data.notes) ? data.notes : [],
              habits: Array.isArray(data.habits) ? data.habits : [],
              scratch: Array.isArray(data.scratch) && data.scratch.length ? data.scratch : base.scratch,
              soundPresets: Array.isArray(data.soundPresets) ? data.soundPresets : [],
              pomodoro: initialPomodoro({ ...base.settings, ...(data.settings || {}) }),
              study: { ...initialStudy },
              countdown: { ...initialCountdown },
            };
          }),
        resetAll: () => set(emptyData()),
      };
    },
    {
      name: "planly-data-v1",
      version: 1,
    }
  )
);

export function exportableData(st: PlanlyData): PlanlyData {
  const { settings, sessions, assignments, tasks, notes, habits, scratch, soundPresets, pomodoro, study, countdown } = st;
  return { settings, sessions, assignments, tasks, notes, habits, scratch, soundPresets, pomodoro, study, countdown };
}

export function todayKey() {
  return dayKey();
}
