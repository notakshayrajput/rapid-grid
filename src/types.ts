import { CellRange } from './merging/CellRange.js';
import { GridPanel } from './panels/GridPanel.js';

export type DataItem = Record<string, unknown>;
export type DateRangeValue = { start: Date; end: Date };
export enum DataType { String = 'String', Number = 'Number', Date = 'Date', Time = 'Time', DateTime = 'DateTime', DateRange = 'DateRange', Boolean = 'Boolean' }
export enum AllowMerging { None = 'None', Cells = 'Cells', RowHeaders = 'RowHeaders', ColumnHeaders = 'ColumnHeaders', All = 'All' }
export enum AllowDragging { None = 'None', Columns = 'Columns', Rows = 'Rows', Both = 'Both' }
export enum SelectionMode { None = 'None', Cell = 'Cell', CellRange = 'CellRange', Row = 'Row', RowRange = 'RowRange', MultiRange = 'MultiRange' }

export interface ColumnOptions {
  binding: string;
  header?: string;
  width?: number;
  dataType?: DataType;
  format?: string;
  allowMerging?: boolean;
  readOnly?: boolean;
  editor?: (value: unknown, item: DataItem, column: ColumnOptions) => HTMLElement;
}

export interface GridOptions {
  items?: DataItem[];
  columns?: ColumnOptions[];
  rowHeight?: number;
  columnWidth?: number;
  rowHeaderWidth?: number;
  columnHeaderHeight?: number;
  overscanRows?: number;
  overscanColumns?: number;
  fastScrollThreshold?: number;
  allowMerging?: AllowMerging;
  allowDragging?: AllowDragging;
  selectionMode?: SelectionMode;
  autoSizeRows?: boolean;
  locale?: string;
}

export interface FormatItemEventArgs {
  panel: GridPanel;
  row: number;
  col: number;
  cellElement: HTMLElement;
  dataItem: DataItem | null;
}
export interface CellEditEventArgs {
  row: number;
  col: number;
  dataItem: DataItem;
  oldValue: unknown;
  value: unknown;
  cellElement: HTMLElement;
  cancel: boolean;
}
export interface CellRangeEventArgs { oldRanges: CellRange[]; ranges: CellRange[]; cancel: boolean }
export interface DragEventArgs { from: number; to: number }
export interface HitTestInfo {
  panel: GridPanel | null;
  row: number;
  col: number;
  nearRightEdge: boolean;
  nearBottomEdge: boolean;
}
