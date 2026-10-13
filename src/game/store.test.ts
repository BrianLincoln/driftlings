import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LogEvent } from '../learn/events';
import { MAX_CHILDREN, freeLook, newChild, uuid, type Child } from './children';
import { openDevice } from './store';

const done = (id: string, node: string): LogEvent => ({ type: 'node-done', id, at: 1, node });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

/** A device as the first version of the game left it: one log, no children. */
function versionOne(events: LogEvent[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('driftlings', 1);
    req.onupgradeneeded = () => {
      const table = req.result.createObjectStore('events', { keyPath: 'id' });
      for (const e of events) table.put(e);
    };
    req.onsuccess = () => (req.result.close(), resolve());
    req.onerror = () => reject(req.error);
  });
}

describe('the device store', () => {
  it('starts with nobody', async () => {
    const device = await openDevice();
    expect(await device.children()).toEqual([]);
  });

  it('keeps each child their own log', async () => {
    const device = await openDevice();
    const [a, b] = [newChild([]), newChild([])];
    await device.saveChild(a);
    await device.saveChild(b);
    await device.events(a.id).add(done('1', 'i1a1-a'));
    await device.events(a.id).add(done('2', 'i1a1-m'));
    await device.events(b.id).add(done('3', 'i1a1-a'));
    expect((await device.events(a.id).all()).map((e) => e.id)).toEqual(['1', '2']);
    expect(await device.events(b.id).all()).toEqual([done('3', 'i1a1-a')]);

    await device.events(a.id).clear();
    expect(await device.events(a.id).all()).toEqual([]);
    expect(await device.events(b.id).all()).toHaveLength(1);
  });

  it('reads a log back in the order it was written, whatever the ids', async () => {
    const device = await openDevice();
    const log = device.events(newChild([]).id);
    for (const [id, at] of [['z', 1], ['a', 2], ['m', 3]] as const) await log.add({ ...done(id, 'i1a1-a'), at });
    expect((await log.all()).map((e) => e.id)).toEqual(['z', 'a', 'm']);
  });

  it('lists children in the order they were added, and keeps what is changed', async () => {
    const device = await openDevice();
    const a: Child = { ...newChild([]), createdAt: 2 };
    const b: Child = { ...newChild([a]), createdAt: 1 };
    await device.saveChild(a);
    await device.saveChild(b);
    await device.saveChild({ ...a, name: 'Ada' });
    expect((await device.children()).map((c) => [c.id, c.name])).toEqual([[b.id, ''], [a.id, 'Ada']]);
  });

  it('removes a child and their log, and nobody else', async () => {
    const device = await openDevice();
    const [a, b] = [newChild([]), newChild([])];
    await device.saveChild(a);
    await device.saveChild(b);
    await device.events(a.id).add(done('1', 'i1a1-a'));
    await device.events(b.id).add(done('2', 'i1a1-a'));
    await device.removeChild(a.id);
    expect((await device.children()).map((c) => c.id)).toEqual([b.id]);
    expect(await device.events(a.id).all()).toEqual([]);
    expect(await device.events(b.id).all()).toHaveLength(1);
  });

  it('is still there the next time the game opens', async () => {
    const first = await openDevice();
    const a = newChild([], 'Ada');
    await first.saveChild(a);
    await first.events(a.id).add(done('1', 'i1a1-a'));
    const again = await openDevice();
    expect(await again.children()).toEqual([a]);
    expect(await again.events(a.id).all()).toEqual([done('1', 'i1a1-a')]);
  });

  it('gives the log from before there were children to a first child', async () => {
    const old = [done('1', 'i1a1-a'), done('2', 'i1a1-m')];
    await versionOne(old);
    const device = await openDevice();
    const kids = await device.children();
    expect(kids).toHaveLength(1);
    expect(await device.events(kids[0].id).all()).toEqual(old);
  });

  it('runs from memory when the browser refuses storage', async () => {
    globalThis.indexedDB = { open: () => { throw new Error('no'); } } as unknown as IDBFactory;
    const device = await openDevice();
    const a = newChild([]);
    await device.saveChild(a);
    await device.events(a.id).add(done('1', 'i1a1-a'));
    expect(await device.children()).toEqual([a]);
    expect(await device.events(a.id).all()).toHaveLength(1);
    await device.removeChild(a.id);
    expect(await device.children()).toEqual([]);
    expect(await device.events(a.id).all()).toEqual([]);
  });
});

describe('children', () => {
  it('have ids that are uuids and never the same twice', () => {
    const ids = Array.from({ length: 200 }, uuid);
    expect(new Set(ids).size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('each get a look nobody else here has', () => {
    const kids: Child[] = [];
    for (let i = 0; i < MAX_CHILDREN; i++) kids.push(newChild(kids));
    expect(new Set(kids.map((c) => c.look)).size).toBe(MAX_CHILDREN);
  });

  it('change to the next look that is free', () => {
    const [a, b] = [{ ...newChild([]), look: 0 }, { ...newChild([]), look: 4 }];
    expect(freeLook([b], a.look)).toBe(7);
    expect(freeLook([], 11)).toBe(0);
  });
});
