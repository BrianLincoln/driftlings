import type { LogEvent } from '../learn/events';

// The event log on this device: append-only, in IndexedDB. If the browser
// refuses storage (some private modes), the game still runs from memory.
// A later sync is an upload of events the server has not seen, keyed by id.

export interface EventStore {
  all(): Promise<LogEvent[]>;
  add(e: LogEvent): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'driftlings';
const TABLE = 'events';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLE, { keyPath: 'id' });
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

export async function openStore(): Promise<EventStore> {
  try {
    const db = await open();
    const table = (mode: IDBTransactionMode) => db.transaction(TABLE, mode).objectStore(TABLE);
    return {
      all: async () => (await done(table('readonly').getAll())) as LogEvent[],
      add: async (e) => void (await done(table('readwrite').put(e))),
      clear: async () => void (await done(table('readwrite').clear())),
    };
  } catch {
    const mem: LogEvent[] = [];
    return {
      all: async () => [...mem],
      add: async (e) => void mem.push(e),
      clear: async () => void (mem.length = 0),
    };
  }
}
