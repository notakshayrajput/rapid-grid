import { CollectionView } from '../collections/CollectionView.js';
import { Row, RowCollection } from '../collections/RowCollection.js';
import { Column, ColumnCollection } from '../collections/ColumnCollection.js';
import { GridPanel } from '../panels/GridPanel.js';
import { PrefixSum } from '../virtualization/PrefixSum.js';
import { DOMPool } from '../virtualization/DOMPool.js';
import { VirtualScroller, VirtualWindow } from '../virtualization/VirtualScroller.js';
import { CellRange } from '../merging/CellRange.js';
import { MergeManager } from '../merging/MergeManager.js';
import { formatValue, parseValue } from '../formatters/format.js';
import { parseTsv, serializeTsv } from '../clipboard/tsv.js';
import { EditManager } from '../editing/EditManager.js';
import { AllowDragging, AllowMerging, CellEditEventArgs, CellRangeEventArgs, ColumnOptions,
  DragEventArgs, FormatItemEventArgs, GridOptions, HitTestInfo, SelectionMode } from '../types.js';

type EventName = 'formatItem' | 'cellRecycling' | 'beginningEdit' | 'cellEditEnding' | 'cellEditEnded' |
  'selectionChanging' | 'selectionChanged' | 'draggedRow' | 'draggedColumn';
type Handler = (grid: InfiniteGrid, args: any) => boolean | void;
interface GridResizeObserver { observe(element: Element): void; disconnect(): void }
declare const ResizeObserver: { new(callback: () => void): GridResizeObserver };

export class InfiniteGrid {
  readonly hostElement: HTMLElement;
  readonly collectionView: CollectionView;
  readonly rows: RowCollection;
  readonly columns: ColumnCollection;
  readonly cells: GridPanel;
  readonly columnHeaders: GridPanel;
  readonly rowHeaders: GridPanel;
  readonly topLeftCells: GridPanel;
  allowMerging: AllowMerging;
  allowDragging: AllowDragging;
  selectionMode: SelectionMode;
  autoSizeRows: boolean;

  private root: HTMLElement;
  private viewport: HTMLElement;
  private spacer: HTMLElement;
  private status: HTMLElement;
  private bodyPool: DOMPool;
  private colPool: DOMPool;
  private rowPool: DOMPool;
  private scroller: VirtualScroller;
  private merger: MergeManager;
  private editor: EditManager;
  private resizeObserver: GridResizeObserver | null = null;
  private handlers: { [key: string]: Handler[] } = {};
  private ranges: CellRange[] = [];
  private anchor = { row: 0, col: 0 };
  private activeCell = { row: 0, col: 0 };
  private lastWindow: VirtualWindow | null = null;
  private rowHeaderWidth: number;
  private columnHeaderHeight: number;
  private locale?: string;
  private previousPosition: string;
  private unsubscribe: () => void;
  private autoSizeFrame = 0;
  private suppressClick = false;

