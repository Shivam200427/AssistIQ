"use client";

import { useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Headphones, Save, Square, Trash2 } from "lucide-react";
import { BUILT_IN_PRESETS, SOUNDS, setMasterVolume, setSound, setSoundVolume, stopAllSounds } from "../lib/noise";
import { usePlanly } from "../lib/store";
import { Button, Card, CardTitle, Input, cx } from "./ui";

interface MixerState {
  active: Record<string, boolean>;
  volumes: Record<string, number>;
  master: number;
  setActive: (id: string, on: boolean) => void;
  setVolume: (id: string, v: number) => void;
  setMaster: (v: number) => void;
  clearActive: () => void;
}

// Playback state lives outside the panel so sounds keep playing while you use other tabs.
export const useMixer = create<MixerState>()(
  persist(
    (set) => ({
      active: {},
      volumes: Object.fromEntries(SOUNDS.map((s) => [s.id, 50])),
      master: 80,
      setActive: (id, on) => set((st) => ({ active: { ...st.active, [id]: on } })),
      setVolume: (id, v) => set((st) => ({ volumes: { ...st.volumes, [id]: v } })),
      setMaster: (v) => set({ master: v }),
      clearActive: () => set({ active: {} }),
    }),
    {
      name: "planly-mixer-v1",
      // Audio can't resume by itself after a reload, so only volumes are remembered.
      partialize: (st) => ({ volumes: st.volumes, master: st.master }) as any,
    }
  )
);

export default function Sounds() {
  const { active, volumes, master, setActive, setVolume, setMaster, clearActive } = useMixer();
  const presets = usePlanly((s) => s.soundPresets);
  const { saveSoundPreset, deleteSoundPreset } = usePlanly.getState();
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState("");

  const toggle = async (id: string) => {
    const on = !active[id];
    setActive(id, on);
    try {
      await setMasterVolume(master);
      await setSound(id, on, volumes[id] ?? 50);
      setError("");
    } catch (e: any) {
      setActive(id, false);
      setError("Your browser blocked audio. Click again to allow it.");
    }
  };

  const applyPreset = async (vols: Record<string, number>) => {
    for (const s of SOUNDS) {
      const on = s.id in vols;
      if (on) setVolume(s.id, vols[s.id]);
      setActive(s.id, on);
      await setSound(s.id, on, vols[s.id] ?? volumes[s.id] ?? 50);
    }
    await setMasterVolume(master);
  };

  const anyActive = Object.values(active).some(Boolean);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle
          icon={<Headphones className="h-4 w-4" />}
          right={
            anyActive && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  stopAllSounds();
                  clearActive();
                }}
              >
                <Square className="h-3.5 w-3.5" /> Stop all
              </Button>
            )
          }
        >
          Ambient sounds
        </CardTitle>
        <p className="mb-4 text-xs text-[var(--pl-muted)]">Every sound is generated live in your browser — mix as many as you like.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOUNDS.map((s) => {
            const on = !!active[s.id];
            return (
              <div
                key={s.id}
                className={cx(
                  "rounded-2xl border p-3 transition-colors",
                  on ? "border-[var(--pl-accent)] bg-[var(--pl-accent-soft)]" : "border-[var(--pl-border)] bg-[var(--pl-card2)]"
                )}
              >
                <button onClick={() => toggle(s.id)} className="flex w-full cursor-pointer items-center gap-3 text-left" aria-pressed={on}>
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-[var(--pl-text)]">{s.name}</span>
                    <span className="block text-[11px] text-[var(--pl-muted)]">{s.description}</span>
                  </span>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      on ? "bg-[var(--pl-accent)] text-[var(--pl-on-accent)]" : "bg-[var(--pl-border)] text-[var(--pl-muted)]"
                    )}
                  >
                    {on ? "On" : "Off"}
                  </span>
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumes[s.id] ?? 50}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(s.id, v);
                    setSoundVolume(s.id, v);
                  }}
                  className="mt-3 w-full accent-[var(--pl-accent)]"
                  aria-label={`${s.name} volume`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--pl-muted)]">Master</span>
          <input
            type="range"
            min={0}
            max={100}
            value={master}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaster(v);
              if (anyActive) setMasterVolume(v);
            }}
            className="flex-1 accent-[var(--pl-accent)]"
            aria-label="Master volume"
          />
          <span className="w-8 text-right text-xs text-[var(--pl-muted)]">{master}</span>
        </div>
        {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
      </Card>

      <Card>
        <CardTitle icon={<Save className="h-4 w-4" />}>Presets</CardTitle>
        <div className="space-y-2">
          {BUILT_IN_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.volumes)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--pl-border)] bg-[var(--pl-card2)] px-3 py-2 text-left text-sm text-[var(--pl-text)] hover:border-[var(--pl-accent)]"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs">{Object.keys(p.volumes).map((id) => SOUNDS.find((s) => s.id === id)?.emoji).join(" ")}</span>
            </button>
          ))}
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => applyPreset(p.volumes)}
                className="flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-[var(--pl-accent-line)] bg-[var(--pl-accent-soft)] px-3 py-2 text-left text-sm text-[var(--pl-text)]"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs">{Object.keys(p.volumes).map((id) => SOUNDS.find((s) => s.id === id)?.emoji).join(" ")}</span>
              </button>
              <Button size="sm" variant="ghost" onClick={() => deleteSoundPreset(p.id)} aria-label={`Delete ${p.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--pl-border)] pt-3">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--pl-muted)]">Save current mix</label>
          <div className="flex gap-2">
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" />
            <Button
              variant="primary"
              disabled={!anyActive}
              onClick={() => {
                const vols = Object.fromEntries(SOUNDS.filter((s) => active[s.id]).map((s) => [s.id, volumes[s.id] ?? 50]));
                saveSoundPreset(presetName || "My mix", vols);
                setPresetName("");
              }}
            >
              Save
            </Button>
          </div>
          {!anyActive && <p className="mt-1 text-[11px] text-[var(--pl-muted)]">Turn on at least one sound first.</p>}
        </div>
      </Card>
    </div>
  );
}
