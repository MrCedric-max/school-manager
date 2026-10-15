// Loading per-class records and summarising them over a period.
import { attendanceRate, isNum, mean } from '../lib/grading.js';

export const ACTIVE_STATUSES = new Set(['Active', 'Suspended']);

export function getClass(db, classId) {
  return db.prepare('SELECT id, name, code, sort_order FROM classes WHERE id = ?').get(classId) ?? null;
}

export function classPupils(db, classId) {
  return db
    .prepare(
      `SELECT id, student_id, class_no, full_name, gender, status
         FROM pupils WHERE class_id = ? ORDER BY class_no, full_name`,
    )
    .all(classId);
}

/** Pupils shown on a sheet: active ones, plus inactive ones that have data in the period. */
export function visiblePupils(pupils, withData = new Set()) {
  return pupils.filter((p) => ACTIVE_STATUSES.has(p.status) || withData.has(p.id));
}

function nested(map, a, b) {
  let inner = map.get(a);
  if (!inner) {
    inner = new Map();
    map.set(a, inner);
  }
  let leaf = inner.get(b);
  if (!leaf) {
    leaf = {};
    inner.set(b, leaf);
  }
  return leaf;
}

/** Map pupilId → Map date → mark */
export function loadAttendance(db, classId, from, to) {
  const rows = db
    .prepare(
      `SELECT a.pupil_id, a.date, a.mark FROM attendance a
         JOIN pupils p ON p.id = a.pupil_id
        WHERE p.class_id = ? AND a.date BETWEEN ? AND ?`,
    )
    .all(classId, from, to);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.pupil_id)) map.set(r.pupil_id, new Map());
    map.get(r.pupil_id).set(r.date, r.mark);
  }
  return map;
}

/** Map pupilId → Map week → { subject: value } */
export function loadControls(db, classId, weekFrom, weekTo) {
  const rows = db
    .prepare(
      `SELECT c.pupil_id, c.week, c.subject, c.value FROM control_marks c
         JOIN pupils p ON p.id = c.pupil_id
        WHERE p.class_id = ? AND c.week BETWEEN ? AND ?`,
    )
    .all(classId, weekFrom, weekTo);
  const map = new Map();
  for (const r of rows) nested(map, r.pupil_id, r.week)[r.subject] = r.value;
  return map;
}

/** Map pupilId → Map date → { area: value } */
export function loadPerformance(db, classId, from, to) {
  const rows = db
    .prepare(
      `SELECT m.pupil_id, m.date, m.area, m.value FROM performance_marks m
         JOIN pupils p ON p.id = m.pupil_id
        WHERE p.class_id = ? AND m.date BETWEEN ? AND ?`,
    )
    .all(classId, from, to);
  const map = new Map();
  for (const r of rows) nested(map, r.pupil_id, r.date)[r.area] = r.value;
  return map;
}

function inList(values) {
  return values.map(() => '?').join(',') || "''";
}

/** Map pupilId → Map month → { discipline: value } */
export function loadDisciplineMarks(db, classId, months) {
  const rows = db
    .prepare(
      `SELECT m.pupil_id, m.month, m.discipline, m.value FROM discipline_marks m
         JOIN pupils p ON p.id = m.pupil_id
        WHERE p.class_id = ? AND m.month IN (${inList(months)})`,
    )
    .all(classId, ...months);
  const map = new Map();
  for (const r of rows) nested(map, r.pupil_id, r.month)[r.discipline] = r.value;
  return map;
}

/** Map pupilId → Map month → { attitude: grade } */
export function loadAttitudes(db, classId, months) {
  const rows = db
    .prepare(
      `SELECT g.pupil_id, g.month, g.attitude, g.grade FROM attitude_grades g
         JOIN pupils p ON p.id = g.pupil_id
        WHERE p.class_id = ? AND g.month IN (${inList(months)})`,
    )
    .all(classId, ...months);
  const map = new Map();
  for (const r of rows) nested(map, r.pupil_id, r.month)[r.attitude] = r.grade;
  return map;
}

/** Map pupilId → text */
export function loadRemarks(db, classId, period) {
  const rows = db
    .prepare(
      `SELECT r.pupil_id, r.text FROM remarks r JOIN pupils p ON p.id = r.pupil_id
        WHERE p.class_id = ? AND r.period = ?`,
    )
    .all(classId, period);
  return new Map(rows.map((r) => [r.pupil_id, r.text]));
}

// ---- Summaries -------------------------------------------------------------

/** Roll marks over a set of school days → { P, A, L, E, marked, rate } */
export function attendanceSummary(byDate, dates) {
  const counts = { P: 0, A: 0, L: 0, E: 0 };
  if (byDate) {
    for (const d of dates) {
      const m = byDate.get(d);
      if (m) counts[m] += 1;
    }
  }
  const marked = counts.P + counts.A + counts.L + counts.E;
  return { ...counts, marked, rate: attendanceRate(counts) };
}

/**
 * Daily performance over a set of school days: per-area averages and the
 * overall average (mean of each day's average /10).
 */
export function performanceSummary(byDate, dates, areas) {
  const perArea = Object.fromEntries(areas.map((a) => [a.code, []]));
  const dailyAverages = [];
  let entries = 0;
  if (byDate) {
    for (const d of dates) {
      const row = byDate.get(d);
      if (!row) continue;
      const values = areas.map((a) => row[a.code]).filter(isNum);
      if (!values.length) continue;
      entries += 1;
      dailyAverages.push(mean(values));
      for (const a of areas) if (isNum(row[a.code])) perArea[a.code].push(row[a.code]);
    }
  }
  return {
    areas: Object.fromEntries(areas.map((a) => [a.code, mean(perArea[a.code])])),
    average: mean(dailyAverages),
    entries,
  };
}

/** Weekly controls over a range of weeks: per-subject averages and the mean weekly average. */
export function controlsSummary(byWeek, weeks, subjects) {
  const perSubject = Object.fromEntries(subjects.map((s) => [s.code, []]));
  const weeklyAverages = [];
  let rows = 0;
  if (byWeek) {
    for (const w of weeks) {
      const row = byWeek.get(w);
      if (!row) continue;
      const values = subjects.map((s) => row[s.code]).filter(isNum);
      if (!values.length) continue;
      rows += 1;
      weeklyAverages.push(mean(values));
      for (const s of subjects) if (isNum(row[s.code])) perSubject[s.code].push(row[s.code]);
    }
  }
  return {
    subjects: Object.fromEntries(subjects.map((s) => [s.code, mean(perSubject[s.code])])),
    average: mean(weeklyAverages),
    rows,
  };
}

export function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}
