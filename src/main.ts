import './core/colorSetup';
import './ui/style.css';
import { unlockAudio } from './audio/sound';
import { preloadClips } from './audio/narrate';
import { CONTENT, soundClip } from './content/content';
import { installHooks } from './debug/hooks';
import { Game, SLEEPER } from './game/game';
import { openStore } from './game/store';
import { rescueIndex } from './learn/curriculum';
import { blend, graphemeOf, shapeOf } from './learn/skills';
import { rescue, type Rescue } from './cast/species';
import { createAreaMap, type MapNode } from './scenes/areaMap';
import { createChart } from './scenes/chart';
import { createExerciseScene } from './scenes/exerciseScene';
import { createHomeIsland } from './scenes/homeIsland';
import { createLandfall } from './scenes/landfall';
import { createVoyage, type Port } from './scenes/voyage';
import type { Diorama } from './scenes/diorama';
import { Stage } from './stage/stage';
import { Bar } from './ui/bar';

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
  const [game] = await Promise.all([Game.load(await openStore()), document.fonts.load('64px Andika').catch(() => undefined)]);
  if (params.has('reset')) await game.reset();

  const stage = new Stage(canvas, document.getElementById('letters')!, veil);
  const q = params.get('q');
  if (q === 'low' || q === 'high') stage.setQuality(q);
  ui.addEventListener('pointerdown', unlockAudio);

  const bar = new Bar(ui, (b) => void (b === 'home' ? goHome() : goMap(null)));
  preloadClips(game.area.nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter((g): g is string => !!g).map(soundClip));

  /** Where the ship lies. Getting to the other place means sailing there. */
  let port: Port = 'home';
  let sailing = false;

  /** The little ones waiting on deck: everyone woken so far on an island that is not finished with. */
  const onDeck = (): Rescue[] => {
    const nodes = game.area.nodes;
    if (game.done.has(nodes[nodes.length - 1].id)) return [];
    return nodes.filter((n) => n.kind === 'lesson' && game.done.has(n.id)).map((n) => rescue(rescueIndex(n.id)));
  };
  const everyone = (): Rescue[] => game.area.nodes.filter((n) => n.kind === 'lesson').map((n) => rescue(rescueIndex(n.id)));

  /** Show a scene and wait until it says it is over. */
  const beat = (make: (done: () => void) => Diorama) => new Promise<void>((over) => void stage.show(make(over)));

  /** The crossing: cast off, the chart, and landfall. `big` rides the raft; `ashore` means the crew are home to stay. */
  async function sail(to: Port, crew: Rescue[], big: Rescue | null, ashore = false): Promise<void> {
    const from: Port = to === 'home' ? 'area' : 'home';
    bar.show([], null);
    await beat((done) => createVoyage({ beat: 'leave', isle: from, crew, big, done }));
    await beat((done) => createChart({ to, done }));
    await beat((done) => (to === 'home' ? createLandfall({ crew, ashore, big, done }) : createVoyage({ beat: 'arrive', isle: to, crew, big, done })));
  }

  /** `withAll` is the trip home at the end of an island: everyone aboard, the big one in tow. */
  async function goHome(instant = false, withAll = false): Promise<void> {
    if (sailing) return;
    if (!instant && port === 'area') {
      sailing = true;
      await sail('home', withAll ? everyone() : onDeck(), withAll ? SLEEPER : null, withAll);
      sailing = false;
    }
    port = 'home';
    const home = game.home;
    // `?demo` fills the island with a sample crowd, to see where it is heading.
    const demo = params.has('demo');
    const residents = demo ? Array.from({ length: 24 }, (_, i) => i) : home.residents;
    bar.show(['home', 'map'], 'home', game.area.nodes.some((n) => !game.done.has(n.id)) ? 'map' : null);
    await stage.show(
      createHomeIsland({
        residents,
        welcomed: demo ? residents.length : home.welcomed,
        onWelcomed: (n) => game.welcome(n),
        aboard: onDeck(),
        big: demo || game.done.has(game.area.nodes[game.area.nodes.length - 1].id) ? [SLEEPER] : [],
      }),
      instant,
    );
  }

  async function goMap(fresh: string | null, instant = false, done = game.done, friends = false): Promise<void> {
    if (sailing) return;
    if (!instant && port === 'home') {
      sailing = true;
      await sail('area', onDeck(), null);
      sailing = false;
    }
    port = 'area';
    const nodes = game.area.nodes;
    const currentId = nodes.find((n) => !done.has(n.id))?.id ?? null;
    const closer = nodes[nodes.length - 1];
    const mapNodes: MapNode[] = nodes.map((n) => {
      const letter = n.teaches.map(graphemeOf).find((g) => g);
      return {
        id: n.id,
        state: done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked',
        // The word-building lesson shows the word it opens on: the first in the list of a shape it teaches.
        label: n.kind !== 'lesson' ? '' : letter ?? CONTENT.words.find((w) => n.teaches.includes(blend(shapeOf(w.graphemes))))?.text ?? '',
        rescue: n.kind === 'lesson' ? rescue(rescueIndex(n.id)) : null,
        boss: n.kind !== 'lesson',
      };
    });
    bar.show(['home', 'map'], 'map');
    await stage.show(
      createAreaMap({
        nodes: mapNodes,
        sleeper: SLEEPER,
        fresh,
        campEmpty: done.has(closer.id) && !friends,
        sailed: friends ? () => void goHome(false, true) : undefined,
        onNode: (id) => void play(id, game.planNode(id)),
      }),
      instant,
    );
  }

  async function play(nodeId: string, plan: ReturnType<Game['planNode']>, instant = false): Promise<void> {
    if (!plan || plan.rounds.length === 0) return;
    const closer = game.area.nodes[game.area.nodes.length - 1].id;
    port = 'area';
    bar.show(['back'], null);
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
    if (name === 'home') await goHome(true);
    else if (name === 'map') await goMap(null, true);
    else if (name === 'sleeper') {
      // The moment the last little one is woken, whatever the real progress: the sleeper is about to block the way.
      const lessons = game.area.nodes.slice(0, -1).map((n) => n.id);
      await goMap(lessons[lessons.length - 1], true, new Set(lessons));
    } else if (name === 'friends') {
      // The moment after the sleeper's level: the plank goes back and everyone boards.
      await goMap(null, true, new Set(game.area.nodes.map((n) => n.id)), true);
    } else if (name === 'leave') {
      // One end of the trip home with everyone aboard, held for a look.
      await stage.show(createVoyage({ beat: 'leave', isle: 'area', crew: everyone(), big: SLEEPER, done: () => {} }), true);
    } else if (name === 'arrive') await stage.show(createLandfall({ crew: everyone(), ashore: true, big: SLEEPER, done: () => {} }), true); else if (name === 'chart') await stage.show(createChart({ to: 'home', done: () => {} }), true);
    else if (name === 'sail') {
      // The whole crossing home, then home.
      port = 'area';
      await goHome(false, true);
    }
    else await play(name, game.planNode(name), true);
  }, game);

  const start = params.get('scene');
  if (start) await hooks.goto(start);
  else if (game.done.size === 0) await goMap(null, true); // first visit: straight to the path
  else await goHome(true);
  hooks.ready = true;
}

void boot();
