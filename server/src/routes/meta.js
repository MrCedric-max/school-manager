import { existsSync } from 'node:fs';
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ATTITUDE_GRADES, PUPIL_STATUSES, ROLL_MARKS } from '../db/defaults.js';
import { HttpError, badRequest, notFound } from '../lib/http.js';
import { optionalString, requireInt, requireString } from '../lib/validate.js';
import { currentSelections, loadContext, readClasses } from '../services/context.js';

export const metaRouter = Router();

/** Everything the interface needs to render menus, grids and selectors. */
metaRouter.get('/meta', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const { logo, ...settings } = ctx.settings;
  res.json({
    settings: {
      ...settings,
      /** A logo of the school's own, uploaded in Settings (otherwise the crest that ships with the app is used). */
      hasLogo: Boolean(logo),
      /** Cache-busting: changes whenever the picture does, so the crest is not stale in the browser. */
      logoVersion: logo ? String(logo.length) : 'crest',
    },
    classes: readClasses(db),
    framework: ctx.framework,
    calendar: {
      months: ctx.calendar.months,
      weeks: ctx.calendar.weeks,
      terms: ctx.calendar.terms,
      summary: ctx.calendar.summary,
      schoolDays: ctx.calendar.schoolDays,
    },
    holidays: ctx.holidays,
    today: ctx.today,
    selections: currentSelections(ctx),
    statuses: PUPIL_STATUSES,
    rollMarks: ROLL_MARKS,
    attitudeGrades: ATTITUDE_GRADES,
  });
});

metaRouter.put('/settings', (req, res) => {
  const db = getDb();
  const b = req.body ?? {};
  const updates = {};
  if (b.schoolName !== undefined) updates.school_name = requireString(b.schoolName, 'school name', { max: 120 });
  if (b.schoolSubtitle !== undefined) updates.school_subtitle = optionalString(b.schoolSubtitle, { max: 160 }) ?? '';
  if (b.academicYear !== undefined) updates.academic_year = requireString(b.academicYear, 'academic year', { max: 20 });
  if (b.timezone !== undefined) {
    const tz = requireString(b.timezone, 'timezone', { max: 60 });
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
    } catch {
      throw badRequest('Unknown timezone');
    }
    updates.timezone = tz;
  }
  if (b.academicWeight !== undefined) {
    const w = Number(b.academicWeight);
    if (!Number.isFinite(w) || w < 0 || w > 1) throw badRequest('Academic weight must be between 0 and 1');
    updates.academic_weight = String(w);
  }
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) stmt.run(k, v);
  })();
  res.json({ ok: true });
});

const LOGO_TYPES = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

metaRouter.put('/settings/logo', (req, res) => {
  const dataUrl = req.body?.dataUrl;
  if (typeof dataUrl !== 'string' || !LOGO_TYPES.test(dataUrl)) throw badRequest('Logo must be a PNG, JPEG or WebP image');
  if (dataUrl.length > 700_000) throw badRequest('Logo is too large (max ~500 KB)');
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('logo', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(dataUrl);
  res.json({ ok: true });
});

metaRouter.delete('/settings/logo', (req, res) => {
  getDb().prepare("UPDATE settings SET value = '' WHERE key = 'logo'").run();
  res.json({ ok: true });
});

/**
 * The school crest shipped with the app, used whenever the school has not uploaded its own.
 * Schools replace it in Settings; it is the same file the report cards print.
 */
export const CREST_FILE = new URL('../../assets/logo.png', import.meta.url).pathname;

/**
 * GET /api/logo — public (mounted before the sign-in check in app.js): <img> tags cannot send the
 * session header. Serves the logo uploaded in Settings, or the school crest that ships with the app.
 */
export function sendLogo(req, res) {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'logo'").get();
  const m = row?.value?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  res.set('Cache-Control', 'private, max-age=300');
  if (m) {
    res.type(m[1]).send(Buffer.from(m[2], 'base64'));
    return;
  }
  if (!existsSync(CREST_FILE)) throw notFound('No logo');
  res.type('image/png').sendFile(CREST_FILE);
}

// ---- Classes ---------------------------------------------------------------

function classPayload(body) {
  const name = requireString(body?.name, 'class name', { max: 30 });
  const code = requireString(body?.code, 'class code', { max: 12 }).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code)) throw badRequest('Class code must contain only letters and digits (e.g. CE2, 6EME)');
  return { name, code };
}

metaRouter.post('/classes', (req, res) => {
  const db = getDb();
  const { name, code } = classPayload(req.body);
  const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM classes').get().n;
  try {
    const r = db.prepare('INSERT INTO classes (name, code, sort_order) VALUES (?, ?, ?)').run(name, code, order);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'A class with this name or code already exists');
    throw e;
  }
});

metaRouter.put('/classes/:id', (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'class');
  const { name, code } = classPayload(req.body);
  const sortOrder = req.body?.sortOrder === undefined ? null : requireInt(req.body.sortOrder, 'order', { min: 0, max: 999 });
  try {
    const r = db
      .prepare('UPDATE classes SET name = ?, code = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?')
      .run(name, code, sortOrder, id);
    if (!r.changes) throw notFound('Class not found');
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'A class with this name or code already exists');
    throw e;
  }
  res.json({ ok: true });
});

metaRouter.delete('/classes/:id', (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'class');
  const n = db.prepare('SELECT COUNT(*) AS n FROM pupils WHERE class_id = ?').get(id).n;
  if (n > 0) throw new HttpError(409, 'This class still has pupils — move or delete them first');
  const r = db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Class not found');
  res.json({ ok: true });
});
