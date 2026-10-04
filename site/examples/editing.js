import { RapidGrid, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const items = Array.from({ length: 16 }, (_, index) => ({
    request: `Request ${index + 1}`,
    budget: 500 + index * 175,
    approved: index % 3 === 0,
    window: { start: new Date(2026, 0, index + 1), end: new Date(2026, 0, index + 5) },
    owner: ['Avery', 'Jordan', 'Morgan', 'Riley'][index % 4]
  }));
  const grid = new RapidGrid(host, {
    items,
    columns: [
      { binding: 'request', header: 'Request', width: 160 },
      { binding: 'budget', header: 'Budget', width: 130, dataType: DataType.Number, format: 'c0' },
      { binding: 'approved', header: 'Approved', width: 100, dataType: DataType.Boolean },
      { binding: 'window', header: 'Date range', width: 245, dataType: DataType.DateRange },
      { binding: 'owner', header: 'Owner', width: 130 }
    ]
  });
  grid.onBeginningEdit((_grid, event) => { status.textContent = `Editing row ${event.row + 1}, column ${event.col + 1}…`; });
  grid.onCellEditEnding((_grid, event) => {
    if (event.col === 1 && (event.value === null || event.value < 0)) {
      status.textContent = 'Budget must be zero or greater. Edit was cancelled.';
      return false;
    }
  });
  grid.onCellEditEnded((_grid, event) => { status.textContent = `Saved row ${event.row + 1}, column ${event.col + 1}.`; });
  status.textContent = 'Double-click a cell to edit. Budget values must be nonnegative.';
  const focus = document.createElement('button');
  focus.textContent = 'Edit first date range';
  focus.addEventListener('click', () => grid.beginEdit(0, 3));
  controls.appendChild(focus);
  return () => grid.destroy();
}
