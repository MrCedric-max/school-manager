// The official school calendar, published every year by joint order of the Minister of
// Basic Education (MINEDUB) and the Minister of Secondary Education (MINESEC).
//
// It is the backbone this app synchronises to: the terms, the breaks and the public
// holidays all follow the arrêté, and the school's own dates — the ones in the planner
// workbook — are laid on top of it as events.
//
// Each year's backbone is kept in `school_years.official` (JSON), so:
//   • the current year can be rebuilt at any time ("Apply the national calendar"),
//   • next year can be prepared in advance ("Roll over"), which copies every anchor to
//     the same week and weekday one year later, ready to be corrected when the new
//     arrêté is published,
//   • past years stay on file instead of being overwritten.
import { addDays, dayOfWeek, isValidISODate, monthKeyOf, parseISO, toISO } from './dates.js';

/** Day types and event categories the calendar understands. */
export const EVENT_CATEGORIES = ['official', 'break', 'holiday', 'exam', 'deadline', 'event'];

/**
 * The school runs two cycles and MINESEC gives the college its own dates, so an event
 * belongs either to the whole school (''), to the primary or to the college.
 */
export const EVENT_CYCLES = ['', 'primary', 'college'];
export function eventCycle(value) {
  const v = String(value ?? '').trim();
  return v === 'primary' || v === 'college' ? v : '';
}

/**
 * The 2026/2027 school year as published by the joint order of 14 August 2026
 * (n° 002/AC/MINEDUB/MINESEC) — rentrée 7 September 2026, end of year 30 July 2027.
 *
 * A term interrupted by a holiday keeps two segments: the arrêté splits Term 2 around
 * Christmas and Term 3 around Easter, and the days in between belong to the term
 * without being school days.
 */
export const BACKBONE_2026_2027 = {
  reference: 'Arrêté conjoint n° 002/AC/MINEDUB/MINESEC du 14 août 2026',
  yearStart: '2026-09-01',
  yearEnd: '2027-07-31',
  week1Start: '2026-09-07',
  anchors: {
    adminReturn: '2026-08-31',
    teacherReturn: '2026-09-02',
    pupilReturn: '2026-09-07',
    classesEnd: '2027-06-11',
    yearEnd: '2027-07-30',
  },
  terms: [
    { number: 1, name: 'Term 1', segments: [{ start: '2026-09-07', end: '2026-11-27' }] },
    {
      number: 2,
      name: 'Term 2',
      segments: [
        { start: '2026-11-30', end: '2026-12-18' },
        { start: '2027-01-04', end: '2027-03-05' },
      ],
    },
    {
      number: 3,
      name: 'Term 3',
      segments: [
        { start: '2027-03-08', end: '2027-03-25' },
        { start: '2027-04-12', end: '2027-06-11' },
      ],
    },
  ],
  breaks: [
    { name: 'Christmas holiday / Congés de Noël', start: '2026-12-18', end: '2027-01-04' },
    { name: 'Easter holiday / Congés de Pâques', start: '2027-03-25', end: '2027-04-12' },
  ],
  /**
   * The two cycles do not sit the same exams on the same days: MINESEC opens the official
   * secondary exams on 19 April (with mock exams and the practical PE papers just before),
   * while the primary's own exams start on 10 May. Each period says who it concerns.
   */
  exams: [
    { name: 'Mock exams, primary / Épreuves zéro (primaire)', start: '2027-04-14', end: '2027-04-17', cycle: 'primary' },
    { name: 'Mock exams, secondary / Examens blancs (secondaire)', start: '2027-04-14', end: '2027-04-17', cycle: 'college' },
    { name: 'Official exams, secondary / Examens officiels (secondaire)', start: '2027-04-19', end: '2027-07-30', cycle: 'college' },
    { name: 'Practical PE exams / Épreuves pratiques d’EPS', start: '2027-04-26', end: '2027-05-07', cycle: 'college' },
    { name: 'Internal evaluations, secondary / Évaluations internes (secondaire)', start: '2027-05-03', end: '2027-05-21', cycle: 'college' },
    { name: 'Official exams, primary / Examens officiels (primaire)', start: '2027-05-10', end: '2027-07-30', cycle: 'primary' },
  ],
  /**
   * Public holidays of the year.
   *
   * Most fall on the same date every year and are kept on that date when the year is
   * rolled over. The ones that follow Easter (or the lunar calendar) are marked
   * `movable` and move with their week instead — their dates are estimates until the
   * official list is published, and the school corrects them on the Calendar page.
   */
  holidays: [
    { date: '2026-11-01', name: 'All Saints’ Day / Toussaint' },
    { date: '2026-12-25', name: 'Christmas Day / Noël' },
    { date: '2027-01-01', name: 'New Year’s Day / Jour de l’an' },
    { date: '2027-02-11', name: 'Youth Day / Fête de la Jeunesse' },
    { date: '2027-03-10', name: 'Eid al-Fitr / Fête du Ramadan (est.)', movable: true },
    { date: '2027-03-26', name: 'Good Friday / Vendredi Saint', easter: -2 },
    { date: '2027-03-29', name: 'Easter Monday / Lundi de Pâques', easter: 1 },
    { date: '2027-05-01', name: 'Labour Day / Fête du Travail' },
    { date: '2027-05-06', name: 'Ascension Day / Ascension', easter: 39 },
    { date: '2027-05-16', name: 'Eid al-Adha / Fête du mouton (est.)', movable: true },
    { date: '2027-05-17', name: 'Whit Monday / Lundi de Pentecôte', easter: 50 },
    { date: '2027-05-20', name: 'National Day / Fête Nationale' },
  ],
};

