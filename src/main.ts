import './core/colorSetup';
import './ui/style.css';
import { Stage } from './stage/stage';
import { installHooks } from './debug/hooks';
import type { Diorama } from './scenes/diorama';
import { createHomePatch } from './scenes/homePatch';
import { createBlendStage } from './scenes/blendStage';

// Style-test shell: two scenes and a two-button switch. No game yet.

const ICONS: Record<string, string> = {
  home: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 14 14 5l10 9"/><path d="M7 12.5V23h14V12.5" fill="#f0c26a"/></svg>',
  blend: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><rect x="5" y="4" width="18" height="20" rx="4" fill="#fffdf8"/><circle cx="13" cy="15" r="3.6"/><path d="M17.4 11v8"/></svg>',
};

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

  await document.fonts.load('64px Andika').catch(() => undefined);

  const stage = new Stage(canvas, document.getElementById('letters')!, veil);
  const builders: Record<string, () => Diorama> = { home: createHomePatch, blend: createBlendStage };
  const built = new Map<string, Diorama>();
  const bar = document.createElement('div');
  bar.className = 'bar';
  ui.appendChild(bar);
  const buttons = new Map<string, HTMLButtonElement>();

  const goto = async (name: string, instant = false) => {
    if (!builders[name]) return;
    let d = built.get(name);
    if (!d) built.set(name, (d = builders[name]()));
    await stage.show(d, instant);
    buttons.forEach((b, n) => b.classList.toggle('on', n === name));
  };

  for (const name of Object.keys(builders)) {
    const b = document.createElement('button');
    b.className = 'round';
    b.innerHTML = ICONS[name];
    b.addEventListener('click', () => void goto(name));
    bar.appendChild(b);
    buttons.set(name, b);
  }

  const hooks = installHooks(stage, goto);
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (q === 'low' || q === 'high') stage.setQuality(q);
  await goto(params.get('scene') ?? 'blend', true);
  hooks.ready = true;
}

void boot();
