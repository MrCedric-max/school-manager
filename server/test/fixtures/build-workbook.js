// Builds a workbook with the same layout as School_Manager.xlsx (sheet names,
// title rows, header texts, merged month headers…) filled with FAKE pupils.
import ExcelJS from 'exceljs';
import { buildCalendar } from '../../src/lib/calendar.js';
import { DEFAULT_HOLIDAYS, DEFAULT_TERMS } from '../../src/db/defaults.js';
import { MONTH_NAMES, addDays, dayOfWeek } from '../../src/lib/dates.js';

const d = (iso) => new Date(`${iso}T00:00:00Z`);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const FIXTURE_PUPILS = [
  { id: 'SIL-01', cls: 'SIL', no: 1, name: 'TESTA ALPHA JEAN' },
  { id: 'SIL-02', cls: 'SIL', no: 2, name: 'TESTB BRAVO PAUL', gender: 'M', dob: '2020-03-04', guardian: 'TESTB SENIOR', phone: '699 00 00 01' },
  { id: 'SIL-03', cls: 'SIL', no: 3, name: 'TESTC CHARLIE MARIE', status: 'Transferred' },
  { id: '6EME-01', cls: '6ème', no: 1, name: 'TESTD DELTA LUC' },
  { id: '6EME-02', cls: '6ème', no: 2, name: 'TESTE ECHO ANNE', gender: 'F' },
];

