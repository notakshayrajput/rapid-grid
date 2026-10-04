const examples = [
  { id: 'typed', title: '10,000 rows, rich cells', tag: 'TYPED DATA', description: 'Ten columns with dropdowns, native date pickers, numeric editing, a sparkline renderer, and Boolean values.' },
  { id: 'column-merge', title: 'Column merging', tag: 'MERGE ENGINE', description: 'Adjacent repeated column headers share a header cell, while equal values merge vertically down a column.' },
  { id: 'cell-merge', title: 'Cell merging', tag: 'MERGE ENGINE', description: 'Equal neighboring values in a row become one wide cell. Scroll and select across merged spans.' },
  { id: 'row-drag', title: 'Row dragging', tag: 'INTERACTION', description: 'Drag a row header to reorder the underlying collection and observe the move event.' },
  { id: 'performance', title: 'Performance window', tag: 'VIRTUALIZATION', description: 'Navigate a logical 100,000 × 1,000 grid while the page shows how few DOM cells remain mounted.' },
  { id: 'selection', title: 'Selection & clipboard', tag: 'SPREADSHEET FEEL', description: 'Drag, Shift+Arrow, copy, and paste a rectangular region; use the public clipboard methods too.' },
  { id: 'column-drag', title: 'Column dragging', tag: 'INTERACTION', description: 'Reorder columns from their headers without changing the source objects.' },
  { id: 'sizing', title: 'Variable sizing', tag: 'LAYOUT', description: 'Change individual row heights and column widths while coordinate lookup stays indexed.' },
  { id: 'editing', title: 'Editing & validation', tag: 'DATA ENTRY', description: 'Use built-in Boolean and date-range editors, cancel invalid edits, and observe edit lifecycle events.' }
];

const list = document.querySelector('#example-list');
const host = document.querySelector('#demo-grid');
const controls = document.querySelector('#demo-controls');
const status = document.querySelector('#demo-status');
const code = document.querySelector('#demo-code');
const title = document.querySelector('#demo-title');
const description = document.querySelector('#demo-description');
const kicker = document.querySelector('#demo-kicker');
const copyButton = document.querySelector('#copy-code');
let cleanup = null;
let currentSource = '';
let generation = 0;

for (const [index, example] of examples.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'example-tab';
  button.id = `tab-${example.id}`;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', 'demo-grid');
  button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${example.title}`;
  button.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('example', example.id);
    url.hash = 'examples';
    history.pushState({ example: example.id }, '', url);
    activate(example.id);
  });
  list.appendChild(button);
}

function renderSource(source) {
  code.replaceChildren();
  for (const line of source.replace(/\s+$/, '').split('\n')) {
    const span = document.createElement('span');
    span.className = 'code-line';
    span.textContent = line || ' ';
    code.appendChild(span);
  }
}

async function activate(id) {
  const example = examples.find(item => item.id === id) || examples[0];
  const request = ++generation;
  if (cleanup) { cleanup(); cleanup = null; }
  host.replaceChildren();
  controls.replaceChildren();
  status.textContent = '';
  currentSource = '';
  code.textContent = 'Loading example…';
  title.textContent = example.title;
  description.textContent = example.description;
  kicker.textContent = example.tag;
  list.querySelectorAll('[role=tab]').forEach(button => {
    const selected = button.id === `tab-${example.id}`;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const path = `./examples/${example.id}.js`;
  try {
    const [module, response] = await Promise.all([import(path), fetch(path)]);
    if (!response.ok) throw new Error(`Source request failed (${response.status})`);
    const source = await response.text();
    if (request !== generation) return;
    currentSource = source;
    renderSource(source);
    cleanup = await module.mount({ host, controls, status });
  } catch (error) {
    if (request !== generation) return;
    host.textContent = 'Could not load the example.';
    status.textContent = 'Run “npm run site” from the package directory, then open the local server URL.';
    code.textContent = String(error);
  }
}

copyButton.addEventListener('click', async () => {
  if (!currentSource) return;
  try {
    await navigator.clipboard.writeText(currentSource);
    copyButton.textContent = 'Copied!';
    setTimeout(() => { copyButton.textContent = 'Copy code'; }, 1800);
  } catch { copyButton.textContent = 'Copy unavailable'; }
});

window.addEventListener('popstate', () => activate(new URLSearchParams(location.search).get('example')));
activate(new URLSearchParams(location.search).get('example'));
