import { isValidISODate, isValidMonthKey } from './dates.js';
import { badRequest } from './http.js';

export function requireInt(value, name, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`Invalid ${name}`);
  return n;
}

export function optionalInt(value, name, opts) {
  if (value === undefined || value === null || value === '') return null;
  return requireInt(value, name, opts);
}

export function requireDate(value, name = 'date') {
  if (!isValidISODate(value)) throw badRequest(`Invalid ${name} (expected YYYY-MM-DD)`);
  return value;
}

export function optionalDate(value, name) {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, name);
}

export function requireMonth(value, name = 'month') {
  if (!isValidMonthKey(value)) throw badRequest(`Invalid ${name} (expected YYYY-MM)`);
  return value;
}

export function requireString(value, name, { max = 200, min = 1 } = {}) {
  if (typeof value !== 'string') throw badRequest(`Invalid ${name}`);
  const s = value.trim();
  if (s.length < min || s.length > max) throw badRequest(`Invalid ${name}`);
  return s;
}

export function optionalString(value, { max = 200 } = {}) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > max) throw badRequest('Text is too long');
  return s;
}

export function requireArray(value, name, { max = 20_000 } = {}) {
  if (!Array.isArray(value)) throw badRequest(`Invalid ${name}`);
  if (value.length > max) throw badRequest(`Too many ${name}`);
  return value;
}

/** A mark between 0 and max, or null to clear it. Accepts "12,5". */
export function markValue(value, max, label = 'mark') {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) throw badRequest(`${label} must be between 0 and ${max}`);
  return Math.round(n * 100) / 100;
}
