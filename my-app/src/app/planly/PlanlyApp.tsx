"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  KanbanSquare,
  LayoutDashboard,
  NotebookText,
  Repeat,
  Settings as SettingsIcon,
  Timer,
  WifiOff,
  X,
} from "lucide-react";
import { usePlanly } from "./lib/store";
import { useNow, useTimerEngine, type Toast } from "./lib/hooks";
import { formatClock } from "./lib/utils";
import { cx, themeVars } from "./components/ui";
import Overview, { type TabId } from "./components/Overview";
import Timers from "./components/Timers";
import Tasks from "./components/Tasks";
import Calendar from "./components/Calendar";
import Habits from "./components/Habits";
import Settings from "./components/Settings";

// Heavier panels load only when opened.
const Analytics = dynamic(() => import("./components/Analytics"), { ssr: false, loading: () => <PanelLoading /> });
const Notes = dynamic(() => import("./components/Notes"), { ssr: false, loading: () => <PanelLoading /> });
const Sounds = dynamic(() => import("./components/Sounds"), { ssr: false, loading: () => <PanelLoading /> });

function PanelLoading() {
  return <div className="py-16 text-center text-sm text-[var(--pl-muted)]">Loading…</div>;
}

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "timers", label: "Timers", icon: Timer },
  { id: "tasks", label: "Tasks", icon: KanbanSquare },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "notes", label: "Notes", icon: NotebookText },
  { id: "habits", label: "Habits", icon: Repeat },
  { id: "sounds", label: "Sounds", icon: Headphones },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function RunningBadge({ go }: { go: (t: TabId) => void }) {
  const p = usePlanly((s) => s.pomodoro);
  const c = usePlanly((s) => s.countdown);
  const study = usePlanly((s) => s.study);
  const now = useNow(p.running || c.running || study.running, 1000);
  const items: string[] = [];
  if (p.running && p.endsAt) items.push(`${p.phase === "work" ? "Focus" : "Break"} ${formatClock(p.endsAt - now)}`);
  if (study.running && study.startedAt) items.push(`Study ${formatClock(now - study.startedAt)}`);
  if (c.running && c.endsAt) items.push(`${c.label || "Countdown"} ${formatClock(c.endsAt - now)}`);
  if (!items.length) return null;
  return (
    <button
      onClick={() => go("timers")}
      className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--pl-accent-line)] bg-[var(--pl-accent-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--pl-accent-ink)]"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--pl-accent)]" />
      {items.join(" · ")}
    </button>
  );
}


/**
 * Planly's section navigation.
 * - Phones: a compact "current section" button that opens a grid of all sections.
 * - Wider screens: a tab strip; when it overflows, fade edges and arrow buttons make the scrolling obvious.
 */
