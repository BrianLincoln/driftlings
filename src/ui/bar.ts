// The buttons over a scene. Icons only: players cannot read. Each has one place it always is:
// the way back (home, or out of a lesson) top left, who is playing top right, and play, the big
// one, bottom middle. A scene never gets a button for where it already is.

const ICONS = {
  home: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M14 4.500 3.500 14H7v9.500h14V14h3.500z" fill="#ffc93c"/></svg>',
  who: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="9" cy="11" r="4.200" fill="#f0c26a"/><circle cx="19.500" cy="11" r="4.200" fill="#ef9c93"/><path d="M3 23c0-4 2.600-6 6-6s6 2 6 6" fill="#f0c26a"/><path d="M14 23c0-4 2.400-6 5.500-6s5.500 2 5.500 6" fill="#ef9c93"/></svg>',
  play: '<svg viewBox="0 0 28 28" fill="#fbf3e4" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round"><path d="M9.500 5.500v17l13.500-8.500z"/></svg>',
  back: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M16 6l-8 8 8 8"/></svg>',
};

export type BarButton = keyof typeof ICONS;

const PLACE: Record<BarButton, string> = { home: 'left', back: 'left', who: 'right', play: 'play' };

export class Bar {
  private el = document.createElement('div');

  constructor(root: HTMLElement, private onPress: (b: BarButton) => void) {
    this.el.className = 'bar';
    root.appendChild(this.el);
  }

  /** Show these buttons; `calling` pulses to invite a tap. */
  show(buttons: BarButton[], calling: BarButton | null = null): void {
    this.el.replaceChildren(
      ...buttons.map((name) => {
        const b = document.createElement('button');
        b.className = `round ${PLACE[name]}`;
        b.dataset.name = name;
        b.innerHTML = ICONS[name];
        b.classList.toggle('calling', name === calling);
        b.addEventListener('click', () => this.onPress(name));
        return b;
      }),
    );
  }
}