/** Official backbones that ship with the app, by school-year label. */
const BUILT_IN = {
  '2026-2027': BACKBONE_2026_2027,
};

export function officialBackboneFor(label) {
  return BUILT_IN[String(label ?? '').trim()] ?? null;
}

/** "2026-2027" → "2027-2028" (accepts "2026/2027" and "2026-2027" alike). */
export function nextLabel(label) {
  const m = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(String(label ?? '').trim());
  if (!m) return null;
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
}

export function labelStartYear(label) {
  const m = /^(\d{4})/.exec(String(label ?? '').trim());
  return m ? Number(m[1]) : null;
}

// ---- Shifting a year forward --------------------------------------------------

const WEEK_MS = 7 * 86_400_000;

/** ISO week (1–53) and weekday (0 = Monday) of a date. */
export function isoWeekParts(iso) {
  const ms = parseISO(iso);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = ms + (3 - dow) * 86_400_000; // Thursday of the same week
  const year = new Date(thursday).getUTCFullYear();
  const firstThursday = Date.UTC(year, 0, 4);
  const firstDow = (new Date(firstThursday).getUTCDay() + 6) % 7;
  const week1Thursday = firstThursday + (3 - firstDow) * 86_400_000;
  return { year, week: Math.round((thursday - week1Thursday) / WEEK_MS) + 1, dow };
}

/** How many ISO weeks a year has: 52, or 53 when the year starts on a Thursday. */
export function weeksInYear(year) {
  return isoWeekParts(`${year}-12-28`).week;
}

/** The date with the same ISO week and weekday, in the given year (53 becomes 52). */
export function dateFromWeekParts(year, week, dow) {
  const firstThursday = Date.UTC(year, 0, 4);
  const firstDow = (new Date(firstThursday).getUTCDay() + 6) % 7;
  const mondayWeek1 = firstThursday + (3 - firstDow) * 86_400_000 - 3 * 86_400_000;
  const safeWeek = Math.min(Math.max(week, 1), weeksInYear(year));
  return toISO(mondayWeek1 + (safeWeek - 1) * WEEK_MS + dow * 86_400_000);
}

/**
 * The same day next year, keeping its place in the year: the same ISO week and the same
 * weekday. "The Monday the school year starts" stays the Monday the school year starts,
 * instead of drifting by one or two days as a plain +365 would.
 */
export function sameWeekdayNextYear(iso, years = 1) {
  if (!isValidISODate(iso)) return iso;
  const { week, dow } = isoWeekParts(iso);
  return dateFromWeekParts(Number(iso.slice(0, 4)) + years, week, dow);
}

/**
 * Easter Sunday of a year (Gregorian computus). Good Friday, Easter Monday, Ascension and
 * Whit Monday are all counted from it, so they are never guessed by shifting weeks: Easter
 * moves by up to five weeks from one year to the next.
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(Date.UTC(year, month - 1, day));
}

/**
 * A holiday that falls on the same date every year (Christmas, National Day…) keeps that
 * date; only the year changes. A school year straddles two calendar years, so the date can
 * belong to either half — the one inside the new school year wins.
 */
export function sameDateNextYear(iso, years, { start, end } = {}) {
  const [y, m, d] = iso.split('-');
  const candidates = [Number(y) + years, Number(y) + years + 1].map((year) => `${year}-${m}-${d}`);
  return candidates.find((c) => isValidISODate(c) && (!start || c >= start) && (!end || c <= end)) ?? candidates[0];
}

