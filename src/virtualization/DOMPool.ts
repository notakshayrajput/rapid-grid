export class DOMPool {
  private active = new Map<string, HTMLElement>();
  private free: HTMLElement[] = [];
  constructor(private container: HTMLElement, private className: string,
    private onRelease?: (key: string, element: HTMLElement) => void) {}
  reconcile(keys: Set<string>, bind: (key: string, element: HTMLElement) => void): void {
    this.active.forEach((element, key) => {
      if (!keys.has(key)) {
        if (this.onRelease) this.onRelease(key, element);
        this.active.delete(key);
        element.style.display = 'none';
        this.free.push(element);
      }
    });
    keys.forEach(key => {
      if (this.active.has(key)) return;
      const element = this.free.pop() || this.create();
      element.style.display = '';
      this.active.set(key, element);
      bind(key, element);
    });
  }
  get(key: string): HTMLElement | null { return this.active.get(key) || null; }
  forEachActive(callback: (key: string, element: HTMLElement) => void): void { this.active.forEach((element, key) => callback(key, element)); }
  clear(): void {
    if (this.onRelease) this.active.forEach((element, key) => this.onRelease!(key, element));
    this.active.clear(); this.free.length = 0; this.container.textContent = '';
  }
  private create(): HTMLElement {
    const element = document.createElement('div');
    element.className = this.className;
    this.container.appendChild(element);
    return element;
  }
}
