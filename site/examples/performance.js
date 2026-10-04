import { RapidGrid, DataType } from '../../dist/esm/index.js';

export function mount({ host, controls, status }) {
  // A shared prototype computes values on demand, avoiding 100 million stored fields.
  const virtualFields = new Proxy({}, {
    get(_target, key, receiver) {
      if (typeof key === 'string' && /^c\d+$/.test(key)) return `${receiver.index}:${key.slice(1)}`;
      return undefined;
    }
  });
  const items = Array.from({ length: 100_000 }, (_, index) => {
    const item = Object.create(virtualFields);
    item.index = index;
    return item;
  });
  const columns = [
    { binding: 'index', header: 'Row ID', width: 105, dataType: DataType.Number, readOnly: true },
    ...Array.from({ length: 999 }, (_, index) => ({ binding: `c${index + 1}`, header: `Field ${index + 1}`, width: 100, readOnly: true }))
  ];
  const grid = new RapidGrid(host, { items, columns, rowHeight: 30 });
  const viewport = host.querySelector('.ig-viewport');
  let frame = 0;
  function report() {
    frame = 0;
    const mounted = [...host.querySelectorAll('.ig-cell')].filter(cell => cell.style.display !== 'none').length;
    const row = grid.rows.sizes.indexAt(viewport.scrollTop) + 1;
    const col = grid.columns.sizes.indexAt(viewport.scrollLeft) + 1;
    status.innerHTML = `<strong>${mounted}</strong> mounted cells / 100,000,000 logical · row ${row.toLocaleString()} · column ${col.toLocaleString()}`;
  }
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(report); };
  viewport.addEventListener('scroll', onScroll, { passive: true });
  const middle = document.createElement('button');
  middle.textContent = 'Jump to middle';
  middle.addEventListener('click', () => { grid.scrollIntoView(49_999, 499); report(); });
  const end = document.createElement('button');
  end.textContent = 'Jump to last cell';
  end.addEventListener('click', () => { grid.scrollIntoView(99_999, 999); report(); });
  controls.append(middle, end);
  report();
  return () => { viewport.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); grid.destroy(); };
}
