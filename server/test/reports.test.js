import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getDb, openDatabase } from '../src/db/index.js';
import { round } from '../src/lib/grading.js';
import { loadContext } from '../src/services/context.js';
import { dashboard, statistics } from '../src/services/insights.js';
import { monthlyCards, monthlyReport, termCards, termReport, weeklyReport } from '../src/services/reports.js';

let db;
let ctx;
let classId;
const ids = {};

before(() => {
  db = openDatabase(':memory:');
  classId = db.prepare("SELECT id FROM classes WHERE code = 'CE2'").get().id;
  const add = db.prepare('INSERT INTO pupils (student_id, class_id, class_no, full_name) VALUES (?, ?, ?, ?)');
  for (const [i, name] of ['PUPIL ALPHA', 'PUPIL BRAVO', 'PUPIL CHARLIE'].entries()) {
    ids[i] = Number(add.run(`CE2-0${i + 1}`, classId, i + 1, name).lastInsertRowid);
  }
  const mark = db.prepare('INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?)');
  const marks = (pupil, month, values) => {
    for (const [code, value] of Object.entries(values)) mark.run(pupil, month, code, value);
  };
  // Pupil A — October and November, full framework
  marks(ids[0], '2026-10', { '1A': 30, '1B': 32, '2A': 24, '2B': 21, '4A': 15, '5A': 16, '1C': 15, '3A': 16, '3B': 14, '6A1': 18, '6B': 17 });
  marks(ids[0], '2026-11', { '1A': 35, '1B': 36, '2A': 27, '2B': 27, '4A': 18, '5A': 18, '1C': 18, '3A': 18, '3B': 18, '6A1': 19, '6B': 19 });
  // Pupil B — October, monthly-card disciplines only, all maximum
  marks(ids[1], '2026-10', { '1A': 40, '1B': 40, '2A': 30, '2B': 30, '4A': 20, '5A': 20 });

  const perf = db.prepare('INSERT INTO performance_marks (pupil_id, date, area, value) VALUES (?, ?, ?, ?)');
  for (const area of ['assignments', 'participation', 'order', 'discipline', 'cleanliness', 'respect', 'obedience']) {
    perf.run(ids[0], '2026-10-05', area, 8);
    perf.run(ids[0], '2026-10-06', area, 6);
  }
  const att = db.prepare('INSERT INTO attendance (pupil_id, date, mark) VALUES (?, ?, ?)');
  att.run(ids[0], '2026-10-05', 'P');
  att.run(ids[0], '2026-10-06', 'L');
  att.run(ids[0], '2026-10-07', 'A');
  const ctrl = db.prepare('INSERT INTO control_marks (pupil_id, week, subject, value) VALUES (?, ?, ?, ?)');
  ctrl.run(ids[0], 5, 'english', 12);
  ctrl.run(ids[0], 5, 'maths', 16);
  ctrl.run(ids[0], 5, 'french', 14);
  ctrl.run(ids[0], 5, 'scitech', 18);
  db.prepare("INSERT INTO attitude_grades (pupil_id, month, attitude, grade) VALUES (?, '2026-10', 'religion', 'A+')").run(ids[0]);
  db.prepare("INSERT INTO remarks (pupil_id, period, text) VALUES (?, 'M:2026-10', 'Bon travail')").run(ids[0]);
  ctx = loadContext(getDb(), { today: '2026-10-14' });
});

test('weekly report: controls average, attendance and rank', () => {
  const r = weeklyReport(db, ctx, classId, 5);
  assert.equal(r.week.dates.length, 5);
  const a = r.rows.find((x) => x.pupilId === ids[0]);
  assert.equal(a.controlsAverage, 15);
  assert.equal(a.controlsCote, 'A');
  assert.equal(a.performanceAverage, 7);
  assert.deepEqual([a.attendance.P, a.attendance.A, a.attendance.L, a.attendance.E], [1, 1, 1, 0]);
  assert.equal(round(a.attendance.rate, 4), round(2 / 3, 4));
  assert.equal(a.rank, 1);
  assert.equal(r.rows.find((x) => x.pupilId === ids[1]).rank, null);
  assert.equal(r.counts.controlsLogged, 1);
  assert.equal(r.counts.performanceEntries, 2);
  assert.equal(r.counts.rollMarks, 3);
});

