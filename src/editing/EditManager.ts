import { CollectionView } from '../collections/CollectionView.js';
import { ColumnCollection } from '../collections/ColumnCollection.js';
import { DataType, DateRangeValue, CellEditEventArgs } from '../types.js';
import { parseValue } from '../formatters/format.js';
import { localDateInputValue, parseLocalDateInput } from '../formatters/localDate.js';

export class EditManager {
  private active: { row: number; col: number; cell: HTMLElement; editor: HTMLElement; oldValue: unknown } | null = null;
  constructor(private view: CollectionView, private columns: ColumnCollection, private locale: string | undefined,
    private getCell: (row: number, col: number) => HTMLElement | null,
    private beginning: (args: CellEditEventArgs) => boolean,
    private ending: (args: CellEditEventArgs) => boolean,
    private ended: (args: CellEditEventArgs) => void,
    private refresh: () => void) {}

  get isEditing(): boolean { return !!this.active; }
  begin(row: number, col: number): boolean {
    if (this.active) this.commit();
    const column = this.columns.get(col), item = this.view.at(row), cell = this.getCell(row, col);
    if (!item || !cell || column.readOnly) return false;
    const oldValue = item[column.binding];
    const args: CellEditEventArgs = { row, col, dataItem: item, oldValue, value: oldValue, cellElement: cell, cancel: false };
    if (!this.beginning(args)) return false;
    const editor = column.editor ? column.editor(oldValue, item, column) : this.defaultEditor(column.dataType, oldValue);
    cell.textContent = '';
    cell.appendChild(editor);
    this.active = { row, col, cell, editor, oldValue };
    editor.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('pointerdown', this.onOutside, true);
    const focusable = editor.matches('input,select,textarea') ? editor : editor.querySelector('input,select,textarea');
    if (focusable instanceof HTMLElement) focusable.focus(); else editor.focus();
    return true;
  }
  commit(): boolean {
    const state = this.active;
    if (!state) return true;
    const item = this.view.at(state.row);
    if (!item) { this.cancel(); return false; }
    let value: unknown;
    try { value = this.readValue(state.editor, state.col); }
    catch (error) { state.editor.setAttribute('aria-invalid', 'true'); state.editor.setAttribute('title', String(error)); return false; }
    const args: CellEditEventArgs = { row: state.row, col: state.col, dataItem: item, oldValue: state.oldValue,
      value, cellElement: state.cell, cancel: false };
    if (!this.ending(args)) return false;
    this.cleanup();
    this.view.setValue(state.row, this.columns.get(state.col).binding, args.value);
    this.ended(args);
    this.refresh();
    return true;
  }
  cancel(): void { if (!this.active) return; this.cleanup(); this.refresh(); }
  destroy(): void { this.cancel(); }

  private cleanup(): void {
    if (!this.active) return;
    this.active.editor.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.active = null;
  }
  private onOutside = (event: PointerEvent) => {
    if (this.active && !this.active.cell.contains(event.target as Node)) this.commit();
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.cancel(); }
    else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      this.commit();
    }
  };
  private defaultEditor(type: DataType, value: unknown): HTMLElement {
    if (type === DataType.DateRange) {
      const wrapper = document.createElement('div');
      wrapper.className = 'ig-date-range-editor';
      const range = value as DateRangeValue | undefined;
      for (const date of [range && range.start, range && range.end]) {
        const input = document.createElement('input');
        input.type = 'date';
        input.value = date instanceof Date && !Number.isNaN(date.getTime()) ? localDateInputValue(date) : '';
        wrapper.appendChild(input);
      }
      return wrapper;
    }
    const input = document.createElement('input');
    input.className = 'ig-editor';
    input.type = type === DataType.Number ? 'text' : type === DataType.Date ? 'date' :
      type === DataType.Time ? 'time' : type === DataType.DateTime ? 'datetime-local' :
      type === DataType.Boolean ? 'checkbox' : 'text';
    if (type === DataType.Boolean) input.checked = Boolean(value);
    else if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString();
      input.value = type === DataType.Date ? local.slice(0, 10) : type === DataType.Time ? local.slice(11, 16) : local.slice(0, 16);
    } else input.value = value == null ? '' : String(value);
    return input;
  }
  private readValue(editor: HTMLElement, col: number): unknown {
    const column = this.columns.get(col);
    if (column.dataType === DataType.DateRange) {
      const inputs = editor.querySelectorAll<HTMLInputElement>('input[type="date"]');
      if (inputs.length < 2) throw new Error('Date range needs two dates');
      const start = parseLocalDateInput(inputs[0].value), end = parseLocalDateInput(inputs[1].value);
      if (start > end) throw new Error('Invalid date range');
      return { start, end } as DateRangeValue;
    }
    const input = editor instanceof HTMLInputElement || editor instanceof HTMLSelectElement || editor instanceof HTMLTextAreaElement
      ? editor : editor.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select');
    if (!input) throw new Error('Editor needs an input');
    if (input instanceof HTMLInputElement && input.type === 'checkbox') return input.checked;
    return parseValue(input.value, column, this.locale);
  }
}
