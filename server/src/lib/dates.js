// Date helpers working on ISO calendar dates ("YYYY-MM-DD") in UTC,
// so that results never depend on the server's local timezone.

const DAY_MS = 86_400_000;

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toISO(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return toISO(parseISO(iso) + n * DAY_MS);
}

export function diffDays(fromIso, toIso) {
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(iso) {
  return new Date(parseISO(iso)).getUTCDay();
}

export function isWeekend(iso) {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = parseISO(value);
  return !Number.isNaN(ms) && toISO(ms) === value;
}

export function isValidMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthKeyOf(iso) {
  return iso.slice(0, 7);
}

export function firstOfMonth(monthKey) {
  return `${monthKey}-01`;
}

export function lastOfMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return toISO(Date.UTC(y, m, 0));
}

export function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Today's date in the given IANA timezone, as "YYYY-MM-DD". */
export function todayInTimezone(timeZone = 'Africa/Douala', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
};

export const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
};

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Map an English or French month name ("October", "octobre", "Oct") to 1–12. */
export function monthNumberFromName(name) {
  if (!name) return null;
  const n = stripAccents(String(name).trim().toLowerCase());
  for (let i = 0; i < 12; i += 1) {
    const en = MONTH_NAMES.en[i].toLowerCase();
    const fr = stripAccents(MONTH_NAMES.fr[i].toLowerCase());
    if (n === en || n === fr) return i + 1;
  }
  for (let i = 0; i < 12; i += 1) {
    const en = MONTH_NAMES.en[i].toLowerCase();
    const fr = stripAccents(MONTH_NAMES.fr[i].toLowerCase());
    if (n.length >= 3 && (en.startsWith(n) || fr.startsWith(n) || n.startsWith(en.slice(0, 3)))) return i + 1;
  }
  return null;
}
