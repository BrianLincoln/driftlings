import type { LogEvent } from '../learn/events';
import { newChild, type Child } from './children';

// What this device keeps, in IndexedDB: the children who play here, and one
// append-only event log, each event marked with the child it belongs to. If the
// browser refuses storage (some private modes), the game still runs from memory.
// A later sync is an upload of events the server has not seen, keyed by id.

/** One child's log. */
export interface EventStore {
  all(): Promise<LogEvent[]>;
  add(e: LogEvent): Promise<void>;
  clear(): Promise<void>;
}

export interface Device {
  /** The children who play here, in the order they were added. */
  children(): Promise<Child[]>;
  /** Add a child, or change one. */
  saveChild(c: Child): Promise<void>;
  /** Take a child off this device, and their log with them. */
  removeChild(id: string): Promise<void>;
  events(child: string): EventStore;
}

const DB = 'driftlings';
const EVENTS = 'events';
const CHILDREN = 'children';
type Row = LogEvent & { child: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const events = e.oldVersion < 1 ? db.createObjectStore(EVENTS, { keyPath: 'id' }) : req.transaction!.objectStore(EVENTS);
      events.createIndex('child', 'child');
      const children = db.createObjectStore(CHILDREN, { keyPath: 'id' });
      if (e.oldVersion !== 1) return;
      // Version 1 had one log and nobody's name on it: whoever was playing becomes the first child here.
      const first = newChild([]);
      children.put(first);
      events.openCursor().onsuccess = (ev) => {
        const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        cursor.update({ ...cursor.value, child: first.id });
        cursor.continue();
      };
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

const live = (all: Child[]): Child[] => all.filter((c) => !c.removedAt).sort((a, b) => a.createdAt - b.createdAt);
const bare = ({ child: _child, ...e }: Row): LogEvent => e as LogEvent;

function onDisk(db: IDBDatabase): Device {
  const table = (name: string, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  /** Delete every event of one child, inside `events`' own transaction. */
  const forget = (events: IDBObjectStore, child: string) => {
    events.index('child').openKeyCursor(child).onsuccess = (ev) => {
      const cursor = (ev.target as IDBRequest<IDBCursor | null>).result;
      if (!cursor) return;
      events.delete(cursor.primaryKey);
      cursor.continue();
    };
  };
  return {
    children: async () => live((await done(table(CHILDREN, 'readonly').getAll())) as Child[]),
    saveChild: async (c) => void (await done(table(CHILDREN, 'readwrite').put(c))),
    async removeChild(id) {
      const tx = db.transaction([CHILDREN, EVENTS], 'readwrite');
      const children = tx.objectStore(CHILDREN);
      children.get(id).onsuccess = (ev) => {
        const c = (ev.target as IDBRequest<Child | undefined>).result;
        if (c) children.put({ ...c, name: '', removedAt: Date.now() });
      };
      forget(tx.objectStore(EVENTS), id);
      await finished(tx);
    },
    events: (child) => ({
      // The index hands them back by id, which says nothing of when: the log is read in the order it was written.
      all: async () => ((await done(table(EVENTS, 'readonly').index('child').getAll(child))) as Row[]).map(bare).sort((a, b) => a.at - b.at),
      add: async (e) => void (await done(table(EVENTS, 'readwrite').put({ ...e, child } satisfies Row))),
      async clear() {
        const tx = db.transaction(EVENTS, 'readwrite');
        forget(tx.objectStore(EVENTS), child);
        await finished(tx);
      },
    }),
  };
}

function inMemory(): Device {
  let kids: Child[] = [];
  const logs = new Map<string, LogEvent[]>();
  const log = (child: string) => logs.get(child) ?? logs.set(child, []).get(child)!;
  return {
    children: async () => live(kids),
    saveChild: async (c) => void (kids = [...kids.filter((k) => k.id !== c.id), c]),
    async removeChild(id) {
      kids = kids.map((k) => (k.id === id ? { ...k, name: '', removedAt: Date.now() } : k));
      logs.delete(id);
    },
    events: (child) => ({
      all: async () => [...log(child)],
      add: async (e) => void log(child).push(e),
      clear: async () => void logs.delete(child),
    }),
  };
}

export async function openDevice(): Promise<Device> {
  try {
    return onDisk(await open());
  } catch {
    return inMemory();
  }
}

const LAST = 'driftlings.child';

/** Who played here last, if the browser will say: only so a reload comes back to the same child. */
export function lastChild(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

export function rememberChild(id: string): void {
  try {
    localStorage.setItem(LAST, id);
  } catch {
    // Not remembered, then.
  }
}
