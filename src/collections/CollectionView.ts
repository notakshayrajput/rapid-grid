import { DataItem, DataType } from '../types.js';

export class CollectionView {
  private source: DataItem[];
  private listeners: Array<() => void> = [];

  constructor(items: DataItem[] = []) { this.source = items; }
  get items(): readonly DataItem[] { return this.source; }
  get length(): number { return this.source.length; }
  at(index: number): DataItem | undefined { return this.source[index]; }
  setItems(items: DataItem[]): void { this.source = items; this.emit(); }
  setValue(index: number, binding: string, value: unknown): void {
    const item = this.source[index];
    if (!item) throw new RangeError('Row does not exist');
    item[binding] = value;
    this.emit();
  }
  setValues(updates: Array<{ index: number; binding: string; value: unknown }>): void {
    for (const update of updates) if (!this.source[update.index]) throw new RangeError('Row does not exist');
    if (!updates.length) return;
    for (const update of updates) this.source[update.index][update.binding] = update.value;
    this.emit();
  }
  move(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= this.length || to >= this.length) throw new RangeError('Invalid row move');
    if (from === to) return;
    this.source.splice(to, 0, this.source.splice(from, 1)[0]);
    this.emit();
  }
  sort(binding: string, direction: 'asc' | 'desc' = 'asc', type: DataType = DataType.String): void {
    const sign = direction === 'asc' ? 1 : -1;
    this.source.sort((a, b) => {
      const left = a[binding], right = b[binding];
      if (left == null) return right == null ? 0 : -sign;
      if (right == null) return sign;
      if (type === DataType.Number || type === DataType.Boolean) return (Number(left) - Number(right)) * sign;
      if (type === DataType.Date || type === DataType.Time || type === DataType.DateTime) return (new Date(left as string).getTime() - new Date(right as string).getTime()) * sign;
      if (type === DataType.DateRange) {
        const first = left as { start: Date }, second = right as { start: Date };
        return (new Date(first.start).getTime() - new Date(second.start).getTime()) * sign;
      }
      return String(left).localeCompare(String(right)) * sign;
    });
    this.emit();
  }
  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(item => item !== listener); };
  }
  private emit(): void { this.listeners.slice().forEach(listener => listener()); }
}