  constructor(hostElement: HTMLElement | string, options: GridOptions = {}) {
    const host = typeof hostElement === 'string' ? document.querySelector<HTMLElement>(hostElement) : hostElement;
    if (!host) throw new Error('Grid host element was not found');
    this.hostElement = host;
    this.previousPosition = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.rowHeaderWidth = options.rowHeaderWidth === undefined ? 48 : options.rowHeaderWidth;
    this.columnHeaderHeight = options.columnHeaderHeight === undefined ? 32 : options.columnHeaderHeight;
    this.locale = options.locale;
    this.allowMerging = options.allowMerging || AllowMerging.None;
    this.allowDragging = options.allowDragging || AllowDragging.None;
    this.selectionMode = options.selectionMode || SelectionMode.CellRange;
    this.autoSizeRows = !!options.autoSizeRows;
    const items = options.items || [];
    const columnOptions: ColumnOptions[] = options.columns || (items[0] ? Object.keys(items[0]).map(binding => ({ binding })) : []);
    this.collectionView = new CollectionView(items);
    this.rows = new RowCollection(items.length, options.rowHeight || 32, () => this.invalidate());
    this.columns = new ColumnCollection(columnOptions, options.columnWidth || 120, () => this.invalidate());
    this.root = this.make('div', 'ig-root', host);
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'grid');
    this.root.style.cssText = 'position:absolute;inset:0;overflow:hidden;outline:none;';
    const corner = this.make('div', 'ig-corner', this.root);
    const colHeader = this.make('div', 'ig-column-headers', this.root);
    const rowHeader = this.make('div', 'ig-row-headers', this.root);
    this.viewport = this.make('div', 'ig-viewport', this.root);
    this.viewport.style.cssText = 'position:absolute;overflow:auto;contain:strict;';
    this.spacer = this.make('div', 'ig-spacer', this.viewport);
    this.spacer.style.position = 'relative';
    const body = this.make('div', 'ig-cells', this.spacer);
    body.style.cssText = 'position:absolute;left:0;top:0;';
    this.status = this.make('div', 'ig-status', this.root);
    this.status.setAttribute('role', 'alert');
    this.status.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:20;display:none;padding:6px 10px;background:#fff2f2;color:#9b1c1c;border:1px solid #e8a0a0;';
    this.topLeftCells = new GridPanel('topLeftCells', corner);
    this.columnHeaders = new GridPanel('columnHeaders', colHeader);
    this.rowHeaders = new GridPanel('rowHeaders', rowHeader);
    this.cells = new GridPanel('cells', body);
    this.bodyPool = new DOMPool(body, 'ig-cell', (key, cellElement) => {
      const [row, col] = key.split(':').map(Number);
      this.emit('cellRecycling', { panel: this.cells, row, col, cellElement,
        dataItem: this.collectionView.at(row) || null } as FormatItemEventArgs);
    });
    this.colPool = new DOMPool(colHeader, 'ig-column-header');
    this.rowPool = new DOMPool(rowHeader, 'ig-row-header');
    this.layoutPanels();
    this.merger = new MergeManager(this.collectionView, this.rows, this.columns,
      (row, col) => this.formatted(row, col), () => this.allowMerging);
    this.editor = new EditManager(this.collectionView, this.columns, this.locale,
      (row, col) => this.getCellElement(row, col),
      args => this.emitCancelable('beginningEdit', args),
      args => this.emitCancelable('cellEditEnding', args),
      args => this.emit('cellEditEnded', args), () => this.refresh(true));
    this.scroller = new VirtualScroller(this.viewport, this.rows.sizes, this.columns.sizes,
      options.overscanRows === undefined ? 5 : options.overscanRows,
      options.overscanColumns === undefined ? 2 : options.overscanColumns,
      options.fastScrollThreshold || 1500, window => this.render(window));
    this.unsubscribe = this.collectionView.onChange(() => {
      if (this.rows.length !== this.collectionView.length) this.rows.reset(this.collectionView.length);
      this.refresh(true);
    });
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('dblclick', this.onDoubleClick);
    this.root.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('pointerdown', this.onCellPointerDown);
    this.root.addEventListener('copy', this.onCopy);
    this.root.addEventListener('paste', this.onPaste);
    colHeader.addEventListener('pointerdown', this.onHeaderPointerDown);
    rowHeader.addEventListener('pointerdown', this.onHeaderPointerDown);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.invalidate());
      this.resizeObserver.observe(host);
    }
    this.refresh(true);
  }

  get selection(): readonly CellRange[] { return this.ranges.slice(); }
  getRow(index: number): Row { return this.rows.get(index); }
  getColumn(indexOrBinding: number | string): Column { return this.columns.get(indexOrBinding); }
  getCell(rowIndex: number, colIndex: number): CellRange { return this.merger.getCellRange(rowIndex, colIndex); }
  getCellElement(rowIndex: number, colIndex: number): HTMLElement | null {
    const range = this.getCell(rowIndex, colIndex);
    return this.bodyPool.get(`${range.row}:${range.col}`);
  }
  refresh(full = false): void {
    this.bodyPool.clear(); this.colPool.clear(); this.rowPool.clear(); this.merger.clear();
    this.layoutPanels();
    this.spacer.style.width = `${this.columns.sizes.total}px`;
    this.spacer.style.height = `${this.rows.sizes.total}px`;
    this.scroller.refresh();
  }
  invalidate(): void { this.refresh(true); }
  scrollIntoView(row: number, col: number): void {
    if (row < 0 || row >= this.rows.length || col < 0 || col >= this.columns.length) throw new RangeError('Cell does not exist');
    const top = this.rows.sizes.offset(row), bottom = this.rows.sizes.offset(row + 1);
    const left = this.columns.sizes.offset(col), right = this.columns.sizes.offset(col + 1);
    if (top < this.viewport.scrollTop) this.viewport.scrollTop = top;
    else if (bottom > this.viewport.scrollTop + this.viewport.clientHeight) this.viewport.scrollTop = bottom - this.viewport.clientHeight;
    if (left < this.viewport.scrollLeft) this.viewport.scrollLeft = left;
    else if (right > this.viewport.scrollLeft + this.viewport.clientWidth) this.viewport.scrollLeft = right - this.viewport.clientWidth;
    this.scroller.schedule();
  }
  autoSizeRow(rowIndex: number): void {
    let height = this.rows.defaultHeight;
    this.bodyPool.forEachActive((key, cell) => {
      if (Number(key.split(':')[0]) !== rowIndex || cell.querySelector('input')) return;
      const previous = cell.style.height;
      cell.style.height = 'auto';
      height = Math.max(height, cell.scrollHeight + 2);
      cell.style.height = previous;
    });
    this.rows.setHeight(rowIndex, height);
  }
  autoSizeColumn(colIndex: number): void {
    const column = this.columns.get(colIndex);
    let width = Math.max(this.columns.defaultWidth, column.header.length * 8 + 24);
    this.bodyPool.forEachActive((key, cell) => {
      if (Number(key.split(':')[1]) === colIndex) {
        const previous = cell.style.width;
        cell.style.width = 'max-content';
        width = Math.max(width, cell.scrollWidth + 12);
        cell.style.width = previous;
      }
    });
    column.width = width;
  }
  beginEdit(row: number, col: number): boolean { this.scrollIntoView(row, col); this.refresh(); return this.editor.begin(row, col); }
  commitEdit(): boolean { return this.editor.commit(); }
  cancelEdit(): void { this.editor.cancel(); }

  copySelection(): string {
    const range = this.ranges[this.ranges.length - 1];
    if (!range || !this.rows.length || !this.columns.length) return '';
    const count = (range.row2 - range.row + 1) * (range.col2 - range.col + 1);
    if (count > 1_000_000) throw new RangeError('Selection is too large to copy');
    const values: string[][] = [];
    for (let row = range.row; row <= range.row2; row++) {
      const line: string[] = [];
      for (let col = range.col; col <= range.col2; col++) line.push(this.formatted(row, col));
      values.push(line);
    }
    return serializeTsv(values);
  }

  paste(text: string): number {
    const values = parseTsv(text);
    if (!values.length || !this.rows.length || !this.columns.length) return 0;
    const sourceCells = values.reduce((sum, row) => sum + row.length, 0);
    if (sourceCells > 1_000_000) throw new RangeError('Clipboard data is too large to paste');
    const target = this.ranges[this.ranges.length - 1] || new CellRange(this.activeCell.row, this.activeCell.col);
    const scalar = values.length === 1 && values[0].length === 1;
    const height = scalar ? target.row2 - target.row + 1 : values.length;
    const width = scalar ? target.col2 - target.col + 1 : values.reduce((max, row) => Math.max(max, row.length), 0);
    if (height * width > 1_000_000) throw new RangeError('Paste area is too large');
    const updates: Array<{ index: number; binding: string; value: unknown }> = [];
    const ended: CellEditEventArgs[] = [];
    const fallbackCell = document.createElement('div');
    let lastRow = target.row, lastCol = target.col;
    for (let r = 0; r < height && target.row + r < this.rows.length; r++) {
      for (let c = 0; c < width && target.col + c < this.columns.length; c++) {
        const raw = scalar ? values[0][0] : values[r][c];
        if (raw === undefined) continue;
        const row = target.row + r, col = target.col + c;
        const column = this.columns.get(col);
        if (column.readOnly) continue;
        const dataItem = this.collectionView.at(row)!;
        let value: unknown;
        try { value = parseValue(raw, column, this.locale); }
        catch (error) { throw new Error(`Invalid value at row ${row + 1}, column ${col + 1}: ${String(error)}`); }
        const args: CellEditEventArgs = { row, col, dataItem, oldValue: dataItem[column.binding], value,
          cellElement: this.getCellElement(row, col) || fallbackCell, cancel: false };
        if (!this.emitCancelable('cellEditEnding', args)) continue;
        updates.push({ index: row, binding: column.binding, value: args.value });
        ended.push(args);
        lastRow = Math.max(lastRow, row); lastCol = Math.max(lastCol, col);
      }
    }
    if (!updates.length) return 0;
    this.collectionView.setValues(updates);
    for (const args of ended) this.emit('cellEditEnded', args);
    this.select(new CellRange(target.row, target.col, lastRow, lastCol));
    return updates.length;
  }

  select(range: CellRange, add = false, preserveAnchor = false): boolean {
    if (this.selectionMode === SelectionMode.None || !range.isValid ||
      range.row2 >= this.rows.length || range.col2 >= this.columns.length) return false;
    let next: CellRange[];
    if (this.selectionMode === SelectionMode.Cell) next = [new CellRange(range.row, range.col)];
    else if (this.selectionMode === SelectionMode.Row) next = [new CellRange(range.row, 0, range.row, Math.max(0, this.columns.length - 1))];
    else if (this.selectionMode === SelectionMode.RowRange) next = [new CellRange(range.row, 0, range.row2, Math.max(0, this.columns.length - 1))];
    else next = add ? this.ranges.concat(range) : [range];
    const args: CellRangeEventArgs = { oldRanges: this.ranges.slice(), ranges: next, cancel: false };
    if (!this.emitCancelable('selectionChanging', args)) return false;
    this.ranges = args.ranges;
    this.status.style.display = 'none';
    if (!preserveAnchor) this.anchor = { row: range.row, col: range.col };
    this.activeCell = { row: range.row2, col: range.col2 };
    this.updateSelection();
    this.emit('selectionChanged', args);
    return true;
  }

  hitTest(pointX: number, pointY: number): HitTestInfo {
    const rect = this.hostElement.getBoundingClientRect();
    const x = pointX - rect.left, y = pointY - rect.top;
    let panel: GridPanel | null = null, row = -1, col = -1, localX = 0, localY = 0;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return { panel, row, col, nearRightEdge: false, nearBottomEdge: false };
    if (x < this.rowHeaderWidth && y < this.columnHeaderHeight) panel = this.topLeftCells;
    else if (y < this.columnHeaderHeight) {
      panel = this.columnHeaders; localX = x - this.rowHeaderWidth + this.viewport.scrollLeft;
      col = this.columns.sizes.indexAt(localX);
    } else if (x < this.rowHeaderWidth) {
      panel = this.rowHeaders; localY = y - this.columnHeaderHeight + this.viewport.scrollTop;
      row = this.rows.sizes.indexAt(localY);
    } else {
      panel = this.cells; localX = x - this.rowHeaderWidth + this.viewport.scrollLeft;
      localY = y - this.columnHeaderHeight + this.viewport.scrollTop;
      row = this.rows.sizes.indexAt(localY); col = this.columns.sizes.indexAt(localX);
    }
    return { panel, row, col,
      nearRightEdge: col >= 0 && Math.abs(this.columns.sizes.offset(col + 1) - localX) < 5,
      nearBottomEdge: row >= 0 && Math.abs(this.rows.sizes.offset(row + 1) - localY) < 5 };
  }

  onFormatItem(handler: (grid: InfiniteGrid, args: FormatItemEventArgs) => void): () => void { return this.on('formatItem', handler); }
  onCellRecycling(handler: (grid: InfiniteGrid, args: FormatItemEventArgs) => void): () => void { return this.on('cellRecycling', handler); }
  onBeginningEdit(handler: (grid: InfiniteGrid, args: CellEditEventArgs) => boolean | void): () => void { return this.on('beginningEdit', handler); }
  onCellEditEnding(handler: (grid: InfiniteGrid, args: CellEditEventArgs) => boolean | void): () => void { return this.on('cellEditEnding', handler); }
  onCellEditEnded(handler: (grid: InfiniteGrid, args: CellEditEventArgs) => void): () => void { return this.on('cellEditEnded', handler); }
  onSelectionChanging(handler: (grid: InfiniteGrid, args: CellRangeEventArgs) => boolean | void): () => void { return this.on('selectionChanging', handler); }
  onSelectionChanged(handler: (grid: InfiniteGrid, args: CellRangeEventArgs) => void): () => void { return this.on('selectionChanged', handler); }
  onDraggedRow(handler: (grid: InfiniteGrid, args: DragEventArgs) => void): () => void { return this.on('draggedRow', handler); }
  onDraggedColumn(handler: (grid: InfiniteGrid, args: DragEventArgs) => void): () => void { return this.on('draggedColumn', handler); }

  destroy(): void {
    this.editor.destroy();
    this.scroller.destroy();
    this.resizeObserver?.disconnect();
    if (this.autoSizeFrame) cancelAnimationFrame(this.autoSizeFrame);
    this.unsubscribe();
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('dblclick', this.onDoubleClick);
    this.root.removeEventListener('keydown', this.onKeyDown);
    this.root.removeEventListener('pointerdown', this.onCellPointerDown);
    this.root.removeEventListener('copy', this.onCopy);
    this.root.removeEventListener('paste', this.onPaste);
    this.columnHeaders.hostElement.removeEventListener('pointerdown', this.onHeaderPointerDown);
    this.rowHeaders.hostElement.removeEventListener('pointerdown', this.onHeaderPointerDown);
    this.root.remove();
    this.hostElement.style.position = this.previousPosition;
  }

  private make(tag: string, className: string, parent: HTMLElement): HTMLElement {
    const element = document.createElement(tag);
    element.className = className;
    parent.appendChild(element);
    return element;
  }
  private layoutPanels(): void {
    const w = this.rowHeaderWidth, h = this.columnHeaderHeight;
    this.topLeftCells.hostElement.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;overflow:hidden;`;
    this.columnHeaders.hostElement.style.cssText = `position:absolute;left:${w}px;right:0;top:0;height:${h}px;overflow:hidden;`;
    this.rowHeaders.hostElement.style.cssText = `position:absolute;left:0;top:${h}px;bottom:0;width:${w}px;overflow:hidden;`;
    this.viewport.style.left = `${w}px`; this.viewport.style.top = `${h}px`;
    this.viewport.style.right = '0'; this.viewport.style.bottom = '0';
  }
  private formatted(row: number, col: number): string {
    const item = this.collectionView.at(row), column = this.columns.get(col);
    return item ? formatValue(item[column.binding], column, this.locale) : '';
  }
  private render(window: VirtualWindow): void {
    this.lastWindow = window;
    const body = new Set<string>();
    const ranges = new Map<string, CellRange>();
    for (let r = window.rowStart; r <= window.rowEnd; r++) for (let c = window.colStart; c <= window.colEnd; c++) {
      const range = this.merger.getCellRange(r, c);
      const key = `${range.row}:${range.col}`;
      body.add(key); ranges.set(key, range);
    }
    this.bodyPool.reconcile(body, (key, cell) => {
      const range = ranges.get(key)!;
      this.bindBody(cell, range);
    });
    const colKeys = new Set<string>();
    const colRanges = new Map<string, CellRange>();
    for (let c = window.colStart; c <= window.colEnd; c++) {
      const range = this.merger.getHeaderRange('columnHeaders', c);
      colKeys.add(String(range.col)); colRanges.set(String(range.col), range);
    }
    this.colPool.reconcile(colKeys, (key, cell) => this.bindColumnHeader(cell, colRanges.get(key)!));
    this.colPool.forEachActive((key, cell) => { cell.style.transform = `translate3d(${this.columns.sizes.offset(Number(key)) - this.viewport.scrollLeft}px,0,0)`; });
    const rowKeys = new Set<string>();
    const rowRanges = new Map<string, CellRange>();
    for (let r = window.rowStart; r <= window.rowEnd; r++) {
      const range = this.merger.getHeaderRange('rowHeaders', r);
      rowKeys.add(String(range.row)); rowRanges.set(String(range.row), range);
    }
    this.rowPool.reconcile(rowKeys, (key, cell) => this.bindRowHeader(cell, rowRanges.get(key)!));
    this.rowPool.forEachActive((key, cell) => { cell.style.transform = `translate3d(0,${this.rows.sizes.offset(Number(key)) - this.viewport.scrollTop}px,0)`; });
    this.updateSelection();
    if (this.autoSizeRows && !window.fast && !this.autoSizeFrame) {
      this.autoSizeFrame = requestAnimationFrame(() => {
        this.autoSizeFrame = 0;
        for (let row = window.rowStart; row <= window.rowEnd; row++) this.autoSizeRow(row);
      });
    }
  }
  private bindBody(cell: HTMLElement, range: CellRange): void {
    const row = range.row, col = range.col, item = this.collectionView.at(row) || null;
    cell.textContent = this.formatted(row, col);
    cell.dataset.row = String(row); cell.dataset.col = String(col);
    cell.dataset.row2 = String(range.row2); cell.dataset.col2 = String(range.col2);
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-rowindex', String(row + 1)); cell.setAttribute('aria-colindex', String(col + 1));
    cell.style.cssText = `position:absolute;box-sizing:border-box;transform:translate3d(${this.columns.sizes.offset(col)}px,${this.rows.sizes.offset(row)}px,0);width:${this.columns.sizes.range(col,range.col2 + 1)}px;height:${this.rows.sizes.range(row,range.row2 + 1)}px;overflow:hidden;`;
    this.emit('formatItem', { panel: this.cells, row, col, cellElement: cell, dataItem: item } as FormatItemEventArgs);
  }
  private bindColumnHeader(cell: HTMLElement, range: CellRange): void {
    cell.textContent = this.columns.get(range.col).header;
    cell.dataset.col = String(range.col);
    cell.setAttribute('role', 'columnheader');
    cell.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;width:${this.columns.sizes.range(range.col,range.col2 + 1)}px;height:${this.columnHeaderHeight}px;overflow:hidden;`;
    this.emit('formatItem', { panel: this.columnHeaders, row: 0, col: range.col, cellElement: cell, dataItem: null } as FormatItemEventArgs);
  }
  private bindRowHeader(cell: HTMLElement, range: CellRange): void {
    cell.textContent = this.rows.get(range.row).header;
    cell.dataset.row = String(range.row);
    cell.setAttribute('role', 'rowheader');
    cell.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;width:${this.rowHeaderWidth}px;height:${this.rows.sizes.range(range.row,range.row2 + 1)}px;overflow:hidden;`;
    this.emit('formatItem', { panel: this.rowHeaders, row: range.row, col: 0, cellElement: cell, dataItem: this.collectionView.at(range.row) || null } as FormatItemEventArgs);
  }
  private updateSelection(): void {
    this.bodyPool.forEachActive((key, cell) => {
      const [row, col] = key.split(':').map(Number);
      const merged = new CellRange(row, col, Number(cell.dataset.row2), Number(cell.dataset.col2));
      const selected = this.ranges.some(range => range.intersects(merged));
      cell.classList.toggle('ig-selected', selected);
      cell.setAttribute('aria-selected', String(selected));
    });
  }
  private on(name: EventName, handler: Handler): () => void {
    (this.handlers[name] || (this.handlers[name] = [])).push(handler);
    return () => { this.handlers[name] = (this.handlers[name] || []).filter(item => item !== handler); };
  }
  private emit(name: EventName, args: any): void { (this.handlers[name] || []).slice().forEach(handler => handler(this, args)); }
  private emitCancelable(name: EventName, args: { cancel: boolean }): boolean {
    for (const handler of (this.handlers[name] || []).slice()) if (handler(this, args) === false) args.cancel = true;
    return !args.cancel;
  }
  private onClick = (event: MouseEvent): void => {
    if (this.editor.isEditing) return;
    if (this.suppressClick) { this.suppressClick = false; return; }
    const cell = (event.target as Element).closest<HTMLElement>('.ig-cell');
    if (!cell || !this.root.contains(cell)) return;
    const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
    const shift = event.shiftKey && this.ranges.length > 0;
    const range = shift ? new CellRange(this.anchor.row, this.anchor.col, row, col) : new CellRange(row, col);
    this.select(range, this.selectionMode === SelectionMode.MultiRange && (event.ctrlKey || event.metaKey), shift);
    this.activeCell = { row, col };
    this.root.focus();
  };
  private onCellPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.editor.isEditing ||
      (this.selectionMode !== SelectionMode.CellRange && this.selectionMode !== SelectionMode.MultiRange)) return;
    const cell = (event.target as Element).closest<HTMLElement>('.ig-cell');
    if (!cell || (event.target as Element).closest('input,textarea,select,[contenteditable]')) return;
    const start = event.shiftKey && this.ranges.length ? this.anchor :
      { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    const originX = event.clientX, originY = event.clientY;
    let dragging = false;
    let lastRow = -1, lastCol = -1;
    const move = (next: PointerEvent) => {
      if (!dragging && Math.hypot(next.clientX - originX, next.clientY - originY) < 4) return;
      const hit = this.hitTest(next.clientX, next.clientY);
      if (hit.panel !== this.cells || hit.row < 0 || hit.col < 0) return;
      if (hit.row === lastRow && hit.col === lastCol) return;
      lastRow = hit.row; lastCol = hit.col;
      if (!dragging) { dragging = true; this.anchor = start; }
      next.preventDefault();
      this.select(new CellRange(start.row, start.col, hit.row, hit.col), false, true);
      this.activeCell = { row: hit.row, col: hit.col };
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (dragging) {
        this.suppressClick = true;
        this.root.focus();
        requestAnimationFrame(() => { this.suppressClick = false; });
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
    document.addEventListener('pointercancel', up, { once: true });
  };
  private onCopy = (event: ClipboardEvent): void => {
    if (this.editor.isEditing || !event.clipboardData ||
      (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) return;
    try {
      const text = this.copySelection();
      if (!text) return;
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
      this.status.style.display = 'none';
    } catch (error) { this.showError(error); event.preventDefault(); }
  };
  private onPaste = (event: ClipboardEvent): void => {
    if (this.editor.isEditing || !event.clipboardData ||
      (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) return;
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    event.preventDefault();
    try { this.paste(text); this.status.style.display = 'none'; }
    catch (error) { this.showError(error); }
  };
  private showError(error: unknown): void {
    this.status.textContent = error instanceof Error ? error.message : String(error);
    this.status.style.display = 'block';
  }
  private onDoubleClick = (event: MouseEvent): void => {
    if (this.editor.isEditing) return;
    const cell = (event.target as Element).closest<HTMLElement>('.ig-cell');
    if (cell) this.beginEdit(Number(cell.dataset.row), Number(cell.dataset.col));
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.editor.isEditing || !this.rows.length || !this.columns.length) return;
    let row = this.activeCell.row, col = this.activeCell.col;
    switch (event.key) {
      case 'ArrowUp': row--; break;
      case 'ArrowDown': row++; break;
      case 'ArrowLeft': col--; break;
      case 'ArrowRight': col++; break;
      case 'Home': col = 0; if (event.ctrlKey || event.metaKey) row = 0; break;
      case 'End': col = this.columns.length - 1; if (event.ctrlKey || event.metaKey) row = this.rows.length - 1; break;
      case 'PageUp': row -= Math.max(1, Math.floor(this.viewport.clientHeight / this.rows.defaultHeight)); break;
      case 'PageDown': row += Math.max(1, Math.floor(this.viewport.clientHeight / this.rows.defaultHeight)); break;
      case 'Enter': case 'F2': event.preventDefault(); this.beginEdit(row, col); return;
      case ' ': if (this.columns.get(col).dataType === 'Boolean') { event.preventDefault(); this.beginEdit(row, col); } return;
      default: return;
    }
    event.preventDefault();
    row = Math.max(0, Math.min(this.rows.length - 1, row));
    col = Math.max(0, Math.min(this.columns.length - 1, col));
    this.select(event.shiftKey ? new CellRange(this.anchor.row, this.anchor.col, row, col) : new CellRange(row, col), false, event.shiftKey);
    this.activeCell = { row, col };
    this.scrollIntoView(row, col);
  };
  private onHeaderPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const header = (event.target as Element).closest<HTMLElement>('.ig-column-header,.ig-row-header');
    if (!header) return;
    const isColumn = header.classList.contains('ig-column-header');
    if (isColumn && this.allowDragging !== AllowDragging.Columns && this.allowDragging !== AllowDragging.Both) return;
    if (!isColumn && this.allowDragging !== AllowDragging.Rows && this.allowDragging !== AllowDragging.Both) return;
    const from = Number(isColumn ? header.dataset.col : header.dataset.row);
    const origin = isColumn ? event.clientX : event.clientY;
    let ghost: HTMLElement | null = null, line: HTMLElement | null = null, to = from;
    const move = (e: PointerEvent) => {
      const coordinate = isColumn ? e.clientX : e.clientY;
      if (!ghost && Math.abs(coordinate - origin) < 5) return;
      if (!ghost) {
        ghost = this.make('div', 'ig-drag-ghost', document.body);
        ghost.textContent = header.textContent;
        ghost.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;padding:6px;background:#e7efff;border:1px solid #8da8d5;opacity:.9;';
        line = this.make('div', 'ig-drop-line', this.root);
        line.style.cssText = 'position:absolute;z-index:10;background:#3478d4;pointer-events:none;';
      }
      ghost.style.left = `${e.clientX + 12}px`; ghost.style.top = `${e.clientY + 12}px`;
      const hit = this.hitTest(e.clientX, e.clientY);
      to = isColumn ? hit.col : hit.row;
      if (to < 0) return;
      if (isColumn) {
        line!.style.left = `${this.rowHeaderWidth + this.columns.sizes.offset(to) - this.viewport.scrollLeft}px`;
        line!.style.top = '0'; line!.style.width = '2px'; line!.style.height = '100%';
      } else {
        line!.style.top = `${this.columnHeaderHeight + this.rows.sizes.offset(to) - this.viewport.scrollTop}px`;
        line!.style.left = '0'; line!.style.height = '2px'; line!.style.width = '100%';
      }
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      ghost?.remove(); line?.remove();
      if (!ghost || to < 0 || to === from) return;
      if (isColumn) { this.columns.move(from, to); this.emit('draggedColumn', { from, to } as DragEventArgs); }
      else { this.rows.move(from, to); this.collectionView.move(from, to); this.emit('draggedRow', { from, to } as DragEventArgs); }
      this.refresh(true);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
  };
}
