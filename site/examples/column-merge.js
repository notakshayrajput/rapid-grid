import { RapidGrid, AllowMerging, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  const regions = ['North', 'South', 'East', 'West'];
  const items = Array.from({ length: 24 }, (_, index) => ({
    region: regions[Math.floor(index / 6)],
    quarter: `Q${Math.floor(index % 6 / 2) + 1}`,
    product: ['Studio', 'Cloud', 'Mobile'][index % 3],
    revenue2024: 1800 + index * 135,
    margin2024: .17 + index * .005,
    revenue2025: 2300 + index * 165,
    margin2025: .22 + index * .004
  }));
  const grid = new RapidGrid(host, {
    items,
    allowMerging: AllowMerging.All,
    columns: [
      { binding: 'region', header: 'Region', width: 115, allowMerging: true },
      { binding: 'quarter', header: 'Quarter', width: 100, allowMerging: true },
      { binding: 'product', header: 'Product', width: 126 },
      { binding: 'revenue2024', header: 'FY 2024', width: 115, dataType: DataType.Number, format: 'c0' },
      { binding: 'margin2024', header: 'FY 2024', width: 100, dataType: DataType.Number, format: 'p1' },
      { binding: 'revenue2025', header: 'FY 2025', width: 115, dataType: DataType.Number, format: 'c0' },
      { binding: 'margin2025', header: 'FY 2025', width: 100, dataType: DataType.Number, format: 'p1' }
    ]
  });
  status.textContent = 'Equal Region and Quarter values merge vertically; matching year headers merge sideways.';
  const inspect = document.createElement('button');
  inspect.textContent = 'Inspect merged range';
  inspect.addEventListener('click', () => {
    const range = grid.getCell(3, 0);
    status.textContent = `Region at row 4 → rows ${range.row + 1}–${range.row2 + 1}, column ${range.col + 1}`;
  });
  controls.appendChild(inspect);
  return () => grid.destroy();
}
