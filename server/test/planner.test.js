import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { categorise, parsePlannerWorkbook, summarisePlanner } from '../src/services/calendarWorkbook.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, 'fixtures', 'planner-2026-2027.xlsx');

const real = fs.existsSync(FIXTURE) ? await parsePlannerWorkbook(fs.readFileSync(FIXTURE)) : null;

test('the school planner is read month block by month block', { skip: real ? false : 'planner fixture missing' }, () => {
  const { events } = real;
  assert.deepEqual(real.sheets, ['Août à Janvier', 'Février à Juillet']);
  assert.equal(real.title, 'Calendrier scolaire 2026-2027');
  assert.deepEqual(real.skipped, []);

  // every month of the school year, from the August teacher training to July
  const months = new Set(events.map((e) => e.date.slice(0, 7)));
  for (const key of ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07']) {
    assert.ok(months.has(key), `${key} is missing`);
  }

  const at = (date) => events.filter((e) => e.date === date).map((e) => e.title).join(' | ');
  assert.match(at('2026-08-03'), /Rentrée des enseignants/);
  assert.match(at('2026-09-07'), /Rentrée scolaire des élèves/);
  assert.match(at('2026-11-01'), /Toussaint/);
  assert.match(at('2026-12-25'), /Noël|Conge de Noel/);
  assert.match(at('2027-01-04'), /Rentrée du 2ème trimestre/);
  assert.match(at('2027-05-20'), /Fête Nationale/);
  assert.match(at('2027-07-14'), /Fête nationale/);

  assert.ok(events.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)));
  assert.ok(events.every((e) => e.title.length > 1 && e.title.length < 240));
});

test('a note written over several lines becomes one readable line', { skip: real ? false : 'planner fixture missing' }, () => {
  const dec18 = real.events.find((e) => e.date === '2026-12-18');
  // the cell repeats the same two sentences; they must appear once each, not twice
  assert.equal(dec18.title, "Fête de l'école-Noël sous l'AZOBÉ · Départ en congés");
  assert.equal(dec18.category, 'break');
  for (const e of real.events) {
    const half = e.title.length / 2;
    assert.ok(!(e.title.length > 24 && e.title.slice(0, Math.floor(half)) === e.title.slice(Math.ceil(half))), `repeated text: ${e.title}`);
  }
});

test('a day hidden under a block of merged text is still found', { skip: real ? false : 'planner fixture missing' }, () => {
  const at = (date) => real.events.filter((e) => e.date === date).map((e) => e.title).join(' | ');
  // June 1st–4th sit under a four-row merged note; May 11th–13th under a three-row one
  assert.match(at('2027-06-01'), /BEPC 2026/);
  assert.match(at('2027-06-02'), /BEPC 2026/);
  assert.match(at('2027-06-03'), /BEPC 2026/);
  assert.match(at('2027-05-11'), /Concours national/);
  assert.match(at('2027-05-12'), /Évaluation Finale/);
});

test('a month sharing a column with the next one does not borrow its day numbers', { skip: real ? false : 'planner fixture missing' }, () => {
  // the June block ends with a column merged into July's: without the trim, every June
  // note would come out as "… · 1", "… · 2", …
  const june = real.events.filter((e) => e.date.slice(0, 7) === '2027-06');
  assert.ok(june.length > 5);
  for (const e of june) assert.doesNotMatch(e.title, /(^|\s·\s)\d{1,2}$/, e.title);
});

test('notes are sorted into the kinds the calendar understands', { skip: real ? false : 'planner fixture missing' }, () => {
  const summary = summarisePlanner(real);
  assert.equal(summary.count, real.events.length);
  assert.equal(summary.from, '2026-08-03');
  assert.ok(summary.byCategory.exam > 10);
  assert.ok(summary.byCategory.break > 0);
  assert.ok(summary.byCategory.holiday > 0);
  assert.ok(summary.byCategory.deadline > 0);
  // one line per date, no two events with the same title on the same day
  const keys = new Set(real.events.map((e) => `${e.date}|${e.title}`));
  assert.equal(keys.size, real.events.length);
});

test('the kind of a date is read from its wording', () => {
  assert.equal(categorise('Départ en congés'), 'break');
  assert.equal(categorise('Congés de Pâques'), 'break');
  assert.equal(categorise('Évaluation 1 (primaire)'), 'exam');
  assert.equal(categorise('BEPC BLANC'), 'exam');
  assert.equal(categorise('Délai de dépôt des épreuves'), 'deadline');
  assert.equal(categorise('Fête Nationale'), 'holiday');
  assert.equal(categorise('Réunion des parents'), 'event');
});

// ---- Reading a workbook written differently ------------------------------------

async function buildSheet({ monthRow = 3, leadColumns = 0, yearRow = 2, months }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Planning');
  if (yearRow) {
    for (const m of months) ws.getCell(yearRow, leadColumns + m.col).value = m.year;
  }
  for (const m of months) {
    ws.getCell(monthRow, leadColumns + m.col).value = m.name;
    if (m.wide) ws.getCell(monthRow, leadColumns + m.col + 1).value = m.name;
  }
  for (const m of months) {
    let row = monthRow + 1;
    for (const day of m.days) {
      ws.getCell(row, leadColumns + m.col).value = day.day;
      ws.getCell(row, leadColumns + m.col + 1).value = day.wd ?? '';
      ws.getCell(row, leadColumns + m.col + 2).value = day.note ?? '';
      row += 1;
    }
  }
  return wb.xlsx.writeBuffer();
}

test('the layout is found, not assumed: extra columns, another header row, whole-day blocks', async () => {
  const buffer = await buildSheet({
    monthRow: 4,
    leadColumns: 3,
    months: [
      {
        name: 'Septembre',
        year: 2026,
        col: 1,
        days: [
          { day: 1, wd: 'Ma', note: 'Préparation' },
          { day: 2, wd: 'Me' },
          { day: 7, wd: 'Lu', note: 'Rentrée\ndes élèves' },
        ],
      },
      {
        name: 'Octobre',
        year: 2026,
        col: 5,
        days: [
          { day: 1, wd: 'Je', note: 'Fête du Travail' },
          { day: 5, wd: 'Lu', note: 'Journée de l’enseignant' },
        ],
      },
    ],
  });
  const parsed = await parsePlannerWorkbook(buffer);
  assert.deepEqual(
    parsed.events.map((e) => [e.date, e.title]),
    [
      ['2026-09-01', 'Préparation'],
      ['2026-09-07', 'Rentrée · des élèves'],
      ['2026-10-01', 'Fête du Travail'],
      ['2026-10-05', 'Journée de l’enseignant'],
    ],
  );
});

test('a workbook with no row of month names is refused with a clear reason', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Notes');
  ws.getCell(1, 1).value = 'Just a list';
  ws.getCell(2, 1).value = 'of things';
  const buffer = await wb.xlsx.writeBuffer();
  const parsed = await parsePlannerWorkbook(buffer);
  assert.deepEqual(parsed.events, []);
  assert.deepEqual(parsed.sheets, []);
  assert.deepEqual(parsed.skipped, ['Notes']);
});
