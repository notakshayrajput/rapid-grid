import { PrefixSum } from '../virtualization/PrefixSum.js';

export class Row {
  allowMerging = false;
  header: string;
  constructor(readonly index: number, private collection: RowCollection) { this.header = String(index + 1); }
  get height(): number { return this.collection.sizes.get(this.index); }
  set height(value: number) { this.collection.setHeight(this.index, value); }
}

export class RowCollection {
  readonly sizes: PrefixSum;
  private entries: Row[] = [];
  constructor(count: number, readonly defaultHeight: number, private onLayout: () => void) {
    this.sizes = new PrefixSum(count, defaultHeight);
    this.entries = Array.from({ length: count }, (_, index) => new Row(index, this));
  }
  get length(): number { return this.entries.length; }
  get(index: number): Row { const row = this.entries[index]; if (!row) throw new RangeError('Row does not exist'); return row; }
  setHeight(index: number, value: number): void {
    if (this.sizes.get(index) === value) return;
    this.sizes.set(index, value); this.onLayout();
  }
  reset(count: number): void {
    this.sizes.resize(count, this.defaultHeight);
    this.entries = Array.from({ length: count }, (_, index) => new Row(index, this));
    this.onLayout();
  }
  move(from: number, to: number): void {
    const flags = this.entries.map(row => ({ allowMerging: row.allowMerging, header: row.header }));
    const flag = flags.splice(from, 1)[0];
    flags.splice(to, 0, flag);
    this.sizes.move(from, to);
    this.entries = flags.map((value, index) => { const row = new Row(index, this); row.allowMerging = value.allowMerging; row.header = value.header; return row; });
    this.onLayout();
  }
}
