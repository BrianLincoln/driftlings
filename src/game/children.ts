// The children who play on this device. A child is an id, a look and, if a grown-up
// typed one, a name. The id is made here and is unique everywhere, so the day a
// grown-up signs in, their account takes these children as they are.

export interface Child {
  id: string;
  /** Which creature stands for this child where they choose who is playing: a rescue number. */
  look: number;
  /** For grown-ups. Players cannot read, so nothing depends on it. */
  name: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Set once the child has been removed. The record stays, so a later sync can tell other devices. */
  removedAt?: number;
}

/** As many as stand side by side where they are chosen. */
export const MAX_CHILDREN = 6;

/** Looks handed out in this order: each a different species and a different coat. */
const LOOKS = [0, 4, 7, 1, 8, 3, 6, 2, 5, 9, 10, 11];

/** A random id, version 4. `crypto.randomUUID` is missing on plain http (a tablet on the dev server), so it is built by hand. */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The first look after `after` that none of `others` has. */
export function freeLook(others: readonly Child[], after = -1): number {
  const taken = new Set(others.map((c) => c.look));
  const from = LOOKS.indexOf(after) + 1;
  for (let i = 0; i < LOOKS.length; i++) {
    const look = LOOKS[(from + i) % LOOKS.length];
    if (!taken.has(look)) return look;
  }
  return LOOKS[from % LOOKS.length];
}

export function newChild(others: readonly Child[], name = ''): Child {
  return { id: uuid(), look: freeLook(others), name, createdAt: Date.now() };
}
