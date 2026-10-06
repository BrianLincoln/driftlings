// The top-left buttons. Icons only: players cannot read.

const ICONS = {
  home: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 14 14 5l10 9"/><path d="M7 12.5V23h14V12.5" fill="#f0c26a"/></svg>',
  map: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M5 20c4-7 14-5 18-12" stroke-dasharray="1 5"/><circle cx="5.500" cy="20.500" r="2.800" fill="#f0c26a"/><path d="M22 4v8M22 4l-5 2 5 2" fill="#ef9c93"/></svg>',
  back: '<svg viewBox="0 0 28 28" fill="none" stroke="#4a2e36" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M16 6l-8 8 8 8"/></svg>',
};

export type BarButton = keyof typeof ICONS;

export class Bar {
  private el = document.createElement('div');

  constructor(root: HTMLElement, private onPress: (b: BarButton) => void) {
    this.el.className = 'bar';
    root.appendChild(this.el);
  }

  /** Show these buttons; `current` is highlighted and `calling` pulses to invite a tap. */
  show(buttons: BarButton[], current: BarButton | null, calling: BarButton | null = null): void {
    this.el.replaceChildren(
      ...buttons.map((name) => {
        const b = document.createElement('button');
        b.className = 'round';
        b.dataset.name = name;
        b.innerHTML = ICONS[name];
        b.classList.toggle('on', name === current);
        b.classList.toggle('calling', name === calling);
        b.addEventListener('click', () => this.onPress(name));
        return b;
      }),
    );
  }
}
