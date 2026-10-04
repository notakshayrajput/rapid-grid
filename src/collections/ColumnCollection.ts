import { ColumnOptions, DataType } from '../types.js';
import { PrefixSum } from '../virtualization/PrefixSum.js';

export class Column implements ColumnOptions {
  binding: string;
  header: string;
  dataType: DataType;
  format?: string;
  allowMerging: boolean;
  readOnly: boolean;
  editor?: ColumnOptions['editor'];
  constructor(options: ColumnOptions, public index: number, private collection: ColumnCollection) {
    this.binding = options.binding;
    this.header = options.header === undefined ? options.binding : options.header;
    this.dataType = options.dataType || DataType.String;
    this.format = options.format;
    this.allowMerging = !!options.allowMerging;
    this.readOnly = !!options.readOnly;
    this.editor = options.editor;
  }
  get width(): number { return this.collection.sizes.get(this.index); }
  set width(value: number) { this.collection.setWidth(this.index, value); }
}

export class ColumnCollection {
  readonly sizes: PrefixSum;
  private entries: Column[];
  constructor(options: ColumnOptions[], readonly defaultWidth: number, private onLayout: () => void) {
    this.sizes = new PrefixSum(options.length, defaultWidth);
    this.entries = options.map((option, index) => new Column(option, index, this));
    options.forEach((option, index) => { if (option.width !== undefined) this.sizes.set(index, option.width); });
  }
  get length(): number { return this.entries.length; }
  get(indexOrBinding: number | string): Column {
    const col = typeof indexOrBinding === 'number' ? this.entries[indexOrBinding] : this.entries.find(item => item.binding === indexOrBinding);
    if (!col) throw new RangeError('Column does not exist');
    return col;
  }
  toArray(): Column[] { return this.entries.slice(); }
  setWidth(index: number, value: number): void {
    if (this.sizes.get(index) === value) return;
    this.sizes.set(index, value); this.onLayout();
  }
  move(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= this.length || to >= this.length) throw new RangeError('Invalid column move');
    if (from === to) return;
    const column = this.entries.splice(from, 1)[0];
    this.entries.splice(to, 0, column);
    this.entries.forEach((entry, index) => { entry.index = index; });
    this.sizes.move(from, to);
    this.onLayout();
  }
}
