import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/db/index.js';
import { loadContext } from '../src/services/context.js';
import { commitImport, parseWorkbook, summarize } from '../src/services/importer.js';
import { monthlyReport } from '../src/services/reports.js';
import { buildFixtureWorkbook } from './fixtures/build-workbook.js';

test('parses every sheet of a School_Manager-style workbook', async () => {
  const db = openDatabase(':memory:');
  const parsed = await parseWorkbook(await buildFixtureWorkbook(), db);

  assert.deepEqual(parsed.school, { name: 'ÉCOLE TEST', subtitle: 'TEST BILINGUAL SCHOOL', academicYear: '2026-2027' });
  assert.deepEqual(parsed.classes.map((c) => c.code), ['SIL', 'CP', '6EME']);
  assert.equal(parsed.pupils.length, 5);
  const p2 = parsed.pupils.find((p) => p.studentId === 'SIL-02');
  assert.equal(p2.gender, 'M');
  assert.equal(p2.dateOfBirth, '2020-03-04');
  assert.equal(p2.phone, '699 00 00 01');
  assert.equal(parsed.pupils.find((p) => p.studentId === 'SIL-03').status, 'Transferred');

  assert.equal(parsed.calendar.yearStart, '2026-09-01');
  assert.equal(parsed.calendar.week1Start, '2026-09-07');
  assert.equal(parsed.calendar.holidays.length, 10);
  assert.deepEqual(parsed.calendar.terms.map((t) => [t.number, t.start, t.end, t.uaMonths.join(',')]), [
    [1, '2026-09-07', '2026-12-11', '2026-10,2026-11,2026-12'],
    [2, '2027-01-04', '2027-03-19', '2027-01,2027-02,2027-03'],
    [3, '2027-04-05', '2027-06-25', '2027-04,2027-05,2027-06'],
  ]);

  assert.deepEqual(
    parsed.attendance.filter((a) => a.studentId === 'SIL-01').map((a) => `${a.date}:${a.mark}`),
    ['2026-09-07:P', '2026-09-08:A', '2026-09-09:L'],
  );
  // Weekly controls: W-formatted numbers and "W2" text; out-of-range and unknown IDs rejected
  assert.equal(parsed.controls.filter((c) => c.studentId === 'SIL-01').length, 4);
  assert.deepEqual(parsed.controls.filter((c) => c.studentId === '6EME-01').map((c) => `${c.week}:${c.subject}:${c.value}`), [
    '2:english:20',
    '2:scitech:10',
  ]);
  assert.equal(parsed.performance.filter((p) => p.date === '2026-09-07').length, 7);
  assert.equal(parsed.performance.filter((p) => p.date === '2026-09-08').length, 2);

  // Month_Card_Entry (October + "Novembre") and term-only disciplines from Term_Card_Entry
  const marksOf = (id, month) => Object.fromEntries(parsed.marks.filter((m) => m.studentId === id && m.month === month).map((m) => [m.discipline, m.value]));
  assert.deepEqual(marksOf('SIL-01', '2026-10'), { '1A': 30, '1B': 32, '2A': 24, '2B': 21, '4A': 15, '5A': 16, '1C': 15, '3A': 16, '3B': 14, '6A1': 18, '6B': 17 });
  assert.equal(Object.keys(marksOf('SIL-01', '2026-11')).length, 6);
  assert.equal(marksOf('6EME-02', '2026-10')['1A'], undefined); // 41 > 40 rejected
  assert.deepEqual(
    parsed.attitudes.map((a) => `${a.attitude}:${a.grade}`),
    ['religion:A+', 'spanish:B', 'virtue:A', 'punctuality:A+', 'homework:C', 'teamwork:A', 'instructions:B'],
  );
  assert.ok(parsed.warnings.some((w) => w.includes('NOPE-01')));
  assert.ok(parsed.warnings.some((w) => w.includes('out of 0–20')));
  assert.ok(parsed.warnings.some((w) => w.includes('"Z"')));

  const summary = summarize(parsed);
  assert.equal(summary.counts.pupils, 5);
  assert.deepEqual(summary.classes.map((c) => c.pupils), [3, 0, 2]);
});

test('roll call dates are rebuilt from month headers when no date row exists', async () => {
  const db = openDatabase(':memory:');
  const parsed = await parseWorkbook(await buildFixtureWorkbook({ withRollDates: false }), db);
  assert.deepEqual(
    parsed.attendance.filter((a) => a.studentId === 'SIL-01').map((a) => `${a.date}:${a.mark}`),
    ['2026-09-07:P', '2026-09-08:A', '2026-09-09:L'],
  );
  assert.ok(parsed.attendance.some((a) => a.studentId === 'SIL-02' && a.date === '2026-12-25'));
});

test('month headers stored as dates are understood too', async () => {
  const db = openDatabase(':memory:');
  const parsed = await parseWorkbook(await buildFixtureWorkbook({ withRollDates: false, dateMonthHeaders: true }), db);
  assert.deepEqual(
    parsed.attendance.filter((a) => a.studentId === 'SIL-01').map((a) => `${a.date}:${a.mark}`),
    ['2026-09-07:P', '2026-09-08:A', '2026-09-09:L'],
  );
});

test('commit replaces the school data and reports work on the imported marks', async () => {
  const db = openDatabase(':memory:');
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'demo_mode'").run();
  const parsed = await parseWorkbook(await buildFixtureWorkbook(), db);
  const result = commitImport(db, parsed, { mode: 'replace' });
  assert.equal(result.pupils, 5);
  assert.equal(result.attendance, 4); // the mark on Christmas Day is skipped
  assert.ok(result.skipped >= 1);
  assert.deepEqual(db.prepare('SELECT name FROM classes ORDER BY sort_order').all().map((c) => c.name), ['SIL', 'CP', '6ème']);
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'school_name'").get().value, 'ÉCOLE TEST');
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get().value, '0');
  assert.equal(db.prepare("SELECT max FROM disciplines WHERE code = '6A1'").get().max, 20);

  const ctx = loadContext(db, { today: '2026-10-14' });
  const sil = db.prepare("SELECT id FROM classes WHERE code = 'SIL'").get().id;
  const report = monthlyReport(db, ctx, sil, '2026-10');
  const row = report.rows.find((r) => r.studentId === 'SIL-01');
  assert.equal(row.total, 138);
  assert.equal(row.cote, 'A');
  // Transferred pupil without data is hidden from the class sheets
  assert.equal(report.rows.some((r) => r.studentId === 'SIL-03'), false);

  // Merge keeps details typed in the app when the workbook leaves them blank
  db.prepare("UPDATE pupils SET phone = '677 11 22 33' WHERE student_id = 'SIL-01'").run();
  commitImport(db, parsed, { mode: 'merge' });
  assert.equal(db.prepare("SELECT phone FROM pupils WHERE student_id = 'SIL-01'").get().phone, '677 11 22 33');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pupils').get().n, 5);
});
