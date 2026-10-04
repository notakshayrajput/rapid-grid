export class PrefixSum {
  private sizes: number[];
  private offsets: number[];
  private dirty = 0;

  constructor(count: number, size: number) {
    this.sizes = Array(count).fill(this.validSize(size));
    this.offsets = new Array(count + 1).fill(0);
  }

  get count(): number { return this.sizes.length; }
  get total(): number { this.rebuild(); return this.offsets[this.sizes.length]; }
  get(index: number): number { return this.sizes[index]; }
  set(index: number, size: number): void {
    if (index < 0 || index >= this.count) throw new RangeError('Index outside size collection');
    const next = this.validSize(size);
    if (this.sizes[index] !== next) { this.sizes[index] = next; this.dirty = Math.min(this.dirty, index); }
  }
  resize(count: number, defaultSize: number): void {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Invalid count');
    const old = this.count;
    this.sizes.length = count;
    for (let i = old; i < count; i++) this.sizes[i] = this.validSize(defaultSize);
    this.offsets.length = count + 1;
    this.dirty = Math.min(this.dirty, Math.min(old, count));
  }
  move(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= this.count || to >= this.count) throw new RangeError('Invalid move');
    const value = this.sizes.splice(from, 1)[0];
    this.sizes.splice(to, 0, value);
    this.dirty = Math.min(this.dirty, from, to);
  }
  offset(index: number): number {
    if (index < 0 || index > this.count) throw new RangeError('Index outside size collection');
    this.rebuild();
    return this.offsets[index];
  }
  range(start: number, end: number): number { return this.offset(end) - this.offset(start); }
  indexAt(pixel: number): number {
    if (!this.count) return -1;
    this.rebuild();
    if (pixel <= 0) return 0;
    if (pixel >= this.total) return this.count - 1;
    let low = 0, high = this.count;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.offsets[mid + 1] <= pixel) low = mid + 1; else high = mid;
    }
    return low;
  }
  private validSize(size: number): number {
    if (!Number.isFinite(size) || size <= 0) throw new RangeError('Size must be positive and finite');
    return size;
  }
  private rebuild(): void {
    if (this.dirty >= this.count) return;
    for (let i = this.dirty; i < this.count; i++) this.offsets[i + 1] = this.offsets[i] + this.sizes[i];
    this.dirty = this.count;
  }
}
