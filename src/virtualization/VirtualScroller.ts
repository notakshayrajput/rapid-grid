import { PrefixSum } from './PrefixSum.js';

export interface VirtualWindow { rowStart: number; rowEnd: number; colStart: number; colEnd: number; fast: boolean }
export class VirtualScroller {
  private frame = 0;
  private lastTime = 0;
  private lastX = 0;
  private lastY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private onScroll = () => this.schedule();
  constructor(
    private viewport: HTMLElement, private rows: PrefixSum, private cols: PrefixSum,
    private overscanRows: number, private overscanCols: number, private threshold: number,
    private render: (window: VirtualWindow) => void
  ) { viewport.addEventListener('scroll', this.onScroll, { passive: true }); }
  schedule(): void {
    if (!this.frame) this.frame = requestAnimationFrame(time => {
      this.frame = 0;
      this.sample(time);
      this.render(this.window());
      if (this.isFast) this.schedule();
    });
  }
  refresh(): void { if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; } this.render(this.window()); }
  destroy(): void { this.viewport.removeEventListener('scroll', this.onScroll); if (this.frame) cancelAnimationFrame(this.frame); }
  get isFast(): boolean { return Math.max(Math.abs(this.velocityX), Math.abs(this.velocityY)) >= this.threshold; }
  private sample(time: number): void {
    const elapsed = this.lastTime ? Math.max(1, time - this.lastTime) : 16;
    this.velocityX = (this.viewport.scrollLeft - this.lastX) * 1000 / elapsed;
    this.velocityY = (this.viewport.scrollTop - this.lastY) * 1000 / elapsed;
    this.lastX = this.viewport.scrollLeft;
    this.lastY = this.viewport.scrollTop;
    this.lastTime = time;
  }
  private window(): VirtualWindow {
    if (!this.rows.count || !this.cols.count) return { rowStart: 0, rowEnd: -1, colStart: 0, colEnd: -1, fast: this.isFast };
    const x = this.viewport.scrollLeft, y = this.viewport.scrollTop;
    const r0 = this.rows.indexAt(y), r1 = this.rows.indexAt(y + Math.max(0, this.viewport.clientHeight - 1));
    const c0 = this.cols.indexAt(x), c1 = this.cols.indexAt(x + Math.max(0, this.viewport.clientWidth - 1));
    const above = this.velocityY < 0 ? this.overscanRows * 2 : this.overscanRows;
    const below = this.velocityY > 0 ? this.overscanRows * 2 : this.overscanRows;
    const left = this.velocityX < 0 ? this.overscanCols * 2 : this.overscanCols;
    const right = this.velocityX > 0 ? this.overscanCols * 2 : this.overscanCols;
    return { rowStart: Math.max(0, r0 - above), rowEnd: Math.min(this.rows.count - 1, r1 + below), colStart: Math.max(0, c0 - left), colEnd: Math.min(this.cols.count - 1, c1 + right), fast: this.isFast };
  }
}
