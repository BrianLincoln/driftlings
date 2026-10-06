/** A wordless progress row: one dot per item, filled as they are done. */
export class Pips {
  private el = document.createElement('div');
  private dots: HTMLElement[] = [];

  constructor(total: number) {
    this.el.className = 'pips';
    for (let i = 0; i < total; i++) {
      const d = document.createElement('i');
      this.el.appendChild(d);
      this.dots.push(d);
    }
  }

  mount(): void {
    document.getElementById('ui')!.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }

  set(done: number): void {
    this.dots.forEach((d, i) => d.classList.toggle('on', i < done));
  }
}
