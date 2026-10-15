import { Router } from 'express';
import { getDb } from '../db/index.js';
import { dayOfWeek, isValidMonthKey } from '../lib/dates.js';
import { badRequest, notFound } from '../lib/http.js';
import { requireArray, requireDate, requireInt, requireString } from '../lib/validate.js';
import { loadContext } from '../services/context.js';

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
