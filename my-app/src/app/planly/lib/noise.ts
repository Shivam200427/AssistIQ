"use client";

/**
 * Ambient sound engine. Every sound is synthesised in the browser with Tone.js — no audio files.
 * Tone is imported lazily so it only loads when the Sounds panel is used.
 */

type ToneModule = typeof import("tone");

export interface SoundDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const SOUNDS: SoundDef[] = [
  { id: "brown", name: "Brown noise", emoji: "🟤", description: "Deep, soft rumble" },
  { id: "pink", name: "Pink noise", emoji: "🌸", description: "Balanced and gentle" },
  { id: "white", name: "White noise", emoji: "⚪", description: "Bright static" },
  { id: "rain", name: "Rain", emoji: "🌧️", description: "Steady rain with droplets" },
  { id: "ocean", name: "Ocean waves", emoji: "🌊", description: "Slow rolling surf" },
  { id: "wind", name: "Wind", emoji: "🍃", description: "Gusts through trees" },
  { id: "fire", name: "Fireplace", emoji: "🔥", description: "Low roar with crackles" },
  { id: "stream", name: "Stream", emoji: "💧", description: "Bubbling brook" },
];

export const BUILT_IN_PRESETS: { name: string; volumes: Record<string, number> }[] = [
  { name: "Deep focus", volumes: { brown: 60 } },
  { name: "Rainy library", volumes: { rain: 65, brown: 25 } },
  { name: "Seaside", volumes: { ocean: 70, wind: 20 } },
  { name: "Cabin night", volumes: { fire: 60, wind: 30, rain: 20 } },
];

interface Voice {
  start: () => void;
  stop: () => void;
  output: any; // Tone.Volume
  disposables: any[];
}

let tone: ToneModule | null = null;
let master: any = null;
const voices = new Map<string, Voice>();
const playing = new Set<string>();
const pendingStops = new Map<string, ReturnType<typeof setTimeout>>();

async function loadTone(): Promise<ToneModule> {
  if (!tone) {
    tone = await import("tone");
    master = new tone.Volume(-6).toDestination();
  }
  return tone;
}

function volumeToDb(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v <= 0 ? -Infinity : 20 * Math.log10(v) - 6;
}

