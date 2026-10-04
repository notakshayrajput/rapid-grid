const fs = require('node:fs');
fs.writeFileSync('dist/esm/package.json', '{"type":"module"}\n');
fs.writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
