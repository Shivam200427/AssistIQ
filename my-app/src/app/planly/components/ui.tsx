"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** CSS custom properties for the two themes; the accent comes from settings. */
export function themeVars(theme: "dark" | "light", accent: string): React.CSSProperties {
  const base =
    theme === "dark"
      ? {
          "--pl-bg": "#070a12",
          "--pl-card": "#0d1527",
          "--pl-card2": "rgba(0,0,0,0.35)",
          "--pl-border": "#16243f",
          "--pl-text": "#f1f5f9",
          "--pl-muted": "#94a3b8",
          "--pl-hover": "#131e36",
        }
      : {
          "--pl-bg": "#f3f6fb",
          "--pl-card": "#ffffff",
          "--pl-card2": "#f1f5f9",
          "--pl-border": "#dbe3ef",
          "--pl-text": "#0f172a",
          "--pl-muted": "#64748b",
          "--pl-hover": "#e8eef7",
        };
  return {
    ...base,
    "--pl-accent": accent,
    // Accent for text: darkened on light backgrounds so pale accents stay readable.
    "--pl-accent-ink": theme === "dark" ? accent : `color-mix(in srgb, ${accent} 60%, #0f172a)`,
    "--pl-accent-soft": `color-mix(in srgb, ${accent} 16%, transparent)`,
    "--pl-accent-line": `color-mix(in srgb, ${accent} 40%, transparent)`,
    "--pl-on-accent": "#070a12",
  } as React.CSSProperties;
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] p-4 sm:p-5 shadow-sm", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--pl-text)]">
        {icon && <span className="text-[var(--pl-accent-ink)]">{icon}</span>}
        {children}
      </h3>
      {right}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "soft";

export function Button({
  variant = "soft",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-3 text-base" };
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[var(--pl-accent)] text-[var(--pl-on-accent)] hover:brightness-110 font-bold",
    soft: "bg-[var(--pl-accent-soft)] text-[var(--pl-accent-ink)] border border-[var(--pl-accent-line)] hover:brightness-125 font-semibold",
    ghost: "text-[var(--pl-muted)] hover:text-[var(--pl-text)] hover:bg-[var(--pl-hover)] font-medium",
    danger: "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 font-semibold",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
        sizes[size],
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const inputBase =
  "rounded-xl border border-[var(--pl-border)] bg-[var(--pl-card2)] px-3 py-2 text-sm text-[var(--pl-text)] placeholder:text-[var(--pl-muted)] outline-none focus:border-[var(--pl-accent)] transition-colors";

export const inputClass = `w-full ${inputBase}`;

// Full width by default, unless the caller sizes the field itself (w-*, flex-1, …).
const sized = (className?: string) => /(^|\s)(w-|flex-1|min-w-)/.test(className || "");

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, !sized(props.className) && "w-full", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, "cursor-pointer", !sized(props.className) && "w-full", props.className)} />;
}

export function Badge({ color, children, className }: { color?: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", className)}
      style={
        color
          ? { color, background: `color-mix(in srgb, ${color} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={cx(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] p-5 text-[var(--pl-text)] shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pl-muted)] hover:text-[var(--pl-text)] cursor-pointer" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--pl-border)] bg-[var(--pl-card)] p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">
        {icon && <span className="text-[var(--pl-accent-ink)]">{icon}</span>}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-extrabold text-[var(--pl-text)]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--pl-muted)]">{hint}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[var(--pl-border)] p-6 text-center text-sm text-[var(--pl-muted)]">{children}</div>;
}