function shift(b, years = 1) {
  const yearStart = sameWeekdayNextYear(b.yearStart, years);
  const yearEnd = sameWeekdayNextYear(b.yearEnd, years);
  const move = (iso) => sameWeekdayNextYear(iso, years);
  return {
    ...b,
    reference: '',
    yearStart,
    yearEnd,
    week1Start: sameWeekdayNextYear(b.week1Start, years),
    anchors: mapDates(b.anchors ?? {}, move),
    terms: (b.terms ?? []).map((t) => ({
      ...t,
      segments: (t.segments ?? []).map((s) => ({ start: move(s.start), end: move(s.end) })),
    })),
    breaks: (b.breaks ?? []).map((r) => ({ ...r, start: move(r.start), end: move(r.end) })),
    exams: (b.exams ?? []).map((r) => ({ ...r, start: move(r.start), end: move(r.end) })),
    holidays: (b.holidays ?? [])
      .map((h) => ({ ...h, date: moveHoliday(h, years, { yearStart, yearEnd }) }))
      .sort((a, x) => a.date.localeCompare(x.date)),
  };
}

/**
 * How a holiday moves into the following year:
 *   • the Easter feasts are counted from Easter Sunday of that year,
 *   • the lunar feasts come back about eleven days earlier in the calendar each year — one
 *     lunar year (354 days) later, which keeps them in the same place in the school year
 *     (an estimate, as any list is until the official one is published),
 *   • everything else keeps its day of the month.
 */
function moveHoliday(h, years, { yearStart, yearEnd }) {
  if (Number.isFinite(h.easter)) {
    const easterYear = Number((yearEnd || '').slice(0, 4)) || Number((yearStart || '').slice(0, 4)) + 1;
    return addDays(easterSunday(easterYear), Number(h.easter));
  }
  if (h.movable) return addDays(h.date, Math.round(354 * years));
  return sameDateNextYear(h.date, years, { start: yearStart, end: yearEnd });
}

function mapDates(obj, fn) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'string' && v ? fn(v) : v;
  return out;
}

/**
 * Draft the following year from this one. Every anchor moves to the same week and
 * weekday twelve months on, so the draft is a sane starting point to correct once the
 * new arrêté is published — it is never applied on its own.
 */
export function rollOverBackbone(backbone, label) {
  const next = shift(backbone, 1);
  next.reference = '';
  return next;
}

// ---- Reading and checking -----------------------------------------------------

export function parseBackbone(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Shape-check a backbone coming from the browser. Returns { errors, value }. */
export function validateBackbone(input) {
  const errors = [];
  const b = input && typeof input === 'object' ? input : {};
  const date = (v, what) => {
    if (typeof v !== 'string' || !isValidISODate(v)) {
      errors.push(`${what} must be a date (YYYY-MM-DD)`);
      return null;
    }
    return v;
  };
  const range = (r, what) => {
    if (!r || typeof r !== 'object') return null;
    const start = date(r.start, `${what} start`);
    const end = date(r.end, `${what} end`);
    if (start && end && end < start) errors.push(`${what} ends before it starts`);
    if (!start || !end) return null;
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 120) : what;
    const out = { name, start, end };
    // Whether the period concerns the primary, the college or the whole school.
    if (r?.cycle === 'primary' || r?.cycle === 'college') out.cycle = r.cycle;
    return out;
  };
  const list = (arr, what) => (Array.isArray(arr) ? arr.map((r, i) => range(r, `${what} ${i + 1}`)).filter(Boolean) : []);

  const yearStart = date(b.yearStart, 'Start of the calendar');
  const yearEnd = date(b.yearEnd, 'End of the calendar');
  const week1Start = date(b.week1Start, 'Monday of week 1');
  if (yearStart && yearEnd && yearEnd <= yearStart) errors.push('The calendar must end after it starts');
  if (week1Start && yearStart && yearEnd && (week1Start < yearStart || week1Start > yearEnd)) {
    errors.push('Week 1 must start inside the school year');
  }
  if (week1Start && dayOfWeek(week1Start) !== 1) errors.push('Week 1 must start on a Monday');

  const anchors = {};
  for (const [key, label] of Object.entries({
    adminReturn: 'Administrative staff return',
    teacherReturn: 'Teachers return',
    pupilReturn: 'Pupils return',
    classesEnd: 'End of classes',
    yearEnd: 'End of the school year',
  })) {
    const v = date(b.anchors?.[key] ?? '', label);
    if (v) anchors[key] = v;
  }

  const terms = (Array.isArray(b.terms) ? b.terms : []).map((t, i) => {
    const number = Number(t?.number ?? i + 1);
    const segments = (Array.isArray(t?.segments) ? t.segments : [])
      .map((s, j) => range(s, `Term ${number} part ${j + 1}`))
      .filter(Boolean)
      .sort((a, x) => a.start.localeCompare(x.start));
    if (!segments.length) errors.push(`Term ${number} needs at least one part`);
    return {
      number,
      name: String(t?.name ?? `Term ${number}`).slice(0, 40),
      segments,
    };
  });
  if (!terms.length) errors.push('At least one term is required');
  for (let i = 1; i < terms.length; i += 1) {
    const prevEnd = terms[i - 1].segments.at(-1)?.end;
    const start = terms[i].segments[0]?.start;
    if (prevEnd && start && start <= prevEnd) errors.push(`Term ${terms[i].number} starts before term ${terms[i - 1].number} ends`);
  }

  const holidays = (Array.isArray(b.holidays) ? b.holidays : []).map((h, i) => {
    const d = date(h?.date, `Public holiday ${i + 1}`);
    if (!d) return null;
    const name = String(h?.name ?? 'Public holiday').trim().slice(0, 120) || 'Public holiday';
    // How the date moves next year is kept with it: without `easter` an Easter feast would
    // be shifted by week like a fixed date, and drift away from Easter.
    const out = { date: d, name };
    if (h?.movable) out.movable = true;
    const offset = Number(h?.easter);
    if (Number.isInteger(offset) && offset >= -60 && offset <= 60) out.easter = offset;
    return out;
  }).filter(Boolean);

  const value = {
    reference: String(b.reference ?? '').slice(0, 200),
    yearStart: yearStart ?? '',
    yearEnd: yearEnd ?? '',
    week1Start: week1Start ?? '',
    anchors,
    terms,
    breaks: list(b.breaks, 'Break'),
    exams: list(b.exams, 'Exam period'),
    holidays,
  };
  return { errors, value };
}

