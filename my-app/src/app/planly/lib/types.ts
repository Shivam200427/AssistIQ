export type TimerId = "pomodoro" | "study" | "countdown";
export type PomodoroPhase = "work" | "short" | "long";
export type TaskStatus = "todo" | "doing" | "done";
export type Difficulty = "easy" | "medium" | "hard";
export type ThemeMode = "dark" | "light";

export interface Session {
  id: string;
  type: TimerId;
  area: string;
  start: number; // epoch ms
  end: number; // epoch ms
  durationSec: number;
  completed: boolean; // pomodoro finished its full work interval
}

export interface Assignment {
  id: string;
  name: string;
  category: string;
  color: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  assignmentId: string | null;
  tags: string[];
  due: string | null; // YYYY-MM-DD
  difficulty: Difficulty;
  pinned: boolean;
  order: number;
  createdAt: number;
  completedAt: number | null;
}

export interface Note {
  id: string;
  title: string;
  html: string;
  autoTitle?: boolean; // title follows the first line until renamed by hand
  updatedAt: number;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  log: Record<string, boolean>; // YYYY-MM-DD -> done
}

export interface ScratchLine {
  id: string;
  text: string;
  checkbox: boolean;
  checked: boolean;
}

export interface SoundPreset {
  id: string;
  name: string;
  volumes: Record<string, number>; // soundId -> 0..100, only active sounds
}

export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
  phaseStartedAt: number | null;
  completedInCycle: number;
}

export interface StudyState {
  running: boolean;
  startedAt: number | null;
  area: string;
}

export interface CountdownState {
  durationMs: number;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
  startedAt: number | null;
  label: string;
}

export interface Settings {
  theme: ThemeMode;
  accent: string;
  workMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  autoStart: boolean;
  sound: boolean;
  notifications: boolean;
  syncTimers: TimerId[];
  currentArea: string;
}