export async function buildFixtureWorkbook({ withRollDates = true, dateMonthHeaders = false } = {}) {
  const wb = new ExcelJS.Workbook();
  const terms = DEFAULT_TERMS;
  const holidays = DEFAULT_HOLIDAYS.map(([date, name]) => ({ date, name }));
  const cal = buildCalendar({ yearStart: '2026-09-01', yearEnd: '2027-07-31', week1Start: '2026-09-07', terms, holidays });

  // Dashboard
  const dash = wb.addWorksheet('Dashboard');
  dash.getCell('A1').value = 'ÉCOLE TEST — SCHOOL MANAGEMENT DASHBOARD — 2026/2027';

  // Lists
  const lists = wb.addWorksheet('Lists');
  lists.getCell('A1').value = 'REFERENCE LISTS — used by dropdowns & formulas / Listes de référence';
  lists.getRow(3).values = ['Class / Classe', 'Code (internal)', null, 'Month', 'N°', 'Year', 'First day', 'Last day', 'Week from', 'Week to', 'UA month of', null, 'Term', 'Start', 'End', 'UA1 month', 'UA2 month', 'UA3 month', 'Week from', 'Week to'];
  const classes = [['SIL', 'SIL'], ['CP', 'CP'], ['6ème', '6EME']];
  classes.forEach(([name, code], i) => {
    lists.getCell(4 + i, 1).value = name;
    lists.getCell(4 + i, 2).value = code;
  });
  const monthName = (key) => MONTH_NAMES.en[Number(key.slice(5, 7)) - 1];
  terms.forEach((t, i) => {
    const row = lists.getRow(4 + i);
    row.getCell(13).value = t.name;
    row.getCell(14).value = d(t.start_date);
    row.getCell(15).value = d(t.end_date);
    t.ua_months.forEach((m, j) => {
      row.getCell(16 + j).value = monthName(m);
    });
  });
  lists.getCell('M8').value = 'Class';
  lists.getCell('N8').value = 'Roll 1st row';
  lists.getRow(20).values = ['COMPETENCE FRAMEWORK / REFERENTIEL DE COMPETENCES (per official report card)'];
  lists.getRow(21).values = ['Competence', 'Code', 'Discipline (as on report card)', 'Max', 'Competence total', "Critères d'évaluation"];
  const framework = [
    ['COMPETENCE 1', '1A', 'Communiquer en Français (40 points)', 40, 100, '1: Orale 10 pts ; 2: Écrite 15 pts (15 pts pour le savoir-être)'],
    ['COMPETENCE 1', '1B', 'Communicate in English (40 marks)', 40, 100, '1: Oral 20 marks ; 2: Written 15 marks (5 marks for attitudes)'],
    ['COMPETENCE 6', '6A1', 'Pratiquer les activités physiques et sportives / Practise physical sports (20 points)', 20, 40, 'criteria 6A1'],
  ];
  framework.forEach((row, i) => {
    lists.getRow(22 + i).values = row;
  });

  // Registration
  const reg = wb.addWorksheet('Registration');
  reg.getCell('A1').value = 'SCHOOL REGISTRATION / REGISTRE DES ÉLÈVES — ÉCOLE TEST — 2026/2027';
  reg.getRow(2).values = ['N°', 'Student ID', 'Class', 'Class N°', 'Key', 'Names & Surnames / Noms & Prénoms', 'Gender', 'Date of birth', 'Place of birth', 'Parent / Guardian', 'Phone', 'Address / Quarter', 'Status', 'Display (ID - Name)'];
  FIXTURE_PUPILS.forEach((p, i) => {
    reg.getRow(3 + i).values = [
      i + 1, p.id, p.cls, p.no, `${p.cls}|${p.no}`, p.name, p.gender ?? null, p.dob ? d(p.dob) : null, null,
      p.guardian ?? null, p.phone ?? null, null, p.status ?? 'Active', `${p.id} - ${p.name}`,
    ];
  });

  // Calendar
  const calWs = wb.addWorksheet('Calendar');
  calWs.getCell('A1').value = 'SCHOOL CALENDAR / CALENDRIER SCOLAIRE — 2026/2027';
  calWs.getRow(3).values = ['Date', 'Day', 'Week #', 'Month', 'Term', 'Type', 'Holiday / Observance', null, 'School year summary'];
  const typeLabel = { school: 'School day', weekend: 'Weekend', holiday: 'Holiday', break: 'Break' };
  cal.days.forEach((day, i) => {
    calWs.getRow(4 + i).values = [
      d(day.date), DAY[day.dow], day.week, MONTH_NAMES.en[Number(day.month.slice(5, 7)) - 1],
      day.term ? `Term ${day.term}` : '—', typeLabel[day.type], day.holiday,
    ];
  });

  // Roll_Call
  const roll = wb.addWorksheet('Roll_Call');
  roll.getCell('A1').value = 'DAILY ROLL / APPEL QUOTIDIEN — 2026/2027';
  const header = roll.getRow(3);
  header.getCell(1).value = 'N°';
  header.getCell(2).value = 'Student ID';
  header.getCell(3).value = 'Names & Surnames / Noms & Prénoms';
  const weekdays = cal.days.filter((x) => x.dow !== 0 && x.dow !== 6);
  let col = 4;
  let monthStart = 4;
  weekdays.forEach((day, i) => {
    const c = 4 + i;
    if (i === 0 || day.month !== weekdays[i - 1].month) {
      if (i > 0 && c - 1 > monthStart) roll.mergeCells(3, monthStart, 3, c - 1);
      monthStart = c;
      header.getCell(c).value = dateMonthHeaders ? d(`${day.month}-01`) : `${MONTH_NAMES.en[Number(day.month.slice(5, 7)) - 1]} ${day.month.slice(0, 4)}`;
    }
    roll.getCell(4, c).value = day.term ? `T${day.term}` : '–';
    roll.getCell(5, c).value = day.week ? `W${day.week}` : null;
    roll.getCell(6, c).value = DAY[day.dow].slice(0, 1);
    if (withRollDates) roll.getCell(7, c).value = d(day.date);
    col = c;
  });
  roll.mergeCells(3, monthStart, 3, col);
  ['P', 'A', 'L', 'E', '% Pres.'].forEach((label, i) => {
    header.getCell(col + 1 + i).value = label;
  });
  const colOf = (iso) => 4 + weekdays.findIndex((x) => x.date === iso);
  roll.getCell(8, 1).value = 'SIL';
  roll.getRow(9).values = [1, 'SIL-01', 'TESTA ALPHA JEAN'];
  roll.getRow(10).values = [2, 'SIL-02', 'TESTB BRAVO PAUL'];
  roll.getCell(9, colOf('2026-09-07')).value = 'P';
  roll.getCell(9, colOf('2026-09-08')).value = 'a';
  roll.getCell(9, colOf('2026-09-09')).value = 'L';
  roll.getCell(10, colOf('2026-09-07')).value = 'E';
  roll.getCell(10, colOf('2026-12-25')).value = 'P'; // holiday column → must be skipped at commit
  roll.getCell(11, 3).value = 'Presents today / Présents du jour';

  // Weekly_Controls
  const wc = wb.addWorksheet('Weekly_Controls');
  wc.getCell('A1').value = 'WEEKLY CONTROLS / CONTRÔLES HEBDOMADAIRES (marks out of 20)';
  wc.getCell('E4').value = 'SUBJECTS (/20)';
  wc.getRow(5).values = ['Week', 'Student ID', 'Names & Surnames', 'Class', 'English Language', 'Mathematics', 'French Language', 'Science & Technology', 'Average /20', 'Cote'];
  wc.getRow(6).values = [1, 'SIL-01', 'TESTA ALPHA JEAN', 'SIL', 12, 15.5, 9, 18];
  wc.getCell('A6').numFmt = '"W"0';
  wc.getRow(7).values = ['W2', '6EME-01', 'TESTD DELTA LUC', '6ème', 20, null, 25, 10]; // 25 is out of range
  wc.getRow(8).values = [1, 'NOPE-01', 'UNKNOWN', 'SIL', 10, 10, 10, 10];

  // Daily_Performance
  const dp = wb.addWorksheet('Daily_Performance');
  dp.getCell('A1').value = 'DAILY PERFORMANCE / PERFORMANCE QUOTIDIENNE (marks out of 10)';
  dp.getCell('F4').value = 'ASSESSMENT AREAS (/10)';
  dp.getRow(5).values = ['Date', 'Day', 'Student ID', 'Names & Surnames', 'Class', 'Assignments', 'Class participation', 'Order', 'Discipline', 'Cleanliness', 'Respect', 'Obedience', 'Average /10'];
  dp.getRow(6).values = [d('2026-09-07'), 'Mon', 'SIL-01', 'TESTA ALPHA JEAN', 'SIL', 8, 7, 9, 10, 6, 8, 9];
  dp.getRow(7).values = [d('2026-09-08'), 'Tue', 'SIL-01', 'TESTA ALPHA JEAN', 'SIL', 6, null, null, null, null, null, 7];

  // Term_Card_Entry
  const tc = wb.addWorksheet('Term_Card_Entry');
  tc.getCell('A1').value = 'TERM REPORT CARD — MARKS ENTRY / SAISIE DES NOTES DU BULLETIN TRIMESTRIEL — full framework /280';
  tc.getRow(5).values = ['Month', 'Student ID', 'Names & Surnames', 'Class', '1A /40', '1B /40', '1C /20', '2A /30', '2B /30', '3A /20', '3B /20', '4A /20', '5A /20', '6A1 /20', '6B /20', 'C1 /100', 'C2 /60', 'C3 /40', 'C4 /20', 'C5 /20', 'C6 /40', 'Total /280', 'Average /20', 'Cote', 'Religion', 'Espagnol', 'Vertu du mois', 'Ponctualité', 'Devoirs maison', 'Participation', "Esprit d'équipe", 'Respect consignes', 'Key', 'Perf. avg /10 (auto)', 'OVERALL /20 (70% + 30%)'];
  // 1A/1B… are grey formula columns repeating Month_Card_Entry (cached results).
  tc.getRow(6).values = ['October', 'SIL-01', 'TESTA ALPHA JEAN', 'SIL',
    { formula: 'X', result: 30 }, { formula: 'X', result: 32 }, 15, { formula: 'X', result: 24 }, { formula: 'X', result: 21 }, 16, 14, { formula: 'X', result: 15 }, { formula: 'X', result: 16 }, 18, 17,
    null, null, null, null, null, null, null, null, null,
    'A+', 'B', 'A', 'a+', 'C', 'Z', 'A', 'B'];

  // Month_Card_Entry
  const mc = wb.addWorksheet('Month_Card_Entry');
  mc.getCell('A1').value = 'MONTHLY REPORT CARD — MARKS ENTRY / SAISIE DES NOTES DU BULLETIN MENSUEL';
  mc.getRow(5).values = ['Month', 'Student ID', 'Names & Surnames', 'Class', '1A Communiquer en Français /40', '1B Communicate in English /40', '2A Notions en mathématiques /30', '2B Sciences & Technologies /30', '4A Autonomie & initiative /20', '5A TIC / ICT /20', 'C1 /80', 'C2 /60', 'C4 /20', 'C5 /20', 'Total /180', 'Average /20', 'Cote', 'Key', 'Perf. avg /10 (auto)', 'OVERALL /20 (70% + 30%)'];
  mc.getRow(6).values = ['October', 'SIL-01', 'TESTA ALPHA JEAN', 'SIL', 30, 32, 24, 21, 15, 16];
  mc.getRow(7).values = ['Novembre', 'SIL-01', 'TESTA ALPHA JEAN', 'SIL', 35, 36, 27, 27, 18, 18];
  mc.getRow(8).values = ['October', '6EME-02', 'TESTE ECHO ANNE', '6ème', 41, 20, 10, 10, 10, 10]; // 41 > 40

  // Report_Card_Month header
  const rc = wb.addWorksheet('Report_Card_Month');
  rc.getCell('A1').value = 'ÉCOLE TEST — TEST BILINGUAL SCHOOL';
  rc.getCell('A2').value = 'MONTHLY REPORT CARD / BULLETIN MENSUEL';
  rc.getCell('A3').value = 'Academic year / Année scolaire 2026-2027';

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Allow "node test/fixtures/build-workbook.js out.xlsx" to write a sample file.
if (process.argv[1] && process.argv[1].endsWith('build-workbook.js')) {
  const out = process.argv[2] || 'sample-school-manager.xlsx';
  const fs = await import('node:fs');
  fs.writeFileSync(out, await buildFixtureWorkbook());
  console.log(`Wrote ${out}`);
}

export { addDays, dayOfWeek };
