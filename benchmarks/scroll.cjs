const { performance } = require('node:perf_hooks');
const { PrefixSum } = require('../dist/cjs/index.js');
const rows = new PrefixSum(100_000, 32);
const cols = new PrefixSum(1_000, 120);
const samples = [];
let checksum = 0;
for (let frame = 0; frame < 2_000; frame++) {
  const y = (frame * 2137) % (rows.total - 600);
  const x = (frame * 331) % (cols.total - 1000);
  const start = performance.now();
  const r0 = rows.indexAt(y), r1 = rows.indexAt(y + 600);
  const c0 = cols.indexAt(x), c1 = cols.indexAt(x + 1000);
  for (let r = Math.max(0, r0 - 5); r <= Math.min(rows.count - 1, r1 + 5); r++) {
    for (let c = Math.max(0, c0 - 2); c <= Math.min(cols.count - 1, c1 + 2); c++) {
      checksum += rows.offset(r) + cols.offset(c);
    }
  }
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * .95)];
console.log(JSON.stringify({ rows: rows.count, columns: cols.count, frames: samples.length,
  medianMs: Number(samples[1000].toFixed(3)), p95Ms: Number(p95.toFixed(3)),
  targetMs: 16.7, targetMet: p95 < 16.7, checksum }, null, 2));
if (p95 >= 16.7) process.exitCode = 1;
