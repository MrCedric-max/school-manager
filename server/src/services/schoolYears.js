// Reading and writing the school years held in step with the national calendar.
//
// A "school year" row keeps the official backbone (the arrêté's dates) plus a status:
//   • active   — the year the app runs on; its dates are the ones in settings/terms,
//   • draft    — next year, prepared automatically by the roll-over and waiting to be
//                checked against the new arrêté,
//   • archived — a past year, kept for reference.
import { badRequest, notFound } from '../lib/http.js';
import {
  isSchoolDay,
  nextLabel,
  officialBackboneFor,
  parseBackbone,
  planBackbone,
  rollOverBackbone,
  validateBackbone,
} from '../lib/nationalCalendar.js';
import { readSettings } from './context.js';

const rowToYear = (r) => {
  const backbone = parseBackbone(r.official);
  return {
    id: r.id,
    label: r.label,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    week1Start: r.week1_start,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    backbone,
    plan: planBackbone(backbone),
  };
};

export function readSchoolYears(db) {
  return db
    .prepare('SELECT * FROM school_years ORDER BY start_date, id')
    .all()
    .map(rowToYear);
}

export function readYear(db, id) {
  const row = db.prepare('SELECT * FROM school_years WHERE id = ?').get(id);
  if (!row) throw notFound('School year not found');
  return rowToYear(row);
}

export function activeYear(db) {
  const row = db.prepare("SELECT * FROM school_years WHERE status = 'active' ORDER BY start_date DESC LIMIT 1").get();
  return row ? rowToYear(row) : null;
}

/** The year a date belongs to (by its own start/end, not by label). */
export function yearForDate(db, iso) {
  const row = db.prepare('SELECT * FROM school_years WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1').get(iso, iso);
  return row ? rowToYear(row) : null;
}

/**
 * Make sure the year the app is running on has a row. Called on every start: a database
 * created before this feature gets one built from the dates it already holds, and one
 * matching a backbone that ships with the app is filled with the official dates.
 */
export function ensureCurrentYear(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM school_years').get().n > 0) return null;
  const s = readSettings(db);
  const label = s.academicYear || '2026-2027';
  const builtIn = officialBackboneFor(label);
  const existingTerms = db.prepare('SELECT number, name, start_date, end_date, ua_months FROM terms ORDER BY number').all();
  const backbone = builtIn ?? {
    reference: '',
    yearStart: s.yearStart ?? '',
    yearEnd: s.yearEnd ?? '',
    week1Start: s.week1Start ?? '',
    anchors: {},
    terms: existingTerms.map((t) => ({
      number: t.number,
      name: t.name,
      segments: [{ start: t.start_date, end: t.end_date }],
    })),
    breaks: [],
    exams: [],
    holidays: [],
  };
  const info = db
    .prepare(
      `INSERT INTO school_years (label, start_date, end_date, week1_start, status, official, notes)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(
      label,
      backbone.yearStart || s.yearStart || '',
      backbone.yearEnd || s.yearEnd || '',
      backbone.week1Start || s.week1Start || '',
      JSON.stringify(backbone),
      builtIn ? 'Official dates shipped with the app.' : 'Rebuilt from the calendar already set up in the app.',
    );
  return Number(info.lastInsertRowid);
}

/** Create the next year as a draft, copying every anchor one year forward. */
export function rollOverYear(db, id) {
  const year = readYear(db, id);
  const label = nextLabel(year.label);
  if (!label) throw badRequest(`The year “${year.label}” does not look like “2026-2027”`);
  const existing = db.prepare('SELECT id FROM school_years WHERE label = ?').get(label);
  if (existing) throw badRequest(`The year ${label} already exists`);
  const backbone = rollOverBackbone(year.backbone, label);
  const info = db
    .prepare(
      `INSERT INTO school_years (label, start_date, end_date, week1_start, status, official, notes)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(
      label,
      backbone.yearStart,
      backbone.yearEnd,
      backbone.week1Start,
      JSON.stringify(backbone),
      `Draft copied from ${year.label}: every date moved to the same week and weekday one year later. Check it against the new arrêté, then activate it.`,
    );
  return readYear(db, Number(info.lastInsertRowid));
}

export function saveYearBackbone(db, id, input) {
  const year = readYear(db, id);
  const { errors, value } = validateBackbone(input);
  if (errors.length) throw badRequest(errors[0], errors);
  db.prepare('UPDATE school_years SET official = ?, updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')) WHERE id = ?').run(
    JSON.stringify(value),
    id,
  );
  return { ...readYear(db, id), previous: year };
}