// ---- Turning a backbone into rows ---------------------------------------------

function dateSet(holidays) {
  return new Set(holidays.map((h) => h.date));
}

/** True when `iso` falls inside one of the ranges. */
export function inRanges(iso, ranges) {
  return (ranges ?? []).some((r) => iso >= r.start && iso <= r.end);
}

export function isSchoolDay(iso, { holidayDates, breaks }) {
  const dow = dayOfWeek(iso);
  if (dow === 0 || dow === 6) return false;
  if (holidayDates.has(iso)) return false;
  if (inRanges(iso, breaks)) return false;
  return true;
}

/**
 * School days of every month between `from` and `to`, as { '2026-09': 18, … }.
 * Used to pick the three months that feed a term's report card (UA1–UA3).
 */
export function schoolDaysPerMonth({ from, to, holidays = [], breaks = [] }) {
  const holidayDates = dateSet(holidays);
  const out = new Map();
  if (!from || !to || from > to) return out;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isSchoolDay(d, { holidayDates, breaks })) continue;
    const key = monthKeyOf(d);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** The up to three months with the most school days in a term, in calendar order. */
export function uaMonthsForTerm(term, { holidays, breaks }) {
  const segments = term.segments ?? [];
  if (!segments.length) return [];
  const perMonth = schoolDaysPerMonth({
    from: segments[0].start,
    to: segments.at(-1).end,
    holidays,
    breaks,
  });
  return [...perMonth.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([key]) => key)
    .sort();
}

/**
 * Everything the backbone writes into the database: the terms, the public holidays and
 * the official events (anchors, breaks and exam periods).
 */
export function planBackbone(backbone) {
  const holidays = backbone.holidays ?? [];
  const breaks = backbone.breaks ?? [];
  const terms = (backbone.terms ?? []).map((t) => ({
    number: t.number,
    name: t.name,
    start: t.segments[0].start,
    end: t.segments.at(-1).end,
    segments: t.segments,
    uaMonths: uaMonthsForTerm(t, { holidays, breaks }),
    schoolDays: 0,
  }));

  for (const t of terms) {
    let n = 0;
    for (const seg of t.segments) {
      for (let d = seg.start; d <= seg.end; d = addDays(d, 1)) {
        if (isSchoolDay(d, { holidayDates: dateSet(holidays), breaks })) n += 1;
      }
    }
    t.schoolDays = n;
  }

  const a = backbone.anchors ?? {};
  const anchorEvents = [
    ['adminReturn', 'Administrative staff return / Rentrée du personnel administratif'],
    ['teacherReturn', 'Teachers return / Rentrée des enseignants'],
    ['pupilReturn', 'School year begins · pupils return / Rentrée scolaire des élèves'],
    ['classesEnd', 'End of ordinary classes / Fin des cours'],
    ['yearEnd', 'End of the school year / Fin de l’année scolaire'],
  ]
    .filter(([key]) => a[key])
    .map(([key, title]) => ({ date: a[key], end_date: null, title, category: 'official' }));

  const events = [
    ...anchorEvents,
    ...breaks.map((r) => ({ date: r.start, end_date: r.end, title: r.name, category: 'break' })),
    ...(backbone.exams ?? []).map((r) => ({
      date: r.start,
      end_date: r.end,
      title: r.name,
      category: 'exam',
      cycle: r.cycle === 'primary' || r.cycle === 'college' ? r.cycle : '',
    })),
  ];

  return { terms, holidays, events };
}
