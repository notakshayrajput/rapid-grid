import { RapidGrid, AllowDragging, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const original = [
    ['Draft proposal', 'Avery', 'In progress'], ['Review scope', 'Jordan', 'Ready'],
    ['Confirm budget', 'Morgan', 'Blocked'], ['Build prototype', 'Riley', 'In progress'],
    ['Run user tests', 'Taylor', 'Planned'], ['Polish interactions', 'Casey', 'Planned'],
    ['Ship beta', 'Avery', 'Planned'], ['Collect feedback', 'Jordan', 'Planned'],
    ['Improve onboarding', 'Morgan', 'Planned'], ['Publish release', 'Riley', 'Planned'],
    ['Measure adoption', 'Taylor', 'Planned'], ['Plan next cycle', 'Casey', 'Planned']
  ].map(([task, owner, state], index) => ({ id: index + 1, task, owner, state }));
  const grid = new RapidGrid(host, {
    items: original.slice(),
    allowDragging: AllowDragging.Rows,
    rowHeaderWidth: 58,
    columns: [
      { binding: 'id', header: 'ID', width: 65, dataType: DataType.Number, readOnly: true },
      { binding: 'task', header: 'Task', width: 250 },
      { binding: 'owner', header: 'Owner', width: 150 },
      { binding: 'state', header: 'Status', width: 150 }
    ]
  });
  for (let index = 0; index < grid.rows.length; index++) grid.getRow(index).header = '⋮⋮';
  grid.refresh(true);
  status.textContent = 'Drag the ⋮⋮ row header to reorder tasks.';
  grid.onDraggedRow((_grid, event) => {
    const task = grid.collectionView.at(event.to).task;
    status.textContent = `Moved “${task}” from row ${event.from + 1} to row ${event.to + 1}.`;
  });
  const reset = document.createElement('button');
  reset.textContent = 'Reset order';
  reset.addEventListener('click', () => {
    grid.collectionView.setItems(original.slice());
    status.textContent = 'Original task order restored.';
  });
  controls.appendChild(reset);
  return () => grid.destroy();
}
