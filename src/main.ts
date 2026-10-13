import './core/colorSetup';
import './ui/style.css';
import { unlockAudio } from './audio/sound';
import { preloadClips } from './audio/narrate';
import { CONTENT, soundClip } from './content/content';
import { installHooks } from './debug/hooks';
import { BIG_ONES, OPEN_AREAS, closerOf, isFinished, lessonsOf } from './game/areas';
import { Game } from './game/game';
import { newChild, type Child } from './game/children';
import { lastChild, openDevice, rememberChild } from './game/store';
import { AREAS, findNode, rescueIndex, type AreaDef } from './learn/curriculum';
import { blend, graphemeOf, shapeOf } from './learn/skills';
import { rescue, type Rescue } from './cast/species';
import { createAreaMap, type MapNode } from './scenes/areaMap';
import { createExerciseScene } from './scenes/exerciseScene';
import { createHomeIsland } from './scenes/homeIsland';
import { createLandfall } from './scenes/landfall';
import { PLACES } from './scenes/places';
import { createVoyage, type Port } from './scenes/voyage';
import { createWho } from './scenes/who';
import type { Diorama } from './scenes/diorama';
import { Stage } from './stage/stage';
import { Bar } from './ui/bar';
import { Grownups } from './ui/grownups';

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  const ui = document.getElementById('ui')!;
  const veil = document.createElement('div');
  veil.id = 'veil';
  document.body.appendChild(veil);

  if (!document.createElement('canvas').getContext('webgl2')) {
    const no = document.createElement('div');
    no.id = 'nogl';
    no.textContent = '🙁';
    document.body.appendChild(no);
    return;
  }

  const params = new URLSearchParams(location.search);
  const device = await openDevice();
  let kids = await device.children();
  // Nobody yet: the game starts with one child and asks nothing. More are added in the grown-ups' corner.
  if (kids.length === 0) {
    const first = newChild([]);
    await device.saveChild(first);
    kids = [first];
  }
  const last = kids.find((c) => c.id === lastChild()) ?? kids[0];
  let [game] = await Promise.all([Game.load(device.events(last.id)), document.fonts.load('64px Andika').catch(() => undefined)]);
  if (params.has('reset')) await game.reset();

  const stage = new Stage(canvas, document.getElementById('letters')!, veil);
  const q = params.get('q');
  if (q === 'low' || q === 'high') stage.setQuality(q);
  ui.addEventListener('pointerdown', unlockAudio);

  const bar = new Bar(ui, (b) => void (b === 'home' ? goHome() : b === 'who' ? who() : goMap(null)));
  /** The child the game is with. Nobody yet when there are several to choose from. */
  let playing: string | null = kids.length > 1 ? null : last.id;
  const grownups = new Grownups(ui, device, () => void who(true));

  /** `?area=i1a2` goes to that area whatever the progress: for looking at one without playing up to it. */
  const pinned = OPEN_AREAS.find((a) => a.id === params.get('area')) ?? null;
  const frontier = (): AreaDef => pinned ?? game.area;
  /** Where the ship lies, and the island it is at or was last at. Getting to the other place means sailing there. */
  let port: Port = 'home';
  let here = frontier();
  let sailing = false;

  const crewOf = (area: AreaDef): Rescue[] => lessonsOf(area).map((n) => rescue(rescueIndex(n.id)));
  /** The little ones waiting on deck: everyone woken so far on an island that is not finished with. */
  const onDeck = (area: AreaDef): Rescue[] =>
    isFinished(area, game.done) ? [] : lessonsOf(area).filter((n) => game.done.has(n.id)).map((n) => rescue(rescueIndex(n.id)));
  /** What the chart shows on a crossing to or from `area`: every island there is, those up to this one found, and ticked if finished. */
  const charted = (area: AreaDef, done = game.done) => {
    const isle = AREAS.indexOf(area);
    // `?isles=43` draws the chart as it will be with that many islands, the extra ones blank.
    const count = Math.max(AREAS.length, Number(params.get('isles')) || 0);
    return {
      isle,
      isles: Array.from({ length: count }, (_, i) => ({
        seed: PLACES[AREAS[i]?.id]?.shape.seed ?? 1.3 + i * 1.7,
        found: i <= isle ? { place: PLACES[AREAS[i].id], finished: isFinished(AREAS[i], done) } : null,
      })),
    };
  };
  const allDone = (area: AreaDef) => new Set([...game.done, ...OPEN_AREAS.slice(0, OPEN_AREAS.indexOf(area) + 1).flatMap((a) => a.nodes.map((n) => n.id))]);

  /** The bar of any scene in the game itself, where the grown-ups' button has no place. */
  const showBar: Bar['show'] = (...args) => {
    grownups.show(false);
    bar.show(...args);
  };

  /** Where a child starts: the first time straight onto the path, after that at home. */
  const begin = (instant = false) => (game.done.size === 0 ? goMap(null, instant) : goHome(instant));

  /** Who is playing? Everyone on this device stands in a row, and the one who is tapped plays. */
  async function who(instant = false): Promise<void> {
    if (sailing) return;
    // `?demo` shows a full row, to see how it looks; they are nobody, and picking one changes nothing.
    const demo = params.has('demo');
    const row: Child[] = demo
      ? ['Ada', 'Ben', '', 'Mirabelle', 'Jo', 'Sam'].map((name, i) => ({ ...newChild([]), look: [0, 4, 7, 1, 8, 3][i], name }))
      : await device.children();
    // Home is there to go back to only if whoever was playing still is: otherwise someone has to be picked.
    bar.show(demo || row.some((c) => c.id === playing) ? ['home'] : []);
    grownups.show(!demo);
    await stage.show(createWho({ children: row, pick: (child) => void (demo ? begin() : playAs(child)) }), instant);
  }

  async function playAs(child: Child): Promise<void> {
    game = await Game.load(device.events(child.id));
    rememberChild(child.id);
    playing = child.id;
    // Wherever the last child left the ship, this one finds it where they are.
    here = frontier();
    port = game.done.size === 0 ? 'area' : 'home';
    await begin();
  }

  /** Show a scene and wait until it says it is over. */
  const beat = (make: (done: () => void) => Diorama) => new Promise<void>((over) => void stage.show(make(over)));

  /**
   * The crossing between home and `area`: cast off, and the chart unrolls over the ship and shows the trip.
   * `big` rides the raft. `ashore` means the crew are home to stay, and only then do we watch them land.
   */
  async function sail(to: Port, area: AreaDef, crew: Rescue[], big: Rescue | null, ashore = false): Promise<void> {
    const from: Port = to === 'home' ? 'area' : 'home';
    showBar([]);
    await beat((done) => createVoyage({ isle: from, place: PLACES[area.id], crew, big, chart: { to, ...charted(area) }, done }));
    if (ashore) await beat((done) => createLandfall({ crew, ashore, big, done }));
  }

  /** `withAll` is the trip home at the end of an island: everyone aboard, the big one in tow. */
  async function goHome(instant = false, withAll = false): Promise<void> {
    if (sailing) return;
    if (!instant && port === 'area') {
      sailing = true;
      await sail('home', here, withAll ? crewOf(here) : onDeck(here), withAll ? BIG_ONES[here.id].who : null, withAll);
      sailing = false;
    }
    port = 'home';
    const home = game.home;
    // `?demo` fills the island with a sample crowd, to see where it is heading.
    const demo = params.has('demo');
    const residents = demo ? Array.from({ length: 24 }, (_, i) => i) : home.residents;
    showBar(['play', 'who'], OPEN_AREAS.some((a) => !isFinished(a, game.done)) ? 'play' : null);
    await stage.show(
      createHomeIsland({
        residents,
        welcomed: demo ? residents.length : home.welcomed,
        onWelcomed: (n) => game.welcome(n),
        aboard: onDeck(frontier()),
        big: OPEN_AREAS.filter((a) => demo || isFinished(a, game.done)).map((a) => BIG_ONES[a.id].who),
      }),
      instant,
    );
  }

  async function goMap(fresh: string | null, instant = false, done = game.done, friends = false): Promise<void> {
    if (sailing) return;
    // From home the ship always makes for the newest island; once at one, it stays until it has been home.
    if (port === 'home') here = frontier();
    const area = here;
    if (!instant && port === 'home') {
      sailing = true;
      await sail('area', area, onDeck(area), null);
      sailing = false;
    }
    port = 'area';
    preloadClips(area.nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter((g): g is string => !!g).map(soundClip));
    const nodes = area.nodes;
    const currentId = nodes.find((n) => !done.has(n.id))?.id ?? null;
    const mapNodes: MapNode[] = nodes.map((n) => {
      const letter = n.teaches.map(graphemeOf).find((g) => g);
      // A lesson about an s on the end shows the s: a whole word with one is too long for a stone's tile.
      const ending = n.teaches.some((s) => s.startsWith('suffix:') || s.startsWith('second:')) ? 's' : null;
      return {
        id: n.id,
        state: done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked',
        // The word-building lesson shows the word it opens on: the first in the list of a shape it teaches.
        label: n.kind !== 'lesson' ? '' : letter ?? ending ?? CONTENT.words.find((w) => n.teaches.includes(blend(shapeOf(w.graphemes))))?.text ?? '',
        rescue: n.kind === 'lesson' ? rescue(rescueIndex(n.id)) : null,
        boss: n.kind !== 'lesson',
      };
    });
    showBar(['home']);
    await stage.show(
      createAreaMap({
        nodes: mapNodes,
        place: PLACES[area.id],
        big: BIG_ONES[area.id],
        fresh,
        campEmpty: isFinished(area, done) && !friends,
        sailed: friends ? () => void goHome(false, true) : undefined,
        onNode: (id) => void play(id, game.planNode(id)),
      }),
      instant,
    );
  }

  async function play(nodeId: string, plan: ReturnType<Game['planNode']>, instant = false): Promise<void> {
    if (!plan || plan.rounds.length === 0) return;
    here = findNode(nodeId)?.area ?? here;
    const closer = closerOf(here).id;
    port = 'area';
    showBar(['back']);
    await stage.show(
      createExerciseScene({
        ...plan,
        onAttempt: (a) => game.record(nodeId, a),
        onFinished: () => {
          const first = !game.done.has(nodeId);
          game.completeNode(nodeId);
          // Winning the sleeper over gets the plank back: watch everyone board, then go home with them.
          void (nodeId === closer && first ? goMap(null, false, game.done, true) : goMap(first ? nodeId : null));
        },
      }),
      instant,
    );
  }

  const hooks = installHooks(stage, async (name) => {
    // The scenes below show the newest island (or the `?area=` one) at a moment in its story, whatever the real progress.
    const area = frontier();
    const [place, big] = [PLACES[area.id], BIG_ONES[area.id].who];
    if (name === 'who') await who(true);
    else if (name === 'home') await goHome(true);
    else if (name === 'map') await goMap(null, true);
    else if (name === 'sleeper') {
      // The moment the last little one is woken: the big one is about to block the way.
      const lessons = lessonsOf(area).map((n) => n.id);
      await goMap(lessons[lessons.length - 1], true, new Set(lessons));
    } else if (name === 'friends') {
      // The moment after the big one's level: the plank goes back and everyone boards.
      await goMap(null, true, allDone(area), true);
    } else if (name === 'leave') {
      // One end of the trip home with everyone aboard, held for a look.
      await stage.show(createVoyage({ isle: 'area', place, crew: crewOf(area), big, chart: null, done: () => {} }), true);
    } else if (name === 'arrive') await stage.show(createLandfall({ crew: crewOf(area), ashore: true, big, done: () => {} }), true);
    else if (name === 'chart') {
      // The same, with the chart unrolled over it and left open.
      await stage.show(createVoyage({ isle: 'area', place, crew: crewOf(area), big, chart: { to: 'home', ...charted(area, allDone(area)) }, done: () => {} }), true);
    }
    else if (name === 'sail') {
      // The whole crossing home, then home.
      port = 'area';
      here = area;
      await goHome(false, true);
    } else await play(name, game.planNode(name), true);
  }, () => game);

  const start = params.get('scene');
  if (start) await hooks.goto(start);
  else if (kids.length > 1) await who(true);
  else await begin(true);
  hooks.ready = true;
}

void boot();
