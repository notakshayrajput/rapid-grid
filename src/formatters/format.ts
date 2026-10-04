import { Column } from '../collections/ColumnCollection.js';
import { DataType, DateRangeValue } from '../types.js';
import { parseLocalDateInput } from './localDate.js';

function pad(value: number, width = 2): string { return String(value).padStart(width, '0'); }
function dateTokens(value: Date, pattern: string): string {
  return pattern.replace(/yyyy|MM|dd|HH|hh|mm|ss|a/g, token => {
    switch (token) {
      case 'yyyy': return pad(value.getFullYear(), 4);
      case 'MM': return pad(value.getMonth() + 1);
      case 'dd': return pad(value.getDate());
      case 'HH': return pad(value.getHours());
      case 'hh': return pad(value.getHours() % 12 || 12);
      case 'mm': return pad(value.getMinutes());
      case 'ss': return pad(value.getSeconds());
      default: return value.getHours() < 12 ? 'AM' : 'PM';
    }
  });
}
function asDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function formatValue(value: unknown, column: Column, locale?: string): string {
  if (value === null || value === undefined) return '';
  const format = column.format;
  switch (column.dataType) {
    case DataType.Number: {
      const number = Number(value);
      if (!Number.isFinite(number)) return '';
      const match = /^([ncp])(\d+)?$/i.exec(format || '');
      if (!match) return new Intl.NumberFormat(locale).format(number);
      const digits = match[2] === undefined ? 2 : Number(match[2]);
      const style = match[1].toLowerCase();
      return new Intl.NumberFormat(locale, {
        style: style === 'c' ? 'currency' : style === 'p' ? 'percent' : 'decimal',
        currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits
      }).format(number);
    }
    case DataType.Date:
    case DataType.Time:
    case DataType.DateTime: {
      const date = asDate(value);
      return date ? dateTokens(date, format || (column.dataType === DataType.Date ? 'yyyy-MM-dd' : column.dataType === DataType.Time ? 'HH:mm' : 'yyyy-MM-dd HH:mm')) : '';
    }
    case DataType.DateRange: {
      const range = value as DateRangeValue;
      const start = asDate(range.start), end = asDate(range.end);
      const parts = (format || 'yyyy-MM-dd ~ yyyy-MM-dd').split('~');
      return start && end ? dateTokens(start, parts[0].trim()) + ' ~ ' + dateTokens(end, (parts[1] || parts[0]).trim()) : '';
    }
    case DataType.Boolean: return Boolean(value) ? '✓' : '';
    default: {
      const string = String(value);
      if (format === 'upper') return string.toUpperCase();
      if (format && format.startsWith('mask:')) {
        let index = 0;
        return format.slice(5).replace(/#/g, () => string[index++] || '_');
      }
      return string;
    }
  }
}

export function parseValue(text: string, column: Column, locale?: string): unknown {
  if (text === '' && column.dataType !== DataType.String) return column.dataType === DataType.Boolean ? false : null;
  switch (column.dataType) {
    case DataType.Number: {
      const parts = (new Intl.NumberFormat(locale) as Intl.NumberFormat & { formatToParts(value: number): Array<{ type: string; value: string }> }).formatToParts(12345.6);
      const group = parts.find((part: { type: string; value: string }) => part.type === 'group');
      const decimal = parts.find((part: { type: string; value: string }) => part.type === 'decimal');
      let normalized = text.trim();
      if (group) normalized = normalized.split(group.value).join('');
      if (decimal) normalized = normalized.replace(decimal.value, '.');
      normalized = normalized.replace(/[^\d.+-]/g, '');
      const value = Number(normalized);
      if (!normalized || !Number.isFinite(value)) throw new Error('Invalid number');
      return column.format && column.format.toLowerCase().startsWith('p') && text.includes('%') ? value / 100 : value;
    }
    case DataType.Date:
    case DataType.DateTime:
    case DataType.Time: {
      const date = column.dataType === DataType.Date ? parseLocalDateInput(text) :
        column.dataType === DataType.Time ? new Date('1970-01-01T' + text) : new Date(text);
      if (Number.isNaN(date.getTime())) throw new Error('Invalid date or time');
      return date;
    }
    case DataType.DateRange: {
      const parts = text.split('~');
      if (parts.length !== 2) throw new Error('Invalid date range');
      const start = parseLocalDateInput(parts[0]), end = parseLocalDateInput(parts[1]);
      if (start > end) throw new Error('Invalid date range');
      return { start, end } as DateRangeValue;
    }
    case DataType.Boolean: {
      const value = text.trim().toLowerCase();
      if (value === 'true' || value === '1' || value === 'on' || value === 'yes' || value === '✓') return true;
      if (value === 'false' || value === '0' || value === 'off' || value === 'no') return false;
      throw new Error('Invalid Boolean');
    }
    default: return text;
  }
}
