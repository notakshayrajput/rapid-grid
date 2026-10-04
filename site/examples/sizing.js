import { RapidGrid, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const items = Array.from({ length: 30 }, (_, index) => ({
    title: `Record ${index + 1}`,
    description: ['Short note', 'A longer description for a wider column', 'Measured individually'][index % 3],
    quantity: index * 7 + 1,
    category: ['Alpha', 'Beta', 'Gamma'][index % 3],
    owner: ['Avery', 'Jordan', 'Morgan'][index % 3]
  }));
  const grid = new RapidGrid(host, {
    items,
    rowHeight: 32,
    columns: [
      { binding: 'title', header: 'Title', width: 160 },
      { binding: 'description', header: 'Description', width: 255 },
      { binding: 'quantity', header: 'Quantity', width: 100, dataType: DataType.Number },
      { binding: 'category', header: 'Category', width: 130 },
      { binding: 'owner', header: 'Owner', width: 130 }
    ]
  });
  for (let row = 0; row < grid.rows.length; row++) grid.getRow(row).height = row % 4 === 0 ? 50 : 32;
  grid.refresh(true);
  status.textContent = 'Every fourth row is 50px; the rest are 32px.';
  const resize = document.createElement('button');
  resize.textContent = 'Widen description';
  resize.addEventListener('click', () => {
    grid.getColumn('description').width = grid.getColumn('description').width === 255 ? 360 : 255;
    status.textContent = `Description width: ${grid.getColumn('description').width}px`;
  });
  const inspect = document.createElement('button');
  inspect.textContent = 'Inspect row 20 offset';
  inspect.addEventListener('click', () => {
    status.textContent = `Row 20 starts at pixel ${grid.rows.sizes.offset(19)}; binary lookup returns row ${grid.rows.sizes.indexAt(grid.rows.sizes.offset(19)) + 1}.`;
    grid.scrollIntoView(19, 0);
  });
  controls.append(resize, inspect);
  return () => grid.destroy();
}
