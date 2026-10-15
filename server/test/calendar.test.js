import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_HOLIDAYS, DEFAULT_TERMS } from '../src/db/defaults.js';
import { buildCalendar, describeDay, latestSchoolDay, weekOf } from '../src/lib/calendar.js';

const calendar = buildCalendar({
  yearStart: '2026-09-01',
  yearEnd: '2027-07-31',
  week1Start: '2026-09-07',
  terms: DEFAULT_TERMS,
  holidays: DEFAULT_HOLIDAYS.map(([date, name]) => ({ date, name })),
});

test('school year summary matches the Calendar sheet', () => {
  assert.deepEqual(calendar.summary, {
    firstSchoolDay: '2026-09-07',
    lastSchoolDay: '2027-06-25',
    schoolDays: 180,
    publicHolidays: 10,
    breakWeekdays: 50,
  });
});

test('months match the Lists sheet (first/last weekday, week range, UA term)', () => {
  const expected = {
    '2026-09': ['2026-09-01', '2026-09-30', 1, 4, null],
    '2026-10': ['2026-10-01', '2026-10-30', 4, 8, 1],
    '2026-11': ['2026-11-02', '2026-11-30', 9, 13, 1],
    '2026-12': ['2026-12-01', '2026-12-31', 13, 17, 1],
    '2027-01': ['2027-01-01', '2027-01-29', 17, 21, 2],
    '2027-02': ['2027-02-01', '2027-02-26', 22, 25, 2],
    '2027-03': ['2027-03-01', '2027-03-31', 26, 30, 2],
    '2027-04': ['2027-04-01', '2027-04-30', 30, 34, 3],
    '2027-05': ['2027-05-03', '2027-05-31', 35, 39, 3],
    '2027-06': ['2027-06-01', '2027-06-30', 39, 43, 3],
    '2027-07': ['2027-07-01', '2027-07-30', 43, 47, null],
  };
  assert.equal(calendar.months.length, 11);
  for (const m of calendar.months) {
    assert.deepEqual([m.firstDay, m.lastDay, m.weekFrom, m.weekTo, m.uaTerm], expected[m.key], m.key);
  }
});

test('terms: week ranges and school days', () => {
  assert.deepEqual(
    calendar.terms.map((t) => [t.weekFrom, t.weekTo, t.schoolDays]),
    [
      [1, 14, 70],
      [18, 28, 53],
      [31, 42, 57],
    ],
  );
});

test('day types follow the workbook colours', () => {
  const type = (d) => calendar.dayByDate.get(d).type;
  assert.equal(type('2026-09-04'), 'break'); // before term 1
  assert.equal(type('2026-09-07'), 'school');
  assert.equal(type('2026-09-12'), 'weekend');
  assert.equal(type('2027-02-11'), 'holiday'); // Youth Day, in term 2
  assert.equal(type('2027-05-01'), 'holiday'); // Labour Day on a Saturday
  assert.equal(type('2026-12-14'), 'break');
  assert.equal(calendar.dayByDate.get('2027-02-11').term, 2);
  assert.equal(calendar.dayByDate.get('2026-12-12').term, null);
});

test('week numbers count from Monday 7 September 2026', () => {
  assert.equal(weekOf('2026-09-06', '2026-09-07'), null);
  assert.equal(weekOf('2026-09-07', '2026-09-07'), 1);
  assert.equal(weekOf('2026-10-14', '2026-09-07'), 6);
  assert.equal(weekOf('2027-07-31', '2026-09-07'), 47);
  assert.equal(calendar.weeks.length, 47);
  assert.equal(calendar.weeks[0].monday, '2026-09-07');
  assert.equal(calendar.weeks[5].schoolDays, 5);
  assert.equal(calendar.weeks[14].schoolDays, 0); // W15 = Christmas break
});

test('describeDay and latestSchoolDay', () => {
  assert.deepEqual(describeDay(calendar, '2026-10-14'), {
    date: '2026-10-14', week: 6, term: 1, type: 'school', holiday: null, month: '2026-10',
  });
  assert.equal(describeDay(calendar, '2026-12-25').holiday, 'Christmas Day / Noël');
  assert.equal(latestSchoolDay(calendar, '2026-10-17'), '2026-10-16');
  assert.equal(latestSchoolDay(calendar, '2026-08-01'), '2026-09-07');
});
