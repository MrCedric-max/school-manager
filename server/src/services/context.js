import { buildCalendar, describeDay, latestSchoolDay } from '../lib/calendar.js';
import { cycleOf } from '../lib/cycles.js';
import { todayInTimezone } from '../lib/dates.js';

export function readSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let cotes;
  try {
    cotes = JSON.parse(s.cotes || '[]');
  } catch {
    cotes = [];
  }
  cotes.sort((a, b) => b.min - a.min);
  return {
    schoolName: s.school_name ?? '',
    schoolSubtitle: s.school_subtitle ?? '',
    academicYear: s.academic_year ?? '',
    yearStart: s.year_start,
    yearEnd: s.year_end,
    week1Start: s.week1_start,
    timezone: s.timezone || 'Africa/Douala',
    academicWeight: Number(s.academic_weight ?? 0.7),
    cotes,
    demoMode: s.demo_mode === '1',
    logo: s.logo || '',
  };
}

export function readTerms(db) {
  return db
    .prepare('SELECT number, name, start_date, end_date, ua_months FROM terms ORDER BY number')
    .all()
    .map((t) => ({ ...t, ua_months: safeJsonArray(t.ua_months) }));
}

function safeJsonArray(value) {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Holiday periods of the national calendar (Christmas, Easter). They are events written
 * by the national sync — the school's own events never take days off the calendar.
 */
export function readBreaks(db) {
  return db
    .prepare(
      `SELECT date AS start, COALESCE(end_date, date) AS end, title AS name
         FROM events WHERE category = 'break' AND source = 'national' ORDER BY date`,
    )
    .all();
}

export function readFramework(db) {
  const competences = db.prepare('SELECT * FROM competences ORDER BY number').all();
  const disciplines = db
    .prepare('SELECT * FROM disciplines ORDER BY sort_order, code')
    .all()
    .map((d) => ({ ...d, on_monthly_card: Boolean(d.on_monthly_card) }));
  const attitudes = db.prepare('SELECT * FROM attitudes ORDER BY sort_order').all();
  const subjects = db.prepare('SELECT * FROM control_subjects ORDER BY sort_order').all();
  const areas = db.prepare('SELECT * FROM performance_areas ORDER BY sort_order').all();

  const competenceMax = (number, monthlyOnly) =>
    disciplines
      .filter((d) => d.competence === number && (!monthlyOnly || d.on_monthly_card))
      .reduce((a, d) => a + d.max, 0);

  const withMax = competences.map((c) => ({
    ...c,
    max: competenceMax(c.number, false),
    monthlyMax: competenceMax(c.number, true),
  }));
  const monthlyDisciplines = disciplines.filter((d) => d.on_monthly_card);
  return {
    competences: withMax,
    disciplines,
    monthlyDisciplines,
    attitudes,
    subjects,
    areas,
    totalMax: disciplines.reduce((a, d) => a + d.max, 0),
    monthlyMax: monthlyDisciplines.reduce((a, d) => a + d.max, 0),
  };
}

export function readClasses(db) {
  return db
    .prepare(
      `SELECT c.id, c.name, c.code, c.sort_order, c.cycle,
              (SELECT COUNT(*) FROM pupils p WHERE p.class_id = c.id AND p.status = 'Active') AS enrolled,
              (SELECT COUNT(*) FROM pupils p WHERE p.class_id = c.id) AS registered
         FROM classes c ORDER BY c.sort_order, c.name`,
    )
    .all()
    // An empty cycle means "not looked at yet": the level decides which cycle the class is
    // evaluated in, and the school can move one over in Settings.
    .map((c) => ({ ...c, cycle: cycleOf(c) }));
}

/**
 * Everything most computations need: settings, framework, classes and the
 * calendar built from the terms and holidays.
 */
export function loadContext(db, { today } = {}) {
  const settings = readSettings(db);
  const terms = readTerms(db);
  const holidays = db.prepare('SELECT date, name FROM holidays ORDER BY date').all();
  const breaks = readBreaks(db);
  const calendar = buildCalendar({
    yearStart: settings.yearStart,
    yearEnd: settings.yearEnd,
    week1Start: settings.week1Start,
    terms,
    holidays,
    breaks,
  });
  const framework = readFramework(db);
  const todayIso = today || process.env.SCHOOL_TODAY || todayInTimezone(settings.timezone);
  const todayInfo = describeDay(calendar, todayIso);
  return {
    settings,
    terms,
    holidays,
    breaks,
    calendar,
    framework,
    today: todayInfo,
    lastSchoolDay: latestSchoolDay(calendar, todayIso),
  };
}

export function findMonth(ctx, key) {
  return ctx.calendar.months.find((m) => m.key === key) ?? null;
}

export function findWeek(ctx, number) {
  return ctx.calendar.weeks.find((w) => w.number === number) ?? null;
}

export function findTerm(ctx, number) {
  return ctx.calendar.terms.find((t) => t.number === number) ?? null;
}

/** Default selections matching "today" (current week, month and term). */
export function currentSelections(ctx) {
  const { calendar, today } = ctx;
  const weeks = calendar.weeks;
  let week = today.week ?? null;
  if (!week || week > weeks.length) week = today.date < (weeks[0]?.monday ?? '') ? 1 : weeks.length || 1;
  const month =
    calendar.months.find((m) => m.key === today.month)?.key ??
    (today.date < (calendar.months[0]?.firstDay ?? '') ? calendar.months[0]?.key : calendar.months.at(-1)?.key) ??
    null;
  let term = today.term;
  if (!term) {
    const upcoming = calendar.terms.find((t) => t.end >= today.date);
    term = upcoming?.number ?? calendar.terms.at(-1)?.number ?? null;
  }
  const uaMonth =
    calendar.months.find((m) => m.key === month && m.uaTerm)?.key ??
    calendar.terms.find((t) => t.number === term)?.uaMonths[0] ??
    null;
  return { week, month, term, uaMonth, date: ctx.lastSchoolDay };
}
