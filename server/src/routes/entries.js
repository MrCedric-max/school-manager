import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ATTITUDE_GRADES, ROLL_MARKS } from '../db/defaults.js';
import { schoolDaysBetween } from '../lib/calendar.js';
import { addDays } from '../lib/dates.js';
import { badRequest, notFound } from '../lib/http.js';
import { markValue, requireArray, requireDate, requireInt, requireMonth, optionalString } from '../lib/validate.js';
import { findMonth, findWeek, loadContext } from '../services/context.js';
import {
  attendanceSummary,
  classPupils,
  getClass,
  loadAttendance,
  loadAttitudes,
  loadControls,
  loadDisciplineMarks,
  loadPerformance,
  performanceSummary,
  visiblePupils,
} from '../services/records.js';

export const entriesRouter = Router();

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function classOr404(db, classId) {
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  return cls;
}

const pupilView = (p) => ({ id: p.id, studentId: p.student_id, name: p.full_name, status: p.status, classNo: p.class_no });

function nestedToObject(map, key) {
  const out = {};
  for (const [pupilId, inner] of map) {
    const v = inner.get(key);
    if (v) out[pupilId] = v;
  }
  return out;
}

function pupilIdsOfDb(db) {
  const stmt = db.prepare('SELECT 1 FROM pupils WHERE id = ?');
  const cache = new Map();
  return (id) => {
    if (!cache.has(id)) cache.set(id, Boolean(stmt.get(id)));
    if (!cache.get(id)) throw badRequest(`Unknown pupil ${id}`);
    return id;
  };
}

// ---- Roll call (attendance) -------------------------------------------------

entriesRouter.get('/attendance', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const classId = requireInt(req.query.classId, 'class');
  const cls = classOr404(db, classId);
  const week = findWeek(ctx, requireInt(req.query.week, 'week'));
  if (!week) throw notFound('Week not found');

  const days = [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(week.monday, i);
    const d = ctx.calendar.dayByDate.get(date);
    return { date, dow: i + 1, type: d?.type ?? 'outside', holiday: d?.holiday ?? null, term: d?.term ?? null };
  });
  const marks = loadAttendance(db, classId, week.monday, week.friday);
  const pupils = visiblePupils(classPupils(db, classId), new Set(marks.keys()));
  const weekDates = schoolDaysBetween(ctx.calendar, week.monday, week.friday);
  const ytdDates = schoolDaysBetween(ctx.calendar, ctx.settings.yearStart, week.friday);
  const ytd = loadAttendance(db, classId, ctx.settings.yearStart, week.friday);

  const out = {};
  const weekTotals = {};
  const yearToDate = {};
  for (const p of pupils) {
    out[p.id] = Object.fromEntries(marks.get(p.id) ?? []);
    weekTotals[p.id] = attendanceSummary(marks.get(p.id), weekDates);
    yearToDate[p.id] = attendanceSummary(ytd.get(p.id), ytdDates);
  }
  res.json({ class: cls, week, days, pupils: pupils.map(pupilView), marks: out, weekTotals, yearToDate });
});

entriesRouter.put('/attendance', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const changes = requireArray(req.body?.changes, 'changes');
  const checkPupil = pupilIdsOfDb(db);
  const upsert = db.prepare(
    `INSERT INTO attendance (pupil_id, date, mark) VALUES (?, ?, ?)
     ON CONFLICT(pupil_id, date) DO UPDATE SET mark = excluded.mark, updated_at = ${NOW}`,
  );
  const remove = db.prepare('DELETE FROM attendance WHERE pupil_id = ? AND date = ?');
  const validated = changes.map((c) => {
    const pupilId = checkPupil(requireInt(c?.pupilId, 'pupil'));
    const date = requireDate(c?.date);
    if (ctx.calendar.dayByDate.get(date)?.type !== 'school') throw badRequest(`${date} is not a school day`);
    const mark = c?.mark ? String(c.mark).toUpperCase() : null;
    if (mark !== null && !ROLL_MARKS.includes(mark)) throw badRequest('Roll mark must be P, A, L or E');
    return { pupilId, date, mark };
  });
  db.transaction(() => {
    for (const c of validated) {
      if (c.mark) upsert.run(c.pupilId, c.date, c.mark);
      else remove.run(c.pupilId, c.date);
    }
  })();
  res.json({ saved: validated.length });
});

