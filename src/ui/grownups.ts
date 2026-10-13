import { portrait } from '../cast/portrait';
import { rescue } from '../cast/species';
import { MAX_CHILDREN, freeLook, newChild, type Child } from '../game/children';
import type { Device } from '../game/store';

// The grown-ups' corner: who plays on this device. It is the one place in the game
// with words in it, so it sits behind a button that has to be held down: a child
// who taps it gets nothing. Signing in to keep progress across devices belongs here later.

const ICON =
  '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="10" cy="8.500" r="3.800" fill="#f0c26a"/><path d="M3.500 23c0-5 3-8 6.500-8s6.500 3 6.500 8z" fill="#f0c26a"/><circle cx="20.500" cy="13.500" r="2.600" fill="#ef9c93"/><path d="M16.500 23c0-3.400 1.800-5.400 4-5.400s4 2 4 5.400z" fill="#ef9c93"/></svg>';
/** Seconds the button has to be held. */
const HOLD = 1.2;
/** Seconds a full ring takes to run back out when the button is let go. */
const LET_GO = 0.3;

export class Grownups {
  private button = document.createElement('button');
  private panel = document.createElement('div');
  private list = document.createElement('div');
  private add = document.createElement('button');
  /** The child whose removal is waiting to be confirmed. */
  private removing: string | null = null;

  /** `changed` is called whenever the children are no longer what they were. */
  constructor(root: HTMLElement, private device: Device, private changed: () => void) {
    this.button.className = 'round grownups-open';
    this.button.innerHTML = ICON;
    // The ring is driven by hand, a frame at a time, so what it shows is always how long the
    // button has really been held: it fills while held, and runs back out when let go early.
    let held = 0;
    let down = false;
    let running = false;
    let last = 0;
    const ring = () => this.button.style.setProperty('--turn', `${held * 360}deg`);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      held = Math.min(1, Math.max(0, held + (down ? dt / HOLD : -dt / LET_GO)));
      if (held >= 1) {
        held = 0;
        down = false;
        void this.open();
      }
      ring();
      running = down || held > 0;
      if (running) requestAnimationFrame(tick);
    };
    const press = (on: boolean) => {
      down = on;
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    };
    this.button.addEventListener('pointerdown', (e) => {
      press(true);
      // Keep the pointer, so a finger that rolls off the edge is still holding.
      this.button.setPointerCapture(e.pointerId);
    });
    for (const e of ['pointerup', 'pointercancel', 'lostpointercapture']) this.button.addEventListener(e, () => press(false));

    this.panel.className = 'grownups';
    this.panel.hidden = true;
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = 'Who plays here';
    this.add.className = 'wide';
    this.add.textContent = 'Add a child';
    this.add.addEventListener('click', () => void this.change(async (kids) => this.device.saveChild(newChild(kids))));
    const note = document.createElement('p');
    note.textContent = 'Each child has their own creature and their own progress. It is kept on this device only.';
    const close = document.createElement('button');
    close.className = 'wide primary';
    close.textContent = 'Done';
    close.addEventListener('click', () => (this.panel.hidden = true));
    card.append(title, this.list, this.add, note, close);
    this.panel.appendChild(card);
    this.button.hidden = true;
    root.append(this.button, this.panel);
  }

  /** The button is only there where children are chosen. */
  show(on: boolean): void {
    this.button.hidden = !on;
    if (!on) this.panel.hidden = true;
  }

  private async open(): Promise<void> {
    this.removing = null;
    await this.draw();
    this.panel.hidden = false;
  }

  private async change(act: (kids: Child[]) => Promise<void>): Promise<void> {
    await act(await this.device.children());
    this.removing = null;
    await this.draw();
    this.changed();
  }

  private async draw(): Promise<void> {
    const kids = await this.device.children();
    this.add.disabled = kids.length >= MAX_CHILDREN;
    this.list.replaceChildren(...kids.map((child) => (child.id === this.removing ? this.confirmRow(child) : this.row(child, kids))));
  }

  private row(child: Child, kids: Child[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row';
    // The creature's head, to tell which is whose. A tap gives the child the next creature nobody has.
    const look = document.createElement('button');
    look.className = 'look';
    look.title = 'Change creature';
    look.innerHTML = portrait(rescue(child.look));
    look.addEventListener('click', () =>
      void this.change((all) => this.device.saveChild({ ...child, look: freeLook(all.filter((c) => c.id !== child.id), child.look) })));
    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 12;
    name.placeholder = 'Name';
    name.value = child.name;
    name.autocomplete = 'off';
    name.addEventListener('change', () => void this.change(() => this.device.saveChild({ ...child, name: name.value.trim() })));
    const remove = document.createElement('button');
    remove.className = 'quiet';
    remove.textContent = 'Remove';
    // Someone has to be playing: the last child stays.
    remove.disabled = kids.length < 2;
    remove.addEventListener('click', () => {
      this.removing = child.id;
      void this.draw();
    });
    row.append(look, name, remove);
    return row;
  }

  private confirmRow(child: Child): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row confirm';
    const ask = document.createElement('span');
    ask.textContent = `Erase ${child.name || 'this child'} and all their progress?`;
    const yes = document.createElement('button');
    yes.className = 'danger';
    yes.textContent = 'Erase';
    yes.addEventListener('click', () => void this.change(() => this.device.removeChild(child.id)));
    const no = document.createElement('button');
    no.className = 'quiet';
    no.textContent = 'Keep';
    no.addEventListener('click', () => {
      this.removing = null;
      void this.draw();
    });
    row.append(ask, yes, no);
    return row;
  }
}
