"use client";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** A short three-note chime. `repeat` plays it several times (used as an alarm). */
export function playChime(repeat = 1) {
  const ac = audio();
  if (!ac) return;
  const notes = [880, 1108.73, 1318.51];
  for (let r = 0; r < repeat; r++) {
    notes.forEach((freq, i) => {
      const t = ac.currentTime + r * 1.1 + i * 0.18;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }
}

/** Browsers only allow audio after a user gesture; call this from a click to unlock it. */
export function unlockAudio() {
  audio();
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/planly-icon-192.png", tag: "planly-timer" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: "/planly-icon-192.png" })).catch(() => {});
  }
}
