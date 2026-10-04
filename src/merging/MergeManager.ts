import { CollectionView } from '../collections/CollectionView.js';
import { RowCollection } from '../collections/RowCollection.js';
import { ColumnCollection } from '../collections/ColumnCollection.js';
import { AllowMerging } from '../types.js';
import { CellRange } from './CellRange.js';

export class MergeManager {
  private intervals = new Map<number, CellRange[]>();
  constructor(private view: CollectionView, private rows: RowCollection, private cols: ColumnCollection,
    private format: (row: number, col: number) => string, private mode: () => AllowMerging) {}

  getCellRange(row: number, col: number): CellRange {
    if (this.mode() !== AllowMerging.Cells && this.mode() !== AllowMerging.All) return new CellRange(row, col);
    const known = (this.intervals.get(col) || []).find(range => range.contains(row, col));
    if (known) return known;
    const value = this.format(row, col);
    let left = col, right = col, top = row, bottom = row;
    if (this.rows.get(row).allowMerging) {
      while (left > 0 && this.format(row, left - 1) === value) left--;
      while (right + 1 < this.cols.length && this.format(row, right + 1) === value) right++;
    }
    const vertical = this.cols.get(col).allowMerging &&
      (left === right || this.cols.toArray().slice(left, right + 1).every(column => column.allowMerging));
    if (vertical) {
      const same = (candidate: number) => {
        if (left !== right && !this.rows.get(candidate).allowMerging) return false;
        for (let c = left; c <= right; c++) if (this.format(candidate, c) !== value) return false;
        return true;
      };
      while (top > 0 && same(top - 1)) top--;
      while (bottom + 1 < this.rows.length && same(bottom + 1)) bottom++;
    }
    const range = new CellRange(top, left, bottom, right);
    for (let c = left; c <= right; c++) {
      const list = this.intervals.get(c) || [];
      list.push(range);
      this.intervals.set(c, list);
    }
    return range;
  }

  clear(): void { this.intervals.clear(); }

  getHeaderRange(kind: 'columnHeaders' | 'rowHeaders', index: number): CellRange {
    const enabled = this.mode() === AllowMerging.All ||
      (kind === 'columnHeaders' ? this.mode() === AllowMerging.ColumnHeaders : this.mode() === AllowMerging.RowHeaders);
    if (!enabled) return kind === 'columnHeaders' ? new CellRange(0, index) : new CellRange(index, 0);
    if (kind === 'columnHeaders') {
      const value = this.cols.get(index).header;
      let left = index, right = index;
      while (left > 0 && this.cols.get(left - 1).header === value) left--;
      while (right + 1 < this.cols.length && this.cols.get(right + 1).header === value) right++;
      return new CellRange(0, left, 0, right);
    }
    const value = this.rows.get(index).header;
    let top = index, bottom = index;
    while (top > 0 && this.rows.get(top - 1).header === value) top--;
    while (bottom + 1 < this.rows.length && this.rows.get(bottom + 1).header === value) bottom++;
    return new CellRange(top, 0, bottom, 0);
  }
}