export function setYearStatus(db, id, status) {
  if (!['active', 'draft', 'archived'].includes(status)) throw badRequest('Unknown status');
  const year = readYear(db, id);
  db.prepare('UPDATE school_years SET status = ?, updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')) WHERE id = ?').run(status, id);
  if (status === 'active') {
    db.prepare("UPDATE school_years SET status = 'archived' WHERE id != ? AND status = 'active'").run(id);
  }
  return readYear(db, id);
}

/**
 * Write a year's official dates into the working calendar: settings, terms, public
 * holidays and the official events. The school's own events (imported from the planner
 * or added by hand) are never touched.
 *
 * Returns what changed, so the interface can show it before anything is overwritten.
 */
export function applyYearToCalendar(db, id, { activate = true } = {}) {
  const year = readYear(db, id);
  const plan = planBackbone(year.backbone);
  if (!plan.terms.length) throw badRequest('This year has no terms to apply');
  const before = {
    terms: db.prepare('SELECT number, name, start_date, end_date, ua_months FROM terms ORDER BY number').all(),
    holidays: db.prepare('SELECT date, name FROM holidays ORDER BY date').all(),
  };
  const officialDates = new Set(plan.holidays.map((h) => h.date));
  const keptHolidays = before.holidays.filter((h) => !officialDates.has(h.date));

  db.transaction(() => {
    if (activate) db.prepare("UPDATE school_years SET status = 'archived' WHERE id != ? AND status = 'active'").run(id);
    db.prepare('UPDATE school_years SET status = ?, updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')) WHERE id = ?').run(
      activate ? 'active' : 'draft',
      id,
    );

    const setSetting = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    setSetting.run('academic_year', year.label);
    setSetting.run('year_start', year.backbone.yearStart);
    setSetting.run('year_end', year.backbone.yearEnd);
    setSetting.run('week1_start', year.backbone.week1Start);

    db.prepare('DELETE FROM terms').run();
    const insertTerm = db.prepare(
      'INSERT INTO terms (number, name, start_date, end_date, ua_months) VALUES (?, ?, ?, ?, ?)',
    );
    for (const t of plan.terms) insertTerm.run(t.number, t.name, t.start, t.end, JSON.stringify(t.uaMonths));

    db.prepare('DELETE FROM holidays').run();
    const insertHoliday = db.prepare('INSERT INTO holidays (date, name, source) VALUES (?, ?, ?)');
    for (const h of plan.holidays) insertHoliday.run(h.date, h.name, 'national');
    for (const h of keptHolidays) insertHoliday.run(h.date, h.name, 'manual');

    // Official events are rebuilt; anything imported or added by hand stays.
    const eventYear = year.startDate && year.endDate ? [year.startDate, year.endDate] : null;
    if (eventYear) {
      db.prepare("DELETE FROM events WHERE source = 'national' AND date >= ? AND date <= ?").run(...eventYear);
    } else {
      db.prepare("DELETE FROM events WHERE source = 'national'").run();
    }
    const insertEvent = db.prepare(
      `INSERT INTO events (date, end_date, title, category, source, school_year_id)
       VALUES (?, ?, ?, ?, 'national', ?)
       ON CONFLICT DO NOTHING`,
    );
    for (const e of plan.events) insertEvent.run(e.date, e.end_date, e.title, e.category, id);
  })();

  const after = {
    terms: db.prepare('SELECT number, name, start_date, end_date, ua_months FROM terms ORDER BY number').all(),
    holidays: db.prepare('SELECT date, name FROM holidays ORDER BY date').all(),
  };
  return diff(before, after, plan);
}

