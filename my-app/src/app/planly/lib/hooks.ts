"use client";

import { useEffect, useRef, useState } from "react";
import { usePlanly } from "./store";
import { notify, playChime } from "./alerts";
import { formatClock } from "./utils";

/** Re-renders every `ms` while `active` is true; returns the current time. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return active ? now : Date.now();
}

export interface Toast {
  id: number;
  title: string;
  body: string;
}

/**
 * Drives all timers: finishes phases/countdowns from their end timestamps (so they stay accurate
 * when the tab is in the background), plays alerts, sends notifications and updates the tab title.
 */
export function useTimerEngine(onToast: (t: Toast) => void) {
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  useEffect(() => {
    const baseTitle = "Planly · AssistIQ";
    const id = setInterval(() => {
      const st = usePlanly.getState();
      const events = st.tick(Date.now());
      for (const ev of events) {
        if (st.settings.sound) playChime(ev.kind === "countdown" ? 3 : 1);
        if (st.settings.notifications) notify(ev.title, ev.body);
        toastRef.current({ id: Date.now() + Math.random(), title: ev.title, body: ev.body });
      }

      const s = usePlanly.getState();
      const now = Date.now();
      if (s.pomodoro.running && s.pomodoro.endsAt) {
        const label = s.pomodoro.phase === "work" ? "Focus" : "Break";
        document.title = `${formatClock(s.pomodoro.endsAt - now)} · ${label} — Planly`;
      } else if (s.countdown.running && s.countdown.endsAt) {
        document.title = `${formatClock(s.countdown.endsAt - now)} · ${s.countdown.label || "Countdown"} — Planly`;
      } else if (s.study.running && s.study.startedAt) {
        document.title = `${formatClock(now - s.study.startedAt)} · Studying — Planly`;
      } else if (document.title !== baseTitle) {
        document.title = baseTitle;
      }
    }, 500);
    return () => {
      clearInterval(id);
      document.title = "AssistIQ | Street-Smart Academic AI";
    };
  }, []);
}
