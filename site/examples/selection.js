import { RapidGrid, CellRange, DataType, SelectionMode } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const items = Array.from({ length: 24 }, (_, row) => ({
    item: `Item ${row + 1}`, jan: row * 10 + 1, feb: row * 10 + 2,
    mar: row * 10 + 3, apr: row * 10 + 4, may: row * 10 + 5
  }));
  const grid = new RapidGrid(host, {
    items,
    selectionMode: SelectionMode.CellRange,
    columns: [
      { binding: 'item', header: 'Item', width: 145 },
      ...['jan', 'feb', 'mar', 'apr', 'may'].map(binding => ({
        binding, header: binding.toUpperCase(), width: 110, dataType: DataType.Number
      }))
    ]
  });
  grid.select(new CellRange(1, 1, 4, 2)); // Rows 2–5, columns 2–3 in the UI.
  grid.onSelectionChanged((_grid, event) => {
    const range = event.ranges.at(-1);
    if (range) status.textContent = `Selected rows ${range.row + 1}–${range.row2 + 1}, columns ${range.col + 1}–${range.col2 + 1}`;
  });
  status.textContent = 'Rows 2–5 × columns 2–3 selected. Try Shift+Arrow or drag.';
  const preview = document.createElement('textarea');
  preview.setAttribute('aria-label', 'Clipboard preview');
  preview.placeholder = 'Copy here, edit, then paste…';
  const copy = document.createElement('button');
  copy.textContent = 'Copy to preview';
  copy.addEventListener('click', () => { preview.value = grid.copySelection(); status.textContent = 'Selected cells copied to the preview.'; });
  const paste = document.createElement('button');
  paste.textContent = 'Paste preview';
  paste.addEventListener('click', () => {
    try { status.textContent = `${grid.paste(preview.value)} cells updated.`; }
    catch (error) { status.textContent = error.message; }
  });
  controls.append(copy, paste, preview);
  return () => grid.destroy();
}