function diff(before, after, plan) {
  const beforeTerms = new Map(before.terms.map((t) => [t.number, t]));
  const termChanges = after.terms.map((t) => {
    const old = beforeTerms.get(t.number);
    return {
      number: t.number,
      name: t.name,
      from: old ? { start: old.start_date, end: old.end_date, uaMonths: safeJson(old.ua_months) } : null,
      to: { start: t.start_date, end: t.end_date, uaMonths: safeJson(t.ua_months) },
      changed:
        !old ||
        old.start_date !== t.start_date ||
        old.end_date !== t.end_date ||
        JSON.stringify(safeJson(old.ua_months)) !== JSON.stringify(safeJson(t.ua_months)),
      schoolDays: plan.terms.find((p) => p.number === t.number)?.schoolDays ?? 0,
    };
  });
  for (const [number, old] of beforeTerms) {
    if (!after.terms.some((t) => t.number === number)) {
      termChanges.push({
        number,
        name: old.name,
        from: { start: old.start_date, end: old.end_date, uaMonths: safeJson(old.ua_months) },
        to: null,
        changed: true,
        schoolDays: 0,
      });
    }
  }
  termChanges.sort((a, b) => a.number - b.number);

  const beforeByName = new Map(before.holidays.map((h) => [h.date, h.name]));
  const afterByName = new Map(after.holidays.map((h) => [h.date, h.name]));
  const holidays = {
    added: [...afterByName].filter(([d]) => !beforeByName.has(d)).map(([date, name]) => ({ date, name })),
    removed: [...beforeByName].filter(([d]) => !afterByName.has(d)).map(([date, name]) => ({ date, name })),
    renamed: [...afterByName]
      .filter(([d, n]) => beforeByName.has(d) && beforeByName.get(d) !== n)
      .map(([date, name]) => ({ date, name, was: beforeByName.get(date) })),
  };
  return {
    terms: termChanges,
    holidays,
    events: plan.events.length,
    schoolDays: plan.terms.reduce((a, t) => a + t.schoolDays, 0),
  };
}

function safeJson(v) {
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

/**
 * What applying a year would change, without touching anything. The interface shows
 * this before the school confirms.
 */
export function previewYear(db, id) {
  const year = readYear(db, id);
  const plan = planBackbone(year.backbone);
  const before = {
    terms: db.prepare('SELECT number, name, start_date, end_date, ua_months FROM terms ORDER BY number').all(),
    holidays: db.prepare('SELECT date, name FROM holidays ORDER BY date').all(),
  };
  const officialDates = new Set(plan.holidays.map((h) => h.date));
  const after = {
    terms: plan.terms.map((t) => ({
      number: t.number,
      name: t.name,
      start_date: t.start,
      end_date: t.end,
      ua_months: JSON.stringify(t.uaMonths),
    })),
    holidays: [...plan.holidays, ...before.holidays.filter((h) => !officialDates.has(h.date))]
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
  return diff(before, after, plan);
}

/** Events of a year, national and school ones together, in date order. */
export function readEvents(db, { from, to, limit = 500 } = {}) {
  const where = [];
  const args = [];
  if (from) {
    where.push('(end_date IS NULL AND date >= ?) OR (end_date IS NOT NULL AND end_date >= ?)');
    args.push(from, from);
  }
  if (to) {
    where.push('date <= ?');
    args.push(to);
  }
  const sql = `SELECT id, date, end_date, title, category, source, school_year_id, remind
                 FROM events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY date, category, title LIMIT ?`;
  return db.prepare(sql).all(...args, limit).map((e) => ({
    id: e.id,
    date: e.date,
    endDate: e.end_date,
    title: e.title,
    category: e.category,
    source: e.source,
    schoolYearId: e.school_year_id,
    remind: Boolean(e.remind),
  }));
}

/** School days of a year, used to summarise a year before it is applied. */
export function countSchoolDays(backbone) {
  const plan = planBackbone(backbone);
  return plan.terms.reduce((a, t) => a + t.schoolDays, 0);
}

export { isSchoolDay };
