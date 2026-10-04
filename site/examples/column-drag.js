import { RapidGrid, AllowDragging, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const items = Array.from({ length: 18 }, (_, index) => ({
    project: `Project ${String(index + 1).padStart(2, '0')}`,
    owner: ['Avery', 'Jordan', 'Morgan'][index % 3],
    status: ['Active', 'Review', 'Planning'][index % 3],
    priority: ['High', 'Medium', 'Low'][index % 3],
    budget: 1200 + index * 175,
    spent: 450 + index * 82,
    region: ['North', 'East', 'West'][index % 3],
    note: `Sprint ${index % 5 + 1}`
  }));
  const grid = new RapidGrid(host, {
    items,
    allowDragging: AllowDragging.Columns,
    columns: [
      { binding: 'project', header: 'Project', width: 155 },
      { binding: 'owner', header: 'Owner', width: 115 },
      { binding: 'status', header: 'Status', width: 125 },
      { binding: 'priority', header: 'Priority', width: 110 },
      { binding: 'budget', header: 'Budget', width: 115, dataType: DataType.Number, format: 'c0' },
      { binding: 'spent', header: 'Spent', width: 115, dataType: DataType.Number, format: 'c0' },
      { binding: 'region', header: 'Region', width: 110 },
      { binding: 'note', header: 'Note', width: 120 }
    ]
  });
  status.textContent = 'Drag a column header to move it.';
  grid.onDraggedColumn((_grid, event) => {
    status.textContent = `Moved “${grid.getColumn(event.to).header}” from column ${event.from + 1} to ${event.to + 1}.`;
  });
  const showOrder = document.createElement('button');
  showOrder.textContent = 'Show column order';
  showOrder.addEventListener('click', () => { status.textContent = grid.columns.toArray().map(column => column.header).join(' → '); });
  controls.appendChild(showOrder);
  return () => grid.destroy();
}