// ---- Weekly controls ---------------------------------------------------------

entriesRouter.get('/controls', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const classId = requireInt(req.query.classId, 'class');
  const cls = classOr404(db, classId);
  const weekNo = requireInt(req.query.week, 'week');
  const week = findWeek(ctx, weekNo);
  if (!week) throw notFound('Week not found');
  const values = loadControls(db, classId, weekNo, weekNo);
  const pupils = visiblePupils(classPupils(db, classId), new Set(values.keys()));
  res.json({ class: cls, week, pupils: pupils.map(pupilView), values: nestedToObject(values, weekNo) });
});

entriesRouter.put('/controls', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const changes = requireArray(req.body?.changes, 'changes');
  const subjects = new Map(ctx.framework.subjects.map((s) => [s.code, s]));
  const checkPupil = pupilIdsOfDb(db);
  const upsert = db.prepare(
    `INSERT INTO control_marks (pupil_id, week, subject, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(pupil_id, week, subject) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
  );
  const remove = db.prepare('DELETE FROM control_marks WHERE pupil_id = ? AND week = ? AND subject = ?');
  const validated = changes.map((c) => {
    const subject = subjects.get(c?.subject);
    if (!subject) throw badRequest('Unknown subject');
    return {
      pupilId: checkPupil(requireInt(c?.pupilId, 'pupil')),
      week: requireInt(c?.week, 'week', { min: 1, max: ctx.calendar.weeks.length }),
      subject: subject.code,
      value: markValue(c?.value, subject.max, subject.label_en),
    };
  });
  db.transaction(() => {
    for (const c of validated) {
      if (c.value === null) remove.run(c.pupilId, c.week, c.subject);
      else upsert.run(c.pupilId, c.week, c.subject, c.value);
    }
  })();
  res.json({ saved: validated.length });
});

// ---- Daily performance ---------------------------------------------------------

entriesRouter.get('/performance', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const classId = requireInt(req.query.classId, 'class');
  const cls = classOr404(db, classId);
  const date = requireDate(req.query.date);
  const day = ctx.calendar.dayByDate.get(date);
  const values = loadPerformance(db, classId, date, date);
  const pupils = visiblePupils(classPupils(db, classId), new Set(values.keys()));
  res.json({
    class: cls,
    date,
    day: day ?? { date, type: 'outside' },
    pupils: pupils.map(pupilView),
    values: nestedToObject(values, date),
  });
});

entriesRouter.put('/performance', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const changes = requireArray(req.body?.changes, 'changes');
  const areas = new Map(ctx.framework.areas.map((a) => [a.code, a]));
  const checkPupil = pupilIdsOfDb(db);
  const upsert = db.prepare(
    `INSERT INTO performance_marks (pupil_id, date, area, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(pupil_id, date, area) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
  );
  const remove = db.prepare('DELETE FROM performance_marks WHERE pupil_id = ? AND date = ? AND area = ?');
  const validated = changes.map((c) => {
    const area = areas.get(c?.area);
    if (!area) throw badRequest('Unknown performance area');
    const date = requireDate(c?.date);
    if (ctx.calendar.dayByDate.get(date)?.type !== 'school') throw badRequest(`${date} is not a school day`);
    return {
      pupilId: checkPupil(requireInt(c?.pupilId, 'pupil')),
      date,
      area: area.code,
      value: markValue(c?.value, area.max, area.label_en),
    };
  });
  db.transaction(() => {
    for (const c of validated) {
      if (c.value === null) remove.run(c.pupilId, c.date, c.area);
      else upsert.run(c.pupilId, c.date, c.area, c.value);
    }
  })();
  res.json({ saved: validated.length });
});

// ---- Monthly & term card marks ------------------------------------------------

