export class CellRange {
  readonly row: number;
  readonly col: number;
  readonly row2: number;
  readonly col2: number;

  constructor(row: number, col: number, row2: number = row, col2: number = col) {
    this.row = Math.min(row, row2);
    this.col = Math.min(col, col2);
    this.row2 = Math.max(row, row2);
    this.col2 = Math.max(col, col2);
  }

  get isValid(): boolean { return this.row >= 0 && this.col >= 0 && this.row2 >= this.row && this.col2 >= this.col; }
  contains(row: number, col: number): boolean { return this.isValid && row >= this.row && row <= this.row2 && col >= this.col && col <= this.col2; }
  intersects(other: CellRange): boolean {
    return this.isValid && other.isValid && this.row <= other.row2 && this.row2 >= other.row && this.col <= other.col2 && this.col2 >= other.col;
  }
}
