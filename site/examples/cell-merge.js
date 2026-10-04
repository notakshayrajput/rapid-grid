import { RapidGrid, AllowMerging } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const patterns = [
    ['Plan', 'Plan', 'Build', 'Build', 'Build', 'Ship'],
    ['Intake', 'Review', 'Review', 'Review', 'Test', 'Test'],
    ['Research', 'Research', 'Research', 'Design', 'Design', 'Launch']
  ];
  const items = Array.from({ length: 18 }, (_, index) => {
    const values = patterns[index % patterns.length];
    return Object.fromEntries(values.map((value, slot) => [`slot${slot + 1}`, value]));
  });
  const grid = new RapidGrid(host, {
    items,
    allowMerging: AllowMerging.Cells,
    columns: Array.from({ length: 6 }, (_, index) => ({ binding: `slot${index + 1}`, header: `Stage ${index + 1}`, width: 135 }))
  });
  for (let row = 0; row < grid.rows.length; row++) grid.getRow(row).allowMerging = true;
  grid.refresh(true);
  status.textContent = 'Equal adjacent values in each row render as one wide cell.';
  const inspect = document.createElement('button');
  inspect.textContent = 'Inspect first merged cell';
  inspect.addEventListener('click', () => {
    const range = grid.getCell(0, 1);
    status.textContent = `Row ${range.row + 1}, columns ${range.col + 1}–${range.col2 + 1}`;
  });
  controls.appendChild(inspect);
  return () => grid.destroy();
}