entriesRouter.get('/marks', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const classId = requireInt(req.query.classId, 'class');
  const cls = classOr404(db, classId);
  const monthKey = requireMonth(req.query.month);
  const month = findMonth(ctx, monthKey);
  if (!month) throw notFound('Month not found');
  const marks = loadDisciplineMarks(db, classId, [monthKey]);
  const attitudes = loadAttitudes(db, classId, [monthKey]);
  const perf = loadPerformance(db, classId, month.firstDay, month.lastDay);
  const pupils = visiblePupils(classPupils(db, classId), new Set([...marks.keys(), ...attitudes.keys()]));
  const dates = schoolDaysBetween(ctx.calendar, month.firstDay, month.lastDay);
  const performance = {};
  for (const p of pupils) performance[p.id] = performanceSummary(perf.get(p.id), dates, ctx.framework.areas).average;
  res.json({
    class: cls,
    month,
    pupils: pupils.map(pupilView),
    values: nestedToObject(marks, monthKey),
    attitudes: nestedToObject(attitudes, monthKey),
    performance,
  });
});

entriesRouter.put('/marks', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const marks = requireArray(req.body?.marks ?? [], 'marks');
  const grades = requireArray(req.body?.attitudes ?? [], 'attitudes');
  const disciplines = new Map(ctx.framework.disciplines.map((d) => [d.code, d]));
  const attitudes = new Set(ctx.framework.attitudes.map((a) => a.code));
  const months = new Set(ctx.calendar.months.map((m) => m.key));
  const checkPupil = pupilIdsOfDb(db);
  const checkMonth = (m) => {
    const key = requireMonth(m);
    if (!months.has(key)) throw badRequest(`${key} is outside the school year`);
    return key;
  };

  const vMarks = marks.map((c) => {
    const d = disciplines.get(c?.discipline);
    if (!d) throw badRequest('Unknown discipline');
    return {
      pupilId: checkPupil(requireInt(c?.pupilId, 'pupil')),
      month: checkMonth(c?.month),
      discipline: d.code,
      value: markValue(c?.value, d.max, d.code),
    };
  });
  const vGrades = grades.map((c) => {
    if (!attitudes.has(c?.attitude)) throw badRequest('Unknown attitude');
    const grade = c?.grade || null;
    if (grade !== null && !ATTITUDE_GRADES.includes(grade)) throw badRequest('Grade must be A+, A, B or C');
    return { pupilId: checkPupil(requireInt(c?.pupilId, 'pupil')), month: checkMonth(c?.month), attitude: c.attitude, grade };
  });

  const upsertMark = db.prepare(
    `INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(pupil_id, month, discipline) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
  );
  const removeMark = db.prepare('DELETE FROM discipline_marks WHERE pupil_id = ? AND month = ? AND discipline = ?');
  const upsertGrade = db.prepare(
    `INSERT INTO attitude_grades (pupil_id, month, attitude, grade) VALUES (?, ?, ?, ?)
     ON CONFLICT(pupil_id, month, attitude) DO UPDATE SET grade = excluded.grade, updated_at = ${NOW}`,
  );
  const removeGrade = db.prepare('DELETE FROM attitude_grades WHERE pupil_id = ? AND month = ? AND attitude = ?');
  db.transaction(() => {
    for (const c of vMarks) {
      if (c.value === null) removeMark.run(c.pupilId, c.month, c.discipline);
      else upsertMark.run(c.pupilId, c.month, c.discipline, c.value);
    }
    for (const c of vGrades) {
      if (c.grade === null) removeGrade.run(c.pupilId, c.month, c.attitude);
      else upsertGrade.run(c.pupilId, c.month, c.attitude, c.grade);
    }
  })();
  res.json({ saved: vMarks.length + vGrades.length });
});

// ---- Class council remarks (printed on report cards) ----------------------------

entriesRouter.put('/remarks', (req, res) => {
  const db = getDb();
  const pupilId = pupilIdsOfDb(db)(requireInt(req.body?.pupilId, 'pupil'));
  const period = String(req.body?.period ?? '');
  if (!/^(M:\d{4}-(0[1-9]|1[0-2])|T:\d)$/.test(period)) throw badRequest('Invalid period');
  const text = optionalString(req.body?.text, { max: 600 });
  if (text) {
    db.prepare(
      `INSERT INTO remarks (pupil_id, period, text) VALUES (?, ?, ?)
       ON CONFLICT(pupil_id, period) DO UPDATE SET text = excluded.text, updated_at = ${NOW}`,
    ).run(pupilId, period, text);
  } else {
    db.prepare('DELETE FROM remarks WHERE pupil_id = ? AND period = ?').run(pupilId, period);
  }
  res.json({ ok: true });
});