test('monthly report: /180 totals, cote, overall 70/30 and rank', () => {
  const r = monthlyReport(db, ctx, classId, '2026-10');
  const a = r.rows.find((x) => x.pupilId === ids[0]);
  assert.deepEqual(a.competences, { 1: 62, 2: 45, 4: 15, 5: 16 });
  assert.equal(a.total, 138);
  assert.equal(round(a.average, 4), round((138 / 180) * 20, 4));
  assert.equal(a.cote, 'A');
  assert.equal(a.performanceAverage, 7);
  assert.equal(round(a.overall, 4), round(0.7 * ((138 / 180) * 20) + 0.3 * 14, 4));
  assert.equal(a.controls.english, 12); // W5 is inside October (W4–W8)
  const b = r.rows.find((x) => x.pupilId === ids[1]);
  assert.equal(b.total, 180);
  assert.equal(b.cote, 'A+');
  assert.equal(b.overall, 20); // no performance data → academic average alone
  assert.equal(b.rank, 1);
  assert.equal(a.rank, 2);
  assert.equal(r.counts.studentsEvaluated, 2);
  assert.equal(round(r.counts.classAverage, 4), round(((138 / 180) * 20 + 20) / 2, 4));
});

test('term report: averages of the UA months', () => {
  const r = termReport(db, ctx, classId, 1);
  const a = r.rows.find((x) => x.pupilId === ids[0]);
  assert.equal(a.monthly[0].full.total, 218);
  assert.equal(a.monthly[1].full.total, 253);
  assert.equal(a.monthly[2].full.total, null);
  assert.equal(a.total, (218 + 253) / 2);
  assert.equal(round(a.average, 4), round(235.5 / 14, 4));
  assert.equal(a.cote, 'A');
  assert.equal(a.competences[1], (77 + 89) / 2);
  const b = r.rows.find((x) => x.pupilId === ids[1]);
  assert.equal(b.total, 180);
  assert.equal(b.cote, 'ECA/B');
  assert.equal(a.rank, 1);
  assert.equal(b.rank, 2);
  assert.equal(round(r.counts.classAverageByMonth[0], 4), round((218 / 14 + 180 / 14) / 2, 4));
  assert.equal(r.counts.classAverageByMonth[2], null);
});

test('monthly report card', () => {
  const cards = monthlyCards(db, ctx, classId, '2026-10', ids[0]);
  assert.equal(cards.cards.length, 1);
  const card = cards.cards[0];
  assert.deepEqual(card.competences.map((c) => [c.number, c.note, c.max, c.cote]), [
    [1, 62, 80, 'A'],
    [2, 45, 60, 'A'],
    [4, 15, 20, 'A'],
    [5, 16, 20, 'A'],
  ]);
  assert.deepEqual(card.competences[0].disciplines.map((d) => [d.code, d.note, d.cote]), [
    ['1A', 30, 'A'],
    ['1B', 32, 'A'],
  ]);
  assert.equal(card.total.max, 180);
  assert.equal(card.rank, 2);
  assert.equal(cards.ranked, 2);
  assert.equal(card.remarks, 'Bon travail');
  assert.equal(cards.school.name, 'ÉCOLE AZOBE');
});

test('term report card with UA columns and attitudes', () => {
  const cards = termCards(db, ctx, classId, 1, ids[0]);
  const card = cards.cards[0];
  const d1a = card.competences[0].disciplines[0];
  assert.equal(d1a.code, '1A');
  assert.deepEqual(d1a.ua.map((u) => u.note), [30, 35, null]);
  assert.equal(d1a.term.note, 32.5);
  assert.equal(d1a.term.cote, 'A');
  assert.deepEqual(card.totals.ua, [218, 253, null]);
  assert.equal(card.totals.max, 280);
  assert.equal(card.attitudes[0].code, 'religion');
  assert.deepEqual(card.attitudes[0].ua, ['A+', null, null]);
  assert.equal(card.rank, 1);
});

test('statistics: per-discipline and per-competence percentages', () => {
  const s = statistics(db, ctx, classId, 5, '2026-10');
  const d1a = s.disciplines.find((d) => d.code === '1A');
  assert.equal(d1a.average, 35);
  assert.equal(d1a.pct, 35 / 40);
  const c1 = s.competences.find((c) => c.number === 1);
  assert.equal(c1.average, (77 + 80) / 2);
  assert.equal(s.controlsBySubject.find((c) => c.code === 'maths').average, 16);
  assert.equal(s.attendance.counts.P, 1);
});

test('dashboard totals', () => {
  const d = dashboard(db, ctx);
  assert.equal(d.totals.monthlyEvaluations, 3);
  assert.equal(d.totals.registered, 3);
  assert.equal(d.totals.schoolDays, 180);
  assert.equal(d.today.week, 6);
  assert.equal(d.coteDistribution.find((c) => c.code === 'A+').count, 1);
  assert.equal(d.coteDistribution.find((c) => c.code === 'A').count, 2);
  const ce2 = d.perClass.find((c) => c.code === 'CE2');
  assert.equal(ce2.studentsEvaluated, 2);
  assert.equal(ce2.controlsAverage, 15);
});
