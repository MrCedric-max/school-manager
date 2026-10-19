import type { Cote, Lang, MonthInfo } from './types';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-GB');

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Fixed decimals: 15,33 (fr) / 15.33 (en). Dash when empty. */
export function fmtNum(v: number | null | undefined, lang: Lang, digits = 2) {
  if (!isNum(v)) return '–';
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

/** Marks: integers stay integers (14), decimals keep up to 2 digits (14,5). */
export function fmtMark(v: number | null | undefined, lang: Lang) {
  if (!isNum(v)) return '';
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 }).format(v);
}

export function fmtPct(v: number | null | undefined, lang: Lang, digits = 0) {
  if (!isNum(v)) return '–';
  return new Intl.NumberFormat(locale(lang), { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function fmtDate(iso: string | null | undefined, lang: Lang, style: 'short' | 'long' | 'day' | 'numeric' = 'short') {
  if (!iso) return '–';
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'day'
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : style === 'numeric'
          ? { day: '2-digit', month: '2-digit', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale(lang), { ...opts, timeZone: 'UTC' }).format(toDate(iso));
}

export function weekdayShort(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' }).format(toDate(iso));
}

export function dayMonth(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(toDate(iso));
}

export function monthLabel(m: Pick<MonthInfo, 'name_en' | 'name_fr' | 'year'> | undefined, lang: Lang, withYear = true) {
  if (!m) return '–';
  const name = lang === 'fr' ? m.name_fr : m.name_en;
  return withYear ? `${name} ${m.year}` : name;
}

export function mean(values: Array<number | null | undefined>) {
  const nums = values.filter(isNum);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function sumOrNull(values: Array<number | null | undefined>) {
  const nums = values.filter(isNum);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

/**
 * One label in the two languages of the school, as the printed cards show it: the two
 * sides are joined by a slash, and a word that is the same in both is printed once
 * ("Religion", "Sport", "Coef.").
 */
export function both(a: string | null | undefined, b: string | null | undefined): string {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  if (!x) return y;
  if (!y) return x;
  return x.toLowerCase() === y.toLowerCase() ? x : `${x} / ${y}`;
}

export function coteFor(pct: number | null | undefined, cotes: Cote[]) {
  if (!isNum(pct)) return null;
  for (const c of cotes) if (pct >= c.min - 1e-9) return c.code;
  return cotes[cotes.length - 1]?.code ?? null;
}

export function coteMeaning(code: string | null | undefined, cotes: Cote[], lang: Lang | 'both' = 'both') {
  const c = cotes.find((x) => x.code === code);
  if (!c) return '';
  if (lang === 'both') return `${c.en} / ${c.fr}`;
  return lang === 'fr' ? c.fr : c.en;
}

export function coteBadgeClass(code: string | null | undefined) {
  switch (code) {
    case 'A+':
      return 'bg-school-600 text-white';
    case 'A':
      return 'bg-school-100 text-school-800';
    case 'ECA/B':
      return 'bg-amber-100 text-amber-800';
    case 'NA':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

export const MARK_STYLES: Record<string, string> = {
  P: 'bg-school-100 text-school-800 border-school-200',
  A: 'bg-red-100 text-red-700 border-red-200',
  L: 'bg-amber-100 text-amber-800 border-amber-200',
  // Present carries the school colour, so excused stays neutral grey instead of a second blue.
  E: 'bg-slate-100 text-slate-700 border-slate-200',
};

/** Parse a typed mark: "12,5" → 12.5; '' → null; NaN when invalid. */
export function parseMarkInput(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function rankLabel(rank: number | null | undefined, of: number, lang: Lang) {
  if (!isNum(rank)) return '–';
  const suffix = lang === 'fr' ? (rank === 1 ? 'er' : 'e') : rank % 10 === 1 && rank % 100 !== 11 ? 'st' : rank % 10 === 2 && rank % 100 !== 12 ? 'nd' : rank % 10 === 3 && rank % 100 !== 13 ? 'rd' : 'th';
  return `${rank}${suffix} / ${of}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}
