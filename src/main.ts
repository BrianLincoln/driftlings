import './core/colorSetup';
import './ui/style.css';
import { unlockAudio } from './audio/sound';
import { preloadClips } from './audio/narrate';
import { soundClip } from './content/content';
import { installHooks } from './debug/hooks';
import { Game, SLEEPER, surpriseId } from './game/game';
import { openStore } from './game/store';
import { rescueIndex } from './learn/curriculum';
import { graphemeOf } from './learn/skills';
import { rescue } from './cast/species';
import { createAreaMap, type MapNode } from './scenes/areaMap';
import { createExerciseScene } from './scenes/exerciseScene';
import { createHomeIsland } from './scenes/homeIsland';
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

  async function goHome(instant = false): Promise<void> {
    const home = game.home;
    // `?demo` fills the island with a sample crowd, to see where it is heading.
    const demo = params.has('demo');
    const residents = demo ? Array.from({ length: 24 }, (_, i) => i) : home.residents;
    bar.show(['home', 'map'], 'home', game.area.nodes.some((n) => !game.done.has(n.id)) ? 'map' : null);
    await stage.show(
      createHomeIsland({ residents, welcomed: demo ? residents.length : home.welcomed, onWelcomed: (n) => game.welcome(n) }),
      instant,
    );
  }

  async function goMap(fresh: string | null, instant = false): Promise<void> {
    const done = game.done;
    const nodes = game.area.nodes;
    const currentId = nodes.find((n) => !done.has(n.id))?.id ?? null;
    const closer = nodes[nodes.length - 1];
    const mapNodes: MapNode[] = nodes.map((n) => {
      const letter = n.teaches.map(graphemeOf).find((g) => g);
      return {
        id: n.id,
        state: done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked',
        label: n.kind !== 'lesson' ? '' : letter ?? 'am',
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
        surprise: game.surpriseWaiting,
        campEmpty: done.has(closer.id),
        onNode: (id) => void play(id, game.planNode(id)),
        onSurprise: () => void play(surpriseId(game.area), game.planSurprise()),
      }),
      instant,
    );
  }

  async function play(nodeId: string, plan: ReturnType<Game['planNode']>, instant = false): Promise<void> {
    if (!plan || plan.rounds.length === 0) return;
    const closer = game.area.nodes[game.area.nodes.length - 1].id;
    bar.show(['back'], null);
    await stage.show(
      createExerciseScene({
        ...plan,
        onAttempt: (a) => game.record(nodeId, a),
        onFinished: () => {
          const first = !game.done.has(nodeId);
          game.completeNode(nodeId);
          // Clearing the path sends the area's creatures home; go and watch them arrive.
          void (nodeId === closer && first ? goHome() : goMap(first ? nodeId : null));
        },
      }),
      instant,
    );
  }

  const hooks = installHooks(stage, async (name) => {
    if (name === 'home') await goHome(true);
    else if (name === 'map') await goMap(null, true);
    else await play(name, name.endsWith('-surprise') ? game.planSurprise() : game.planNode(name), true);
  }, game);

  const start = params.get('scene');
  if (start) await hooks.goto(start);
  else if (game.done.size === 0) await goMap(null, true); // first visit: straight to the path
  else await goHome(true);
  hooks.ready = true;
}

void boot();
