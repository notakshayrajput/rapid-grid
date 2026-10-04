const test = require('node:test');
const assert = require('node:assert/strict');
const { PrefixSum, CellRange, CollectionView, RowCollection, ColumnCollection, MergeManager,
  DataType, AllowMerging, formatValue, parseValue, parseTsv, serializeTsv } = require('../dist/cjs/index.js');
const { localDateInputValue, parseLocalDateInput } = require('../dist/cjs/formatters/localDate.js');

test('prefix sums locate variable-sized cells at exact boundaries', () => {
  const sizes = new PrefixSum(4, 10);
  sizes.set(1, 25);
  sizes.set(3, 5);
  assert.equal(sizes.total, 50);
  assert.equal(sizes.range(1, 3), 35);
  assert.deepEqual([0, 9, 10, 34, 35, 44, 45, 50].map(x => sizes.indexAt(x)), [0, 0, 1, 1, 2, 2, 3, 3]);
  sizes.move(1, 3);
  assert.equal(sizes.get(3), 25);
  assert.equal(sizes.total, 50);
});

test('cell ranges include and intersect their boundaries', () => {
  const range = new CellRange(5, 6, 2, 3);
  assert.equal(range.contains(2, 3), true);
  assert.equal(range.contains(5, 6), true);
  assert.equal(range.contains(6, 6), false);
  assert.equal(range.intersects(new CellRange(5, 6, 7, 8)), true);
  assert.equal(range.intersects(new CellRange(6, 6, 7, 8)), false);
  assert.equal(new CellRange(-1, 0).isValid, false);
});

test('collection edits, reorders and typed sorts retain mutable items', () => {
  const items = [{ n: 10 }, { n: 2 }, { n: 5 }];
  const view = new CollectionView(items);
  let notifications = 0;
  view.onChange(() => notifications++);
  view.sort('n', 'asc', DataType.Number);
  assert.deepEqual(items.map(x => x.n), [2, 5, 10]);
  view.move(0, 2);
  assert.deepEqual(items.map(x => x.n), [5, 10, 2]);
  view.setValue(0, 'n', 7);
  assert.equal(items[0].n, 7);
  assert.equal(notifications, 3);
});

test('number formatting and locale parsing', () => {
  const cols = new ColumnCollection([{ binding: 'value', dataType: DataType.Number, format: 'n2' }], 100, () => {});
  const col = cols.get(0);
  assert.equal(formatValue(1234.56, col, 'en-US'), '1,234.56');
  assert.equal(parseValue('1,234.56', col, 'en-US'), 1234.56);
});

test('date inputs round-trip local calendar days and reject invalid dates', () => {
  const start = new Date(2026, 0, 1);
  assert.equal(localDateInputValue(start), '2026-01-01');
  const parsed = parseLocalDateInput('2026-01-01');
  assert.deepEqual([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()], [2026, 0, 1]);
  const columns = new ColumnCollection([{ binding: 'date', dataType: DataType.Date }], 100, () => {});
  assert.equal(formatValue(parseValue('2026-01-01', columns.get(0)), columns.get(0)), '2026-01-01');
  assert.throws(() => parseLocalDateInput('2026-02-30'), /Invalid date/);
});

test('merging preserves a shared origin across rows and columns', () => {
  const view = new CollectionView([{ a: 'same', b: 'same' }, { a: 'same', b: 'same' }, { a: 'other', b: 'other' }]);
  const rows = new RowCollection(3, 32, () => {});
  rows.get(0).allowMerging = true;
  rows.get(1).allowMerging = true;
  const cols = new ColumnCollection([
    { binding: 'a', allowMerging: true }, { binding: 'b', allowMerging: true }
  ], 120, () => {});
  const merger = new MergeManager(view, rows, cols,
    (row, col) => String(view.at(row)[cols.get(col).binding]), () => AllowMerging.Cells);
  assert.deepEqual(merger.getCellRange(1, 1), new CellRange(0, 0, 1, 1));
  assert.deepEqual(merger.getCellRange(0, 0), new CellRange(0, 0, 1, 1));
  assert.deepEqual(merger.getCellRange(2, 0), new CellRange(2, 0));
});

test('clipboard text round-trips quoted tabs, line breaks and quotes', () => {
  const values = [['plain', 'tab\there'], ['line\nbreak', 'a "quote"']];
  assert.deepEqual(parseTsv(serializeTsv(values) + '\r\n'), values);
  assert.deepEqual(parseTsv('one\ttwo\nthree\tfour'), [['one', 'two'], ['three', 'four']]);
});

test('batch paste mutations notify collection listeners once', () => {
  const items = [{ a: 'old', n: 1 }, { a: 'old', n: 2 }];
  const view = new CollectionView(items);
  let notifications = 0;
  view.onChange(() => notifications++);
  view.setValues([{ index: 0, binding: 'a', value: 'new' }, { index: 1, binding: 'n', value: 3 }]);
  assert.deepEqual(items, [{ a: 'new', n: 1 }, { a: 'old', n: 3 }]);
  assert.equal(notifications, 1);
});
