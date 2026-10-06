// WebAudio: narration clips are decoded once into buffers; small effects are
// synthesised. The context is created on the first touch, as browsers require.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const raw = new Map<string, ArrayBuffer>();
const pending = new Map<string, Promise<void>>();

// Decoding needs the context, and the context may only start after a gesture.
async function decodeAll(): Promise<void> {
  if (!ctx) return;
  for (const [url, data] of [...raw]) {
    raw.delete(url);
    try {
      buffers.set(url, await ctx.decodeAudioData(data));
    } catch {
      /* a clip that will not decode is simply silent */
    }
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(comp).connect(ctx.destination);
  return ctx;
}

export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
  void decodeAll();
}

export function preload(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map((url) => {
      let p = pending.get(url);
      if (!p) {
        p = fetch(url)
          .then((r) => r.arrayBuffer())
          .then((data) => {
            raw.set(url, data);
            if (ctx) void decodeAll();
          })
          .catch(() => undefined);
        pending.set(url, p);
      }
      return p;
    }),
  );
}

/** Plays a clip and returns its duration in seconds (0 if it could not play). */
export function playClip(url: string, delay = 0): number {
  const c = ensure();
  const buf = buffers.get(url);
  if (!c || !out || !buf) return 0;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(out);
  src.start(c.currentTime + delay);
  return buf.duration;
}

/** A short sine glide: the building block for pops and the companion's chirps. */
export function chirp(from: number, to: number, dur = 0.12, gain = 0.16, delay = 0): void {
  const c = ensure();
  if (!c || !out) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  pop: () => chirp(520, 880, 0.09, 0.14),
  coo: () => {
    chirp(660, 990, 0.14, 0.12);
    chirp(990, 1320, 0.16, 0.1, 0.13);
  },
  cheer: () => [0, 0.11, 0.22, 0.36].forEach((d, i) => chirp(620 + i * 160, 820 + i * 200, 0.14, 0.11, d)),
  hop: () => chirp(300, 440, 0.08, 0.07),
  /** A soft "not that one": low and short, never harsh. */
  oops: () => chirp(330, 240, 0.16, 0.09),
  whoosh: () => chirp(260, 720, 0.22, 0.07),
  sparkle: () => [0, 0.07, 0.14].forEach((d, i) => chirp(1200 + i * 300, 1500 + i * 300, 0.09, 0.06, d)),
};
