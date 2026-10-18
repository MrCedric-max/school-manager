import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { dayOfWeek, isValidMonthKey } from '../lib/dates.js';
import { badRequest, notFound } from '../lib/http.js';
import { EVENT_CATEGORIES, officialBackboneFor, eventCycle } from '../lib/nationalCalendar.js';
import { requireArray, requireDate, requireInt, requireString } from '../lib/validate.js';
import { parsePlannerWorkbook, summarisePlanner } from '../services/calendarWorkbook.js';
import { loadContext } from '../services/context.js';
import { refuseDemoAccount } from '../services/demo-login.js';
import {
  activeYear,
  applyYearToCalendar,
  ensureCurrentYear,
  previewYear,
  readEvents,
  readSchoolYears,
  readYear,
  refreshYearBackbone,
  rollOverYear,
  saveYearBackbone,
  setYearStatus,
} from '../services/schoolYears.js';

export const calendarRouter = Router();

calendarRouter.get('/', (req, res) => {
  const ctx = loadContext(getDb());
  res.json({
    year: { yearStart: ctx.settings.yearStart, yearEnd: ctx.settings.yearEnd, week1Start: ctx.settings.week1Start },
    days: ctx.calendar.days,
    months: ctx.calendar.months,
    weeks: ctx.calendar.weeks,
    terms: ctx.calendar.terms,
    summary: ctx.calendar.summary,
    holidays: ctx.holidays,
    today: ctx.today,
  });
});

calendarRouter.put('/year', (req, res) => {
  const yearStart = requireDate(req.body?.yearStart, 'start of year');
  const yearEnd = requireDate(req.body?.yearEnd, 'end of year');
  const week1Start = requireDate(req.body?.week1Start, 'week 1 Monday');
  if (yearEnd <= yearStart) throw badRequest('The year must end after it starts');
  if (week1Start < yearStart || week1Start > yearEnd) throw badRequest('Week 1 must start inside the school year');
  if (dayOfWeek(week1Start) !== 1) throw badRequest('Week 1 must start on a Monday');
  const db = getDb();
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    stmt.run('year_start', yearStart);
    stmt.run('year_end', yearEnd);
    stmt.run('week1_start', week1Start);
  })();
  res.json({ ok: true });
});

calendarRouter.put('/terms', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const input = requireArray(req.body?.terms, 'terms', { max: 6 });
  if (!input.length) throw badRequest('At least one term is required');
  const terms = input.map((t, i) => {
    const number = requireInt(t?.number ?? i + 1, 'term number', { min: 1, max: 6 });
    const start = requireDate(t?.startDate, `term ${number} start`);
    const end = requireDate(t?.endDate, `term ${number} end`);
    if (end < start) throw badRequest(`Term ${number} ends before it starts`);
    if (start < ctx.settings.yearStart || end > ctx.settings.yearEnd) {
      throw badRequest(`Term ${number} must fall inside the school year`);
    }
    const uaMonths = requireArray(t?.uaMonths ?? [], 'UA months', { max: 6 });
    for (const m of uaMonths) if (!isValidMonthKey(m)) throw badRequest(`Invalid UA month for term ${number}`);
    return {
      number,
      name: requireString(t?.name ?? `Term ${number}`, 'term name', { max: 40 }),
      start,
      end,
      uaMonths,
    };
  });
  terms.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < terms.length; i += 1) {
    if (terms[i].start <= terms[i - 1].end) throw badRequest('Terms must not overlap');
  }
  const allUa = terms.flatMap((t) => t.uaMonths);
  if (new Set(allUa).size !== allUa.length) throw badRequest('A month can be a UA month of only one term');
  if (new Set(terms.map((t) => t.number)).size !== terms.length) throw badRequest('Term numbers must be unique');

  db.transaction(() => {
    db.prepare('DELETE FROM terms').run();
    const stmt = db.prepare('INSERT INTO terms (number, name, start_date, end_date, ua_months) VALUES (?, ?, ?, ?, ?)');
    for (const t of terms) stmt.run(t.number, t.name, t.start, t.end, JSON.stringify(t.uaMonths));
  })();
  res.json({ ok: true });
});

calendarRouter.post('/holidays', (req, res) => {
  const date = requireDate(req.body?.date);
  const name = requireString(req.body?.name, 'holiday name', { max: 120 });
  getDb()
    .prepare('INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name')
    .run(date, name);
  res.status(201).json({ ok: true });
});