function buildVoice(T: ToneModule, id: string): Voice {
  const out = new T.Volume(-12).connect(master);
  const disposables: any[] = [out];
  const add = <X>(node: X) => {
    disposables.push(node);
    return node;
  };
  const sources: any[] = [];
  const loops: any[] = [];

  if (id === "brown" || id === "pink" || id === "white") {
    const noise = add(new T.Noise(id as "brown" | "pink" | "white"));
    if (id === "white") {
      const lp = add(new T.Filter(9000, "lowpass"));
      noise.connect(lp);
      lp.connect(out);
    } else {
      noise.connect(out);
    }
    sources.push(noise);
  }

  if (id === "rain") {
    const noise = add(new T.Noise("pink"));
    const hp = add(new T.Filter(500, "highpass"));
    const lp = add(new T.Filter(6500, "lowpass"));
    noise.chain(hp, lp, out);
    sources.push(noise);
    // Random droplets
    const drop = add(new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }));
    const dropFilter = add(new T.Filter(3500, "bandpass"));
    const dropVol = add(new T.Volume(-18));
    drop.chain(dropFilter, dropVol, out);
    loops.push(
      add(
        new T.Loop((time: number) => {
          if (Math.random() < 0.55) {
            dropFilter.frequency.setValueAtTime(2000 + Math.random() * 4000, time);
            drop.triggerAttackRelease(0.02, time + Math.random() * 0.05);
          }
        }, 0.06)
      )
    );
  }

  if (id === "ocean") {
    const noise = add(new T.Noise("brown"));
    const lp = add(new T.Filter(600, "lowpass"));
    const swell = add(new T.Gain(0.5));
    noise.chain(lp, swell, out);
    const cutoffLfo = add(new T.LFO(0.09, 250, 1400));
    cutoffLfo.connect(lp.frequency);
    const ampLfo = add(new T.LFO(0.09, 0.15, 1));
    ampLfo.connect(swell.gain);
    sources.push(noise, cutoffLfo, ampLfo);
  }

  if (id === "wind") {
    const noise = add(new T.Noise("pink"));
    const bp = add(new T.Filter({ frequency: 500, type: "bandpass", Q: 0.8 }));
    const gust = add(new T.Gain(0.6));
    noise.chain(bp, gust, out);
    const freqLfo = add(new T.LFO(0.05, 250, 1100));
    freqLfo.connect(bp.frequency);
    const gustLfo = add(new T.LFO(0.13, 0.3, 1));
    gustLfo.connect(gust.gain);
    sources.push(noise, freqLfo, gustLfo);
  }

  if (id === "fire") {
    const noise = add(new T.Noise("brown"));
    const lp = add(new T.Filter(500, "lowpass"));
    const base = add(new T.Volume(-4));
    noise.chain(lp, base, out);
    sources.push(noise);
    const crackle = add(new T.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 } }));
    const crackleFilter = add(new T.Filter(2500, "highpass"));
    const crackleVol = add(new T.Volume(-10));
    crackle.chain(crackleFilter, crackleVol, out);
    loops.push(
      add(
        new T.Loop((time: number) => {
          if (Math.random() < 0.18) crackle.triggerAttackRelease(0.01, time + Math.random() * 0.1);
        }, 0.1)
      )
    );
  }

  if (id === "stream") {
    const noise = add(new T.Noise("white"));
    const bp = add(new T.Filter({ frequency: 1800, type: "bandpass", Q: 1.2 }));
    const lp = add(new T.Filter(5000, "lowpass"));
    const vol = add(new T.Volume(-6));
    noise.chain(bp, lp, vol, out);
    const bubble = add(new T.LFO(7, 1200, 2600));
    bubble.connect(bp.frequency);
    sources.push(noise, bubble);
  }

  return {
    output: out,
    disposables,
    start: () => {
      sources.forEach((s) => s.start());
      loops.forEach((l) => l.start(0));
    },
    stop: () => {
      sources.forEach((s) => s.stop());
      loops.forEach((l) => l.stop());
    },
  };
}

/** Must be called from a user gesture the first time (browser autoplay rules). */
export async function setSound(id: string, active: boolean, volume: number) {
  const T = await loadTone();
  await T.start();
  const transport = T.getTransport();
  if (transport.state !== "started") transport.start();

  let voice = voices.get(id);
  if (active) {
    if (!voice) {
      voice = buildVoice(T, id);
      voices.set(id, voice);
    }
    voice.output.volume.rampTo(volumeToDb(volume), 0.2);
    const pending = pendingStops.get(id);
    if (pending) {
      // Re-enabled while fading out: the sources are still running, so just cancel the stop.
      clearTimeout(pending);
      pendingStops.delete(id);
      playing.add(id);
    } else if (!playing.has(id)) {
      voice.start();
      playing.add(id);
    }
  } else if (voice && playing.has(id)) {
    voice.output.volume.rampTo(-Infinity, 0.3);
    const v = voice;
    pendingStops.set(
      id,
      setTimeout(() => {
        pendingStops.delete(id);
        v.stop();
      }, 350)
    );
    playing.delete(id);
  }
}

export async function setSoundVolume(id: string, volume: number) {
  const voice = voices.get(id);
  if (voice && playing.has(id)) voice.output.volume.rampTo(volumeToDb(volume), 0.1);
}

export async function setMasterVolume(volume: number) {
  await loadTone();
  master.volume.rampTo(volumeToDb(volume), 0.1);
}

export function stopAllSounds() {
  for (const id of [...playing]) {
    const v = voices.get(id);
    v?.output.volume.rampTo(-Infinity, 0.2);
    playing.delete(id);
    pendingStops.set(
      id,
      setTimeout(() => {
        pendingStops.delete(id);
        v?.stop();
      }, 250)
    );
  }
}

export function playingSounds(): string[] {
  return [...playing];
}
