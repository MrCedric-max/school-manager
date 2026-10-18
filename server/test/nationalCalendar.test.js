import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from '../src/db/index.js';
import { addDays } from '../src/lib/dates.js';
import { buildCalendar } from '../src/lib/calendar.js';
import {
  BACKBONE_2026_2027,
  dateFromWeekParts,
  eventCycle,
  easterSunday,
  isoWeekParts,
  nextLabel,
  planBackbone,
  rollOverBackbone,
  sameWeekdayNextYear,
  schoolDaysPerMonth,
  uaMonthsForTerm,
  validateBackbone,
} from '../src/lib/nationalCalendar.js';
import { loadContext } from '../src/services/context.js';
import {
  activeYear,
  applyYearToCalendar,
  ensureCurrentYear,
  previewYear,
  readEvents,
  rollOverYear,
  saveYearBackbone,
  setYearStatus,
} from '../src/services/schoolYears.js';

function freshDb() {
  const db = openDatabase(':memory:');
  return db;
}

// ---- The backbone -------------------------------------------------------------

test('the official 2026-2027 dates are the ones in the arrêté', () => {
  assert.equal(BACKBONE_2026_2027.anchors.pupilReturn, '2026-09-07');
  assert.equal(BACKBONE_2026_2027.anchors.classesEnd, '2027-06-11');
  assert.equal(BACKBONE_2026_2027.anchors.yearEnd, '2027-07-30');
  assert.deepEqual(
    BACKBONE_2026_2027.breaks.map((b) => [b.start, b.end]),
    [
      ['2026-12-18', '2027-01-04'],
      ['2027-03-25', '2027-04-12'],
    ],
  );
});

test('a term split by a holiday keeps both parts, and the days between are not school days', () => {
  const plan = planBackbone(BACKBONE_2026_2027);
  const term2 = plan.terms.find((t) => t.number === 2);
  assert.deepEqual(
    term2.segments.map((s) => [s.start, s.end]),
    [
      ['2026-11-30', '2026-12-18'],
      ['2027-01-04', '2027-03-05'],
    ],
  );
  assert.equal(term2.start, '2026-11-30');
  assert.equal(term2.end, '2027-03-05');

  const calendar = buildCalendar({
    yearStart: BACKBONE_2026_2027.yearStart,
    yearEnd: '2027-03-31',
    week1Start: BACKBONE_2026_2027.week1Start,
    terms: plan.terms.map((t) => ({ number: t.number, name: t.name, start_date: t.start, end_date: t.end, ua_months: t.uaMonths })),
    holidays: plan.holidays,
    breaks: BACKBONE_2026_2027.breaks,
  });
  assert.equal(calendar.dayByDate.get('2026-12-18').type, 'break'); // last day before Christmas
  assert.equal(calendar.dayByDate.get('2027-01-04').type, 'break'); // first day back is in the break range
  assert.equal(calendar.dayByDate.get('2026-12-25').type, 'holiday'); // Christmas stays a public holiday
  assert.equal(calendar.dayByDate.get('2027-01-05').type, 'school');
  assert.equal(calendar.dayByDate.get('2026-12-19').type, 'weekend'); // a Saturday is a Saturday
});

