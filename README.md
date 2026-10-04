# rapid-grid

A zero runtime dependency, framework agnostic, two-axis virtualized data grid for JavaScript and TypeScript. It renders visible rows and columns with a recycled DOM cell pool and works with plain JavaScript, React, Vue, Angular, Svelte, Web Components, and other frameworks through a plain DOM host.

## Install

```sh
npm install rapid-grid
```

```ts
import { RapidGrid, CellRange, DataType, SelectionMode } from 'rapid-grid';
import 'rapid-grid/style.css';

const grid = new RapidGrid('#grid', {
  items: Array.from({ length: 100_000 }, (_, id) => ({ id, name: `Item ${id}`, price: id / 10 })),
  columns: [
    { binding: 'id', width: 80, dataType: DataType.Number },
    { binding: 'name', width: 180 },
    { binding: 'price', width: 120, dataType: DataType.Number, format: 'c2' }
  ],
  selectionMode: SelectionMode.CellRange
});

grid.onSelectionChanged((_grid, event) => console.log(event.ranges));
grid.select(new CellRange(1, 1, 4, 2)); // UI rows 2–5, columns 2–3 (zero-based indices)
// Call grid.destroy() when the host component is removed.
```

```html
<div id="grid" style="height: 500px; width: 100%"></div>
```

The host **must have a height**. The grid adds its own positioned child and leaves other host children intact. Its layout works without the optional CSS import; the stylesheet adds visual styling.

### Plain JavaScript

Import the package from an ESM build tool, or load `dist/esm/index.js` from an installed package path. Use `require('rapid-grid')` in CommonJS. The grid uses only browser DOM APIs and does not depend on a component framework.

### Framework integration

Create the grid after the framework mounts the host element, update it with `grid.collectionView.setItems(items)`, and call `grid.destroy()` during cleanup. `onFormatItem` receives the recycled cell element. If a framework mounts components in cells, use `onCellRecycling` to unmount them when the grid releases that cell.

## API notes

- `rows.get(index).height` and `columns.get(index).width` provide variable sizes. Coordinate lookup uses binary search over prefix offsets. Size changes rebuild offsets lazily from the changed index.
- `SelectionMode.CellRange` is the default. Click a cell, then Shift-click, drag, or use Shift+Arrow keys to select a rectangle. Moving Shift+Arrow back toward the anchor shrinks the range. `Cell` keeps single-cell selection; `MultiRange` also allows Ctrl/Cmd-click to add disjoint ranges.
- Ctrl/Cmd+C copies the latest selected rectangle as tab-separated text. Ctrl/Cmd+V pastes at its top-left cell, parsing values according to column types. A single pasted value fills the whole selected rectangle. Read-only columns are skipped. `copySelection()` and `paste(text)` expose the same behavior to application code; `paste` returns the count of updated cells and throws on invalid data before changing any cells. Up to one million cells can be copied or pasted at a time.
- `scrollIntoView`, `getCell`, `getCellElement`, `hitTest`, `refresh`, `invalidate`, `autoSizeRow`, and `autoSizeColumn` are available on the grid.
- `onFormatItem`, `onCellRecycling`, `onBeginningEdit`, `onCellEditEnding`, `onCellEditEnded`, `onSelectionChanging`, `onSelectionChanged`, `onDraggedRow`, and `onDraggedColumn` return unsubscribe functions. Returning `false` or setting `event.cancel = true` cancels changing events.
- `allowMerging` controls body or header merging. Set `column.allowMerging` for vertical body merges and `row.allowMerging` for horizontal body merges. Header merges coalesce equal labels.
- `allowDragging` enables row and column moves from headers. Row moves mutate the supplied items array through `collectionView`.
- `DataType` supports string, number, date, time, date-time, date range, and Boolean. String formats include `upper` and `mask:###-##` (`#` consumes one input character). Number formats include `n2`, `c0`, and `p1`. Date formats include `yyyy`, `MM`, `dd`, `HH`, `hh`, `mm`, and `a`. Date range values use `{ start: Date, end: Date }`. A column can supply a custom `editor` DOM factory.
- `autoSizeRows` is off by default. When enabled, it measures currently rendered cells on animation frames outside fast scrolling. It can cost extra layout work for complex cell templates.
- `collectionView.sort(binding, direction, dataType)` sorts the mutable source array. Call `grid.refresh(true)` after mutating item values directly; `setValue` and `setItems` notify the grid automatically.

## Build and test

```sh
npm install
npm test
npm run bench
```

The benchmark exercises viewport lookup and cell window calculation against 100,000 rows and 1,000 columns and reports its 95th percentile against a 16.7 ms frame budget. It is a computation benchmark; actual browser FPS also depends on viewport size, custom renderers, CSS, and device hardware.
