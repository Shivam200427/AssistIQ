import type { Metadata, Viewport } from "next";
import PlanlyApp from "./PlanlyApp";

export const metadata: Metadata = {
  title: "Planly · AssistIQ",
  description: "Planly — Pomodoro & study timers, kanban tasks with AI, calendar, analytics, notes, habits and ambient sounds.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Planly", statusBarStyle: "black-translucent" },
  icons: { icon: "/planly-icon-192.png", apple: "/planly-icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
};

export default function PlanlyPage() {
  return <PlanlyApp />;
}
