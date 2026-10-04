export function serializeTsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(value => /[\t\r\n"]/.test(value)
    ? `"${value.replace(/"/g, '""')}"` : value).join('\t')).join('\r\n');
}

export function parseTsv(text: string): string[][] {
  if (!text) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value === '') quoted = !quoted;
      else value += char;
    } else if (!quoted && char === '\t') {
      row.push(value); value = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      row.push(value); rows.push(row); row = []; value = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else value += char;
  }
  if (quoted) throw new Error('Unclosed quoted cell in clipboard data');
  if (row.length || value !== '' || !/[\r\n]$/.test(text)) { row.push(value); rows.push(row); }
  return rows;
}