calendarRouter.delete('/holidays/:date', (req, res) => {
  const r = getDb().prepare('DELETE FROM holidays WHERE date = ?').run(requireDate(req.params.date));
  if (!r.changes) throw notFound('Holiday not found');
  res.json({ ok: true });
});

// ---- The national calendar ----------------------------------------------------

/**
 * Every school year the app knows about, with the official dates it holds and what
 * applying them would change. This is the panel that answers "are we in step with the
 * national calendar?".
 */
calendarRouter.get('/years', (req, res) => {
  const db = getDb();
  ensureCurrentYear(db);
  const years = readSchoolYears(db);
  const active = years.find((y) => y.status === 'active') ?? null;
  const events = readEvents(db, { limit: 2000, cycle: typeof req.query.cycle === 'string' ? req.query.cycle : undefined });
  const bySource = events.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1;
    return acc;
  }, {});
  res.json({
    years,
    activeId: active?.id ?? null,
    hasOfficial: Boolean(active?.backbone?.reference),
    events,
    eventSources: bySource,
    categories: EVENT_CATEGORIES,
  });
});

calendarRouter.post('/years', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const label = requireString(req.body?.label ?? '', 'school year', { max: 20 });
  if (db.prepare('SELECT id FROM school_years WHERE label = ?').get(label)) {
    throw badRequest(`The year ${label} already exists`);
  }
  const official = officialBackboneFor(label);
  const info = db
    .prepare(
      `INSERT INTO school_years (label, start_date, end_date, week1_start, status, official, notes)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(
      label,
      official?.yearStart ?? '',
      official?.yearEnd ?? '',
      official?.week1Start ?? '',
      JSON.stringify(official ?? { yearStart: '', yearEnd: '', week1Start: '', anchors: {}, terms: [], breaks: [], exams: [], holidays: [] }),
      official ? 'Official dates shipped with the app.' : '',
    );
  res.status(201).json(readYear(db, Number(info.lastInsertRowid)));
});

calendarRouter.put('/years/:id', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'school year');
  const saved = saveYearBackbone(db, id, req.body?.backbone ?? {});
  res.json({ year: saved, preview: previewYear(db, id) });
});

calendarRouter.post('/years/:id/rollover', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const draft = rollOverYear(db, requireInt(req.params.id, 'school year'));
  res.status(201).json(draft);
});

calendarRouter.post('/years/:id/status', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const status = requireString(req.body?.status ?? '', 'status', { max: 10 });
  res.json(setYearStatus(db, requireInt(req.params.id, 'school year'), status));
});

/**
 * Reload the official dates that ship with the app for this year. Nothing is applied:
 * the school sees what would change (including the exam periods of each cycle) first.
 */
calendarRouter.post('/years/:id/refresh', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'school year');
  const year = refreshYearBackbone(db, id);
  res.json({ year, preview: previewYear(db, id) });
});

/** What applying this year's official dates would change — shown before it happens. */
calendarRouter.get('/years/:id/preview', (req, res) => {
  const db = getDb();
  res.json(previewYear(db, requireInt(req.params.id, 'school year')));
});

/** Write the official dates into the working calendar (terms, holidays, breaks). */
calendarRouter.post('/years/:id/apply', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'school year');
  const activate = req.body?.activate !== false;
  const result = applyYearToCalendar(db, id, { activate });
  res.json({ ok: true, ...result });
});

// ---- Events -------------------------------------------------------------------

calendarRouter.get('/events', (req, res) => {
  const db = getDb();
  const from = typeof req.query.from === 'string' && req.query.from ? requireDate(req.query.from, 'from') : undefined;
  const to = typeof req.query.to === 'string' && req.query.to ? requireDate(req.query.to, 'to') : undefined;
  const cycle = typeof req.query.cycle === 'string' ? req.query.cycle : undefined;
  res.json({ events: readEvents(db, { from, to, cycle, limit: 3000 }) });
});

function eventPayload(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.date !== undefined) out.date = requireDate(body.date, 'date');
  if (!partial || body.endDate !== undefined) {
    out.endDate = body.endDate ? requireDate(body.endDate, 'end date') : null;
    if (out.endDate && out.date && out.endDate < out.date) throw badRequest('The event ends before it starts');
  }
  if (!partial || body.title !== undefined) out.title = requireString(body.title, 'title', { max: 200 });
  if (!partial || body.category !== undefined) {
    const category = String(body.category ?? 'event');
    if (!EVENT_CATEGORIES.includes(category)) throw badRequest('Unknown kind of event');
    out.category = category;
  }
  if (!partial || body.remind !== undefined) out.remind = body.remind === false || body.remind === 0 ? 0 : 1;
  if (!partial || body.cycle !== undefined) out.cycle = eventCycle(body.cycle);
  return out;
}

calendarRouter.post('/events', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const e = eventPayload(req.body ?? {});
  const year = activeYear(db);
  const info = db
    .prepare(
      `INSERT INTO events (date, end_date, title, category, cycle, source, school_year_id, remind)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)`,
    )
    .run(e.date, e.endDate, e.title, e.category, e.cycle, year?.id ?? null, e.remind);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

calendarRouter.put('/events/:id', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'event');
  const current = db.prepare('SELECT id, source FROM events WHERE id = ?').get(id);
  if (!current) throw notFound('Event not found');
  const patch = eventPayload(req.body ?? {}, { partial: true });
  const sets = [];
  const args = [];
  for (const [key, column] of [['date', 'date'], ['endDate', 'end_date'], ['title', 'title'], ['category', 'category'], ['cycle', 'cycle'], ['remind', 'remind']]) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    args.push(patch[key]);
  }
  if (!sets.length) throw badRequest('Nothing to change');
  db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...args, id);
  res.json({ ok: true });
});

calendarRouter.delete('/events/:id', refuseDemoAccount, (req, res) => {
  const r = getDb().prepare('DELETE FROM events WHERE id = ?').run(requireInt(req.params.id, 'event'));
  if (!r.changes) throw notFound('Event not found');
  res.json({ ok: true });
});

/** Remove the events brought in by the planner workbook (the official dates stay). */
calendarRouter.delete('/events', refuseDemoAccount, (req, res) => {
  const source = requireString(req.query.source ?? 'import', 'source', { max: 10 });
  if (source !== 'import') throw badRequest('Only imported events can be cleared like this');
  const r = getDb().prepare("DELETE FROM events WHERE source = 'import'").run();
  res.json({ ok: true, removed: r.changes });
});

// ---- Importing the school's planner workbook ----------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
});

// Parsed planners waiting for confirmation (kept 30 minutes in memory).
const pendingPlanners = new Map();
function cleanupPlanners() {
  const limit = Date.now() - 30 * 60_000;
  for (const [id, entry] of pendingPlanners) if (entry.createdAt < limit) pendingPlanners.delete(id);
}

calendarRouter.post('/events/import/preview', refuseDemoAccount, upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose the school planner (.xlsx) to import');
  if (!/\.xlsx$/i.test(req.file.originalname)) throw badRequest('Only .xlsx workbooks can be imported');
  let parsed;
  try {
    parsed = await parsePlannerWorkbook(req.file.buffer);
  } catch (e) {
    console.error('[planner] parse failed', e);
    throw badRequest(
      `This file could not be read as an Excel workbook (${String(e?.message ?? e).slice(0, 160)}). ` +
        'Open it in Excel or Google Sheets and save it again as .xlsx, then retry.',
    );
  }
  if (!parsed.events.length) {
    throw badRequest(
      'No dated notes were found in this workbook. The app looks for a row of month names ' +
        '(Août, Septembre …) with the days of the month underneath — one column block per month.',
    );
  }
  cleanupPlanners();
  const id = crypto.randomUUID();
  pendingPlanners.set(id, { parsed, createdAt: Date.now(), fileName: req.file.originalname });
  const db = getDb();
  const already = db.prepare("SELECT COUNT(*) AS n FROM events WHERE source = 'import'").get().n;
  res.json({ importId: id, fileName: req.file.originalname, summary: summarisePlanner(parsed), alreadyImported: already });
});

calendarRouter.post('/events/import/commit', refuseDemoAccount, (req, res) => {
  const entry = pendingPlanners.get(String(req.body?.importId ?? ''));
  if (!entry) throw badRequest('This import has expired — please upload the file again');
  const db = getDb();
  const year = activeYear(db);
  const stmt = db.prepare(
    `INSERT INTO events (date, end_date, title, category, cycle, source, school_year_id, remind)
     VALUES (?, NULL, ?, ?, ?, 'import', ?, 1)
     ON CONFLICT DO NOTHING`,
  );
  const removed = req.body?.replace === false ? 0 : db.prepare("DELETE FROM events WHERE source = 'import'").run().changes;
  let added = 0;
  db.transaction(() => {
    for (const e of entry.parsed.events) {
      added += stmt.run(e.date, e.title, e.category, eventCycle(e.cycle), year?.id ?? null).changes;
    }
  })();
  pendingPlanners.delete(String(req.body.importId));
  res.json({ ok: true, added, removed, total: entry.parsed.events.length, sheets: entry.parsed.sheets });
});