test('the three UA months of a term are the ones with the most school days', () => {
  const plan = planBackbone(BACKBONE_2026_2027);
  assert.deepEqual(plan.terms.find((t) => t.number === 1).uaMonths, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(plan.terms.find((t) => t.number === 2).uaMonths, ['2026-12', '2027-01', '2027-02']);
  assert.deepEqual(plan.terms.find((t) => t.number === 3).uaMonths, ['2027-03', '2027-04', '2027-05']);
  // a term that stops in the middle of a month does not take that month
  const short = uaMonthsForTerm(
    { segments: [{ start: '2027-03-08', end: '2027-03-25' }] },
    { holidays: plan.holidays, breaks: BACKBONE_2026_2027.breaks },
  );
  assert.deepEqual(short, ['2027-03']);
});

test('school days per month skip weekends, holidays and breaks', () => {
  const perMonth = schoolDaysPerMonth({
    from: '2026-12-01',
    to: '2026-12-31',
    holidays: [{ date: '2026-12-25' }],
    breaks: [{ start: '2026-12-18', end: '2027-01-04' }],
  });
  // 1–17 December 2026 is 13 weekdays; from the 18th the Christmas break takes over, and
  // Christmas Day itself is inside that break (so nothing is subtracted twice).
  assert.equal(perMonth.get('2026-12'), 13);
});

test('term school days add up to about 35 weeks of classes', () => {
  const plan = planBackbone(BACKBONE_2026_2027);
  const total = plan.terms.reduce((a, t) => a + t.schoolDays, 0);
  assert.ok(total > 165 && total < 190, `${total} school days`);
  assert.deepEqual(plan.terms.map((t) => t.schoolDays).length, 3);
});

// ---- Moving a year forward ----------------------------------------------------

test('a date keeps its week and weekday when the year moves on', () => {
  assert.deepEqual(isoWeekParts('2026-09-07'), { year: 2026, week: 37, dow: 0 });
  assert.equal(sameWeekdayNextYear('2026-09-07'), '2027-09-13'); // Monday of week 37
  assert.equal(sameWeekdayNextYear('2026-12-18'), '2027-12-24'); // Friday of week 51
  assert.equal(dateFromWeekParts(2027, 37, 0), '2027-09-13');
});

test('rolling a year over produces a draft of the following year', () => {
  const draft = rollOverBackbone(BACKBONE_2026_2027, '2027-2028');
  assert.equal(nextLabel('2026-2027'), '2027-2028');
  assert.equal(draft.reference, ''); // a draft is never presented as official
  assert.equal(draft.anchors.pupilReturn, '2027-09-13');
  assert.equal(draft.breaks[0].start, '2027-12-24');
  assert.equal(draft.terms[0].segments[0].start, '2027-09-13');
  assert.equal(draft.terms.at(-1).segments.at(-1).end, '2028-06-09');
  assert.ok(draft.holidays.every((h) => h.date >= draft.yearStart || h.date <= draft.yearEnd));
  // a fixed date keeps its day of the month; a movable one follows Easter
  const byName = (needle) => draft.holidays.find((h) => h.name.includes(needle))?.date;
  assert.equal(byName('National Day'), '2028-05-20');
  assert.equal(byName('Christmas Day'), '2027-12-25');
  assert.equal(byName('New Year'), '2028-01-01');
  assert.equal(byName('Good Friday'), '2028-04-14'); // Friday before Easter 2028 (16 April)
});

test('a backbone that has been saved keeps how each holiday moves', () => {
  const { value, errors } = validateBackbone(BACKBONE_2026_2027);
  assert.deepEqual(errors, []);
  const named = (list, needle) => list.find((h) => h.name.includes(needle));
  assert.equal(named(value.holidays, 'Good Friday').easter, -2);
  assert.equal(named(value.holidays, 'Whit Monday').easter, 50);
  assert.equal(named(value.holidays, 'Eid al-Fitr').movable, true);
  assert.equal(named(value.holidays, 'National Day').easter, undefined);

  // two years on the Easter feasts still hang off Easter, not off a week of the year
  const later = rollOverBackbone(rollOverBackbone(value, '2027-2028'), '2028-2029');
  assert.equal(named(later.holidays, 'Good Friday').date, addDays(easterSunday(2029), -2));
  assert.equal(named(later.holidays, 'Easter Monday').date, addDays(easterSunday(2029), 1));
  assert.equal(named(later.holidays, 'Ascension').date, addDays(easterSunday(2029), 39));
  assert.equal(named(later.holidays, 'Whit Monday').date, addDays(easterSunday(2029), 50));
  // and the list stays in the order of the year
  assert.deepEqual(later.holidays.map((h) => h.date), [...later.holidays.map((h) => h.date)].sort());
});

// ---- Checking what comes from the browser -------------------------------------

test('a backbone sent by the browser is checked before it is stored', () => {
  const { errors, value } = validateBackbone(BACKBONE_2026_2027);
  assert.deepEqual(errors, []);
  assert.equal(value.terms.length, 3);

  const bad = validateBackbone({
    yearStart: '2027-09-01',
    yearEnd: '2027-07-31',
    week1Start: '2027-09-08',
    terms: [{ number: 1, name: 'T1', segments: [{ start: '2027-09-13', end: '2027-09-01' }] }],
  });
  assert.ok(bad.errors.some((e) => /must end after it starts/.test(e)));
  assert.ok(bad.errors.some((e) => /ends before it starts/.test(e)));
  assert.ok(bad.errors.some((e) => /Week 1 must start on a Monday/.test(e)));
});

// ---- Applying a year to the calendar ------------------------------------------

test('applying the national calendar rewrites the terms, holidays and official events', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  assert.equal(year.label, '2026-2027');
  assert.equal(year.status, 'active');

  const result = applyYearToCalendar(db, year.id);
  assert.ok(result.terms.some((t) => t.changed), 'the stored terms did not match the official ones');
  const term1 = result.terms.find((t) => t.number === 1);
  assert.deepEqual(term1.to, { start: '2026-09-07', end: '2026-11-27', uaMonths: ['2026-09', '2026-10', '2026-11'] });

  const terms = db.prepare('SELECT number, start_date, end_date, ua_months FROM terms ORDER BY number').all();
  assert.deepEqual(terms.map((t) => [t.start_date, t.end_date]), [
    ['2026-09-07', '2026-11-27'],
    ['2026-11-30', '2027-03-05'],
    ['2027-03-08', '2027-06-11'],
  ]);

  const holidays = db.prepare("SELECT date, name, source FROM holidays WHERE source = 'national' ORDER BY date").all();
  assert.ok(holidays.length >= 10);
  assert.equal(holidays[0].date, '2026-11-01');

  const official = db.prepare("SELECT date, end_date, title, category FROM events WHERE source = 'national' ORDER BY date").all();
  assert.ok(official.some((e) => e.title.includes('Rentrée scolaire')));
  assert.ok(official.some((e) => e.category === 'break' && e.date === '2026-12-18' && e.end_date === '2027-01-04'));
  assert.ok(official.some((e) => e.category === 'exam'));

  // and the calendar really uses them: 25 December is a holiday even though it is a Saturday
  const ctx = loadContext(db);
  const day = ctx.calendar.dayByDate.get('2027-01-04');
  assert.equal(day.type, 'break');
  assert.equal(ctx.calendar.dayByDate.get('2027-01-05').type, 'school');
  closeDatabase();
});

