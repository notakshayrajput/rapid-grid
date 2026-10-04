import { RapidGrid, DataType } from '../../dist/esm/index.js';

const teams = ['Product', 'Engineering', 'Design', 'Operations'];
const states = ['Active', 'Planning', 'Review', 'Paused'];
const owners = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Taylor', 'Casey'];

function dropdown(choices) {
  return value => {
    const select = document.createElement('select');
    select.className = 'ig-editor';
    for (const choice of choices) select.add(new Option(choice, choice));
    select.value = String(value ?? '');
    return select;
  };
}

function numberEditor(value) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.01';
  input.className = 'ig-editor';
  input.value = String(value ?? '');
  return input;
}

function sparkline(values) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 24');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Eight-period trend');
  const line = document.createElementNS(svg.namespaceURI, 'polyline');
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max - min);
  line.setAttribute('points', values.map((value, index) => `${index * 100 / (values.length - 1)},${21 - (value - min) * 18 / span}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', values.at(-1) >= values[0] ? '#249b6b' : '#d67a62');
  line.setAttribute('stroke-width', '2.3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);
  return svg;
}

export function mount({ host, controls, status }) {
  const items = Array.from({ length: 10_000 }, (_, index) => ({
    id: index + 1,
    account: `Account ${String(index + 1).padStart(5, '0')}`,
    owner: owners[index % owners.length],
    team: teams[index % teams.length],
    state: states[Math.floor(index / 3) % states.length],
    opened: new Date(2025, index % 12, index % 27 + 1),
    review: new Date(2026, index % 12, index % 27 + 1),
    amount: Math.round((1250 + index * 3.17) * 100) / 100,
    trend: Array.from({ length: 8 }, (_, point) => 20 + Math.sin((index + point) * .72) * 7 + point * ((index % 3) - 1)),
    active: index % 5 !== 0
  }));
  const grid = new RapidGrid(host, {
    items,
    rowHeight: 36,
    columns: [
      { binding: 'id', header: 'ID', width: 72, dataType: DataType.Number, readOnly: true },
      { binding: 'account', header: 'Account', width: 158 },
      { binding: 'owner', header: 'Owner', width: 100 },
      { binding: 'team', header: 'Team ↕', width: 130, editor: dropdown(teams) },
      { binding: 'state', header: 'Status ↕', width: 118, editor: dropdown(states) },
      { binding: 'opened', header: 'Opened 📅', width: 125, dataType: DataType.Date },
      { binding: 'review', header: 'Review 📅', width: 125, dataType: DataType.Date },
      { binding: 'amount', header: 'Amount #', width: 118, dataType: DataType.Number, format: 'n2', editor: numberEditor },
      { binding: 'trend', header: 'Trend', width: 104, readOnly: true },
      { binding: 'active', header: 'Active', width: 76, dataType: DataType.Boolean }
    ]
  });
  grid.onFormatItem((_grid, event) => {
    if (event.panel !== grid.cells || event.col !== 8 || !event.dataItem) return;
    event.cellElement.replaceChildren(sparkline(event.dataItem.trend));
  });
  grid.refresh(true);
  status.textContent = '10,000 rows · 10 columns · double-click a typed cell to edit';
  const jump = document.createElement('button');
  jump.textContent = 'Jump to row 7,500';
  jump.addEventListener('click', () => grid.scrollIntoView(7499, 0));
  controls.appendChild(jump);
  return () => grid.destroy();
}