function PlanlyNav({ tab, go }: { tab: TabId; go: (t: TabId) => void }) {
  const [open, setOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  const CurrentIcon = current.icon;

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    // Keep the active tab in view.
    stripRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [tab, measure]);

  const scrollBy = (dx: number) => stripRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <nav className="sticky top-[68px] z-40 -mx-4 mb-5 bg-[var(--pl-bg)]/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6" aria-label="Planly sections">
      {/* Phones: compact menu */}
      <div className="sm:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="planly-section-menu"
          className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] px-4 py-3 text-sm font-semibold text-[var(--pl-text)]"
        >
          <span className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4 text-[var(--pl-accent-ink)]" />
            {current.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--pl-muted)]">
            All sections <ChevronDown className={cx("h-4 w-4 transition-transform", open && "rotate-180")} />
          </span>
        </button>
        {open && (
          <div id="planly-section-menu" className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] p-2 shadow-xl">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    go(t.id);
                    setOpen(false);
                  }}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={cx(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold",
                    tab === t.id ? "bg-[var(--pl-accent)] text-[var(--pl-on-accent)]" : "text-[var(--pl-text)] hover:bg-[var(--pl-hover)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tablet / desktop: tab strip with visible overflow cues */}
      <div className="relative hidden sm:block">
        {edges.left && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 rounded-l-2xl bg-gradient-to-r from-[var(--pl-card)] to-transparent" />
            <button onClick={() => scrollBy(-240)} aria-label="Scroll sections left" className="absolute left-1 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-[var(--pl-border)] bg-[var(--pl-card)] p-1 text-[var(--pl-text)] shadow">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
        <div ref={stripRef} onScroll={measure} className="overflow-x-auto rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] p-1 [scrollbar-width:none]">
          <div className="flex min-w-max gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={cx(
                    "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    tab === t.id ? "bg-[var(--pl-accent)] text-[var(--pl-on-accent)]" : "text-[var(--pl-muted)] hover:bg-[var(--pl-hover)] hover:text-[var(--pl-text)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        {edges.right && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 rounded-r-2xl bg-gradient-to-l from-[var(--pl-card)] to-transparent" />
            <button onClick={() => scrollBy(240)} aria-label="Scroll sections right" className="absolute right-1 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-[var(--pl-border)] bg-[var(--pl-card)] p-1 text-[var(--pl-text)] shadow">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export default function PlanlyApp() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const settings = usePlanly((s) => s.settings);

  // Data lives in localStorage, so render only on the client to avoid a hydration mismatch.
  useEffect(() => {
    setMounted(true);
    const syncFromHash = () => {
      const fromHash = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const go = useCallback((t: TabId) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pushToast = useCallback((t: Toast) => {
    setToasts((list) => [...list.slice(-2), t]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 8000);
  }, []);
  useTimerEngine(pushToast);

  // Offline support: register the service worker and track connectivity.
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const vars = themeVars(settings.theme, settings.accent);

  return (
    <div style={vars} className="min-h-screen bg-[var(--pl-bg)] font-body text-[var(--pl-text)] transition-colors" data-planly-theme={settings.theme}>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--pl-accent)] text-[var(--pl-on-accent)] shadow-lg">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-none tracking-tight">
                Planly <span className="font-tag text-base text-[var(--pl-accent-ink)]">by AssistIQ</span>
              </h1>
              <p className="text-xs text-[var(--pl-muted)]">Timers · tasks · calendar · habits — your study HQ</p>
            </div>
          </div>
          <div className="flex-1" />
          {mounted && <RunningBadge go={go} />}
          {!online && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400" title="Everything still works; AI tasks need a connection">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          {installEvent && (
            <button
              onClick={async () => {
                installEvent.prompt();
                await installEvent.userChoice.catch(() => null);
                setInstallEvent(null);
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--pl-border)] px-3 py-1 text-xs font-bold text-[var(--pl-text)] hover:border-[var(--pl-accent)]"
            >
              <Download className="h-3.5 w-3.5" /> Install app
            </button>
          )}
        </header>

        <PlanlyNav tab={tab} go={go} />

        {!mounted ? (
          <PanelLoading />
        ) : (
          <main>
            {tab === "overview" && <Overview go={go} />}
            {tab === "timers" && <Timers />}
            {tab === "tasks" && <Tasks />}
            {tab === "calendar" && <Calendar />}
            {tab === "analytics" && <Analytics />}
            {tab === "notes" && <Notes />}
            {tab === "habits" && <Habits />}
            {tab === "sounds" && <Sounds />}
            {tab === "settings" && <Settings />}
          </main>
        )}
      </div>

      <div className="fixed bottom-4 right-4 z-[150] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-2xl border border-[var(--pl-accent-line)] bg-[var(--pl-card)] p-3 shadow-2xl">
            <Timer className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--pl-accent-ink)]" />
            <div className="flex-1">
              <div className="text-sm font-bold text-[var(--pl-text)]">{t.title}</div>
              <div className="text-xs text-[var(--pl-muted)]">{t.body}</div>
            </div>
            <button onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} className="cursor-pointer text-[var(--pl-muted)] hover:text-[var(--pl-text)]" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
