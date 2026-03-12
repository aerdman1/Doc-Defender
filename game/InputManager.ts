export class InputManager {
  private held = new Set<string>();
  private justPressed = new Set<string>();

  constructor() {
    this.onDown = this.onDown.bind(this);
    this.onUp = this.onUp.bind(this);
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  private onDown(e: KeyboardEvent) {
    if (!this.held.has(e.key)) this.justPressed.add(e.key);
    this.held.add(e.key);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  private onUp(e: KeyboardEvent) {
    this.held.delete(e.key);
  }

  isDown(key: string): boolean {
    return this.held.has(key);
  }

  wasPressed(key: string): boolean {
    return this.justPressed.has(key);
  }

  // Call at the end of each frame
  flush() {
    this.justPressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }
}
