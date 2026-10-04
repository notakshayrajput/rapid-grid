const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/site/' });
    response.end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { response.writeHead(400); response.end('Bad path'); return; }
  if (pathname === '/site/') pathname = '/site/index.html';
  if (!(pathname.startsWith('/site/') || pathname.startsWith('/dist/') || pathname === '/style.css')) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(content);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`rapid-grid showcase: http://127.0.0.1:${port}/site/`);
});