test('the two cycles have their own exam dates: MINESEC for the college, MINEDUB for the primary', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  applyYearToCalendar(db, year.id);

  const exams = db
    .prepare("SELECT date, end_date, title, cycle FROM events WHERE source = 'national' AND category = 'exam' ORDER BY date, title")
    .all();
  // Official secondary exams open on 19 April (MINESEC) while the primary sits its own
  // papers from 10 May (MINEDUB): a date that concerns one cycle is not shown to the other.
  const college = exams.filter((e) => e.cycle === 'college').map((e) => [e.date, e.end_date, e.title]);
  const primary = exams.filter((e) => e.cycle === 'primary').map((e) => [e.date, e.end_date, e.title]);
  assert.deepEqual(college, [
    ['2027-04-14', '2027-04-17', 'Mock exams, secondary / Examens blancs (secondaire)'],
    ['2027-04-19', '2027-07-30', 'Official exams, secondary / Examens officiels (secondaire)'],
    ['2027-04-26', '2027-05-07', 'Practical PE exams / Épreuves pratiques d’EPS'],
    ['2027-05-03', '2027-05-21', 'Internal evaluations, secondary / Évaluations internes (secondaire)'],
  ]);
  assert.deepEqual(primary, [
    ['2027-04-14', '2027-04-17', 'Mock exams, primary / Épreuves zéro (primaire)'],
    ['2027-05-10', '2027-07-30', 'Official exams, primary / Examens officiels (primaire)'],
  ]);

  // The school-wide dates (rentrée, breaks, end of classes) belong to nobody in particular.
  const anchors = db.prepare("SELECT cycle FROM events WHERE source = 'national' AND category <> 'exam'").all();
  assert.equal(anchors.length > 0, true);
  assert.equal(anchors.every((e) => e.cycle === ''), true);
  closeDatabase();
});

test('reading the events of one cycle keeps that cycle and the whole school', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  applyYearToCalendar(db, year.id);

  const all = readEvents(db, { limit: 2000 });
  const college = readEvents(db, { cycle: 'college', limit: 2000 });
  const primary = readEvents(db, { cycle: 'primary', limit: 2000 });
  assert.ok(college.length < all.length && primary.length < all.length);
  assert.equal(college.every((e) => e.cycle === '' || e.cycle === 'college'), true);
  assert.equal(primary.every((e) => e.cycle === '' || e.cycle === 'primary'), true);
  assert.equal(college.some((e) => /secondaire/.test(e.title)), true);
  // The college does not sit the primary's official exams and the other way round.
  assert.equal(college.some((e) => /Examens officiels \(primaire\)/.test(e.title)), false);
  assert.equal(primary.some((e) => /Examens officiels \(secondaire\)/.test(e.title)), false);
  // Both keep the rentrée.
  for (const list of [college, primary]) assert.ok(list.some((e) => e.title.includes('Rentrée scolaire')));
  closeDatabase();
});

