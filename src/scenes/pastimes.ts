import { ringAt } from './homeRing';
import { catchGame, parade, round, seesaw } from './pastimeGames';
import { lookout, nap, shore, story } from './pastimeRests';
import type { Ground, Pastime } from './pastime';

// What there is to do on the home island, and where. To add a place, add a line;
// to add a kind of thing to do, write it to the contract in pastime.ts and name it here.

const KINDS = { catch: catchGame, seesaw, round, parade, nap, shore, story, lookout };

/** A spot on the beach, this far round from the ship. */
const beach = (round: number) => ringAt(round, 1.5);

/** [what, x, z], all over the island. Nearest the landing first: that is where the first to come home are found. */
const PLACES: Array<[keyof typeof KINDS, number, number]> = [
  ['seesaw', 4.2, -5.6],
  ['story', 6.0, -13.6],
  ['catch', -4.6, -12.2],
  ['round', -3.4, -4.2],
  ['lookout', 10.4, -7.0],
  ['nap', -10.0, -9.2],
  ['shore', ...beach(-0.5)],
  ['parade', -10.5, 1.2],
  ['catch', 6.4, 3.2],
  ['nap', 0.4, 7.0],
  ['shore', ...beach(1.45)],
  ['seesaw', -5.4, 10.0],
  ['story', 11.0, 9.4],
  ['round', 3.6, 13.6],
  ['shore', ...beach(-1.7)],
  ['lookout', -13.6, 8.4],
  ['shore', ...beach(2.8)],
  ['parade', 8.0, -1.5],
  ['round', -8.0, -15.5],
  ['catch', 14.5, -4.0],
  ['seesaw', -15.5, -9.0],
  ['story', -3.0, 17.0],
  ['lookout', 12.5, 3.5],
];

export function buildPastimes(y: Ground): Pastime[] {
  return PLACES.map(([kind, x, z], n) => KINDS[kind]({ x, z, n, y }));
}