test('a cycle chosen when a date is added by hand is kept, and anything else falls back to the whole school', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  const stmt = db.prepare(
    `INSERT INTO events (date, end_date, title, category, cycle, source, school_year_id)
     VALUES (?, ?, ?, 'event', ?, 'manual', ?)`,
  );
  stmt.run('2027-06-01', null, 'End-of-year outing', eventCycle('college'), year.id);
  stmt.run('2027-06-02', null, 'Staff meeting', eventCycle(' nonsense '), year.id);
  const rows = readEvents(db, { limit: 2000 }).filter((e) => e.source === 'manual');
  assert.deepEqual(rows.map((e) => [e.title, e.cycle]), [
    ['End-of-year outing', 'college'],
    ['Staff meeting', ''],
  ]);
  closeDatabase();
});

test('rolling the year over keeps which cycle each exam period concerns', () => {
  const rolled = rollOverBackbone(BACKBONE_2026_2027, '2027-2028');
  const exams = planBackbone(rolled).events.filter((e) => e.category === 'exam');
  assert.equal(exams.length, 6);
  assert.equal(exams.filter((e) => e.cycle === 'college').length, 4);
  assert.equal(exams.filter((e) => e.cycle === 'primary').length, 2);
});

test('a holiday the school added by hand survives a re-sync', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  applyYearToCalendar(db, year.id);
  db.prepare("INSERT INTO holidays (date, name, source) VALUES ('2027-04-02', 'Fête de l’école', 'manual')").run();
  applyYearToCalendar(db, year.id);
  const kept = db.prepare("SELECT source FROM holidays WHERE date = '2027-04-02'").get();
  assert.equal(kept.source, 'manual');
  closeDatabase();
});

test('the preview says what will change without changing it', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  const before = db.prepare('SELECT start_date, end_date FROM terms WHERE number = 1').get();
  const preview = previewYear(db, year.id);
  assert.ok(preview.terms.some((t) => t.changed));
  assert.deepEqual(
    db.prepare('SELECT start_date, end_date FROM terms WHERE number = 1').get(),
    before,
    'the preview must not touch the calendar',
  );
  closeDatabase();
});

// ---- Years on file ------------------------------------------------------------

test('next year is drafted, and activating it archives the one before', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  const draft = rollOverYear(db, year.id);
  assert.equal(draft.label, '2027-2028');
  assert.equal(draft.status, 'draft');
  assert.ok(draft.notes.includes('Draft'));

  assert.throws(() => rollOverYear(db, year.id), /already exists/);

  setYearStatus(db, draft.id, 'active');
  assert.equal(activeYear(db).label, '2027-2028');
  const archived = db.prepare('SELECT status FROM school_years WHERE id = ?').get(year.id);
  assert.equal(archived.status, 'archived');
  closeDatabase();
});

test('the dates of a year can be corrected by hand', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  const year = activeYear(db);
  const edited = {
    ...year.backbone,
    terms: year.backbone.terms.map((t) =>
      t.number === 3 ? { ...t, segments: [{ start: '2027-04-12', end: '2027-06-18' }] } : t,
    ),
  };
  saveYearBackbone(db, year.id, edited);
  const saved = activeYear(db);
  assert.equal(saved.backbone.terms[2].segments[0].end, '2027-06-18');
  assert.throws(() => saveYearBackbone(db, year.id, { ...edited, yearEnd: 'not a date' }), /must be a date/);
  closeDatabase();
});

test('a database from before this feature gets a year built from what it already held', () => {
  const db = freshDb();
  db.prepare('DELETE FROM school_years').run();
  db.prepare("UPDATE settings SET value = '2019-2020' WHERE key = 'academic_year'").run();
  const id = ensureCurrentYear(db);
  const year = db.prepare('SELECT * FROM school_years WHERE id = ?').get(id);
  assert.equal(year.label, '2019-2020');
  assert.equal(year.status, 'active');
  const backbone = JSON.parse(year.official);
  assert.equal(backbone.terms.length, 3); // rebuilt from the terms already in the app
  assert.deepEqual(backbone.breaks, []);
  closeDatabase();
});

test('the school year covers the whole year it claims', () => {
  const db = freshDb();
  ensureCurrentYear(db);
  applyYearToCalendar(db, activeYear(db).id);
  const ctx = loadContext(db);
  assert.equal(ctx.settings.academicYear, '2026-2027');
  assert.ok(ctx.calendar.summary.schoolDays > 150);
  // 30 July is the last day of the year, 31 July is not a school day
  assert.equal(ctx.calendar.dayByDate.get('2027-07-30').term, null);
  assert.ok(addDays('2027-07-30', 1) === '2027-07-31');
  closeDatabase();
});
