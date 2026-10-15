// Import the School_Manager.xlsx workbook into the database.
//
// Sheets and columns are located by their header text (not fixed positions),
// so the import keeps working if rows or columns are added in the workbook.
import ExcelJS from 'exceljs';
import { buildCalendar } from '../lib/calendar.js';
import { MONTH_NAMES, addDays, dayOfWeek, isValidISODate, monthNumberFromName } from '../lib/dates.js';
import { PUPIL_STATUSES } from '../db/defaults.js';
import { readFramework, readSettings, readTerms } from './context.js';

// ---- Cell helpers --------------------------------------------------------------

export function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cellValue(cell) {
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return null;
  let v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) v = v.result;
    else if ('formula' in v || 'sharedFormula' in v) return null;
    else if ('richText' in v) return v.richText.map((r) => r.text).join('');
    else if ('text' in v) v = v.text;
    else return null;
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') return 'richText' in v ? v.richText.map((r) => r.text).join('') : null;
  }
  return v;
}

/** Sheet → sparse array of rows, each a sparse array of values (1-based). */
function sheetRows(ws) {
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const v = cellValue(cell);
      if (v !== null && v !== '') values[col] = v;
    });
    rows[rowNumber] = values;
  });
  return rows;
}

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    if (!s || s === '–' || s === '-') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toISODate(v) {
  if (v instanceof Date) {
    const ms = Math.round(v.getTime() / 86_400_000) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && v > 20_000 && v < 80_000) {
    return new Date(Math.round((v - 25_569) * 86_400_000)).toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso && isValidISODate(iso[0])) return iso[0];
    const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (fr) {
      const out = `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
      if (isValidISODate(out)) return out;
    }
  }
  return null;
}

function findSheet(wb, ...names) {
  const wanted = names.map((n) => norm(n).replace(/[\s_]/g, ''));
  return wb.worksheets.find((ws) => wanted.includes(norm(ws.name).replace(/[\s_]/g, ''))) ?? null;
}

function findHeaderRow(rows, predicate, maxRow = 25) {
  for (let r = 1; r < Math.min(rows.length, maxRow + 1); r += 1) {
    const row = rows[r];
    if (!row) continue;
    const normalized = [];
    row.forEach((v, c) => {
      normalized[c] = norm(v);
    });
    if (predicate(normalized.filter(Boolean))) return r;
  }
  return null;
}

function findCol(row, regex, { after = 0 } = {}) {
  if (!row) return null;
  for (let c = after + 1; c < row.length; c += 1) {
    if (row[c] !== undefined && regex.test(norm(row[c]))) return c;
  }
  return null;
}

/** "CE2-01 - NAME" or "ce2-01" → "CE2-01" */
function studentIdOf(v) {
  const s = text(v);
  if (!s) return '';
  return s.split(' - ')[0].trim().toUpperCase();
}

function weekOfCell(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const m = text(v).match(/^w?\s*(\d{1,2})$/i);
  return m ? Number(m[1]) : null;
}

class Warnings {
  constructor() {
    this.list = [];
    this.total = 0;
  }
  add(message) {
    this.total += 1;
    if (this.list.length < 100) this.list.push(message);
  }
}

// ---- Sheet parsers -----------------------------------------------------------------

function parseLists(rows) {
  const out = { classes: [], terms: [], framework: [] };
  let classesAt = null;
  let termsAt = null;
  let frameworkAt = null;
  rows.forEach((row, r) => {
    if (!row) return;
    row.forEach((v, c) => {
      const t = norm(v);
      if (!classesAt && t === 'class / classe' && norm(row[c + 1]).startsWith('code')) classesAt = { r, c };
      if (!termsAt && t === 'term' && norm(row[c + 1]) === 'start' && norm(row[c + 2]) === 'end') termsAt = { r, c };
      if (!frameworkAt && t === 'competence' && norm(row[c + 1]) === 'code') frameworkAt = { r, c };
    });
  });

  if (classesAt) {
    for (let r = classesAt.r + 1; rows[r]?.[classesAt.c] !== undefined; r += 1) {
      const name = text(rows[r][classesAt.c]);
      const code = text(rows[r][classesAt.c + 1]).toUpperCase();
      if (name && code) out.classes.push({ name, code });
    }
  }
  if (termsAt) {
    for (let r = termsAt.r + 1; /term|trimestre/.test(norm(rows[r]?.[termsAt.c])); r += 1) {
      const row = rows[r];
      out.terms.push({
        name: text(row[termsAt.c]),
        start: toISODate(row[termsAt.c + 1]),
        end: toISODate(row[termsAt.c + 2]),
        uaMonthNames: [row[termsAt.c + 3], row[termsAt.c + 4], row[termsAt.c + 5]]
          .map((v) => (v instanceof Date ? MONTH_NAMES.en[Number(toISODate(v).slice(5, 7)) - 1] : text(v)))
          .filter(Boolean),
      });
    }
  }
  if (frameworkAt) {
    for (let r = frameworkAt.r + 1; rows[r]?.[frameworkAt.c + 1] !== undefined; r += 1) {
      const row = rows[r];
      const code = text(row[frameworkAt.c + 1]).toUpperCase();
      const max = toNumber(row[frameworkAt.c + 3]);
      if (!/^\d[A-Z]\d?$/.test(code) || !max) continue;
      out.framework.push({
        code,
        label: text(row[frameworkAt.c + 2]),
        max,
        criteria: text(row[frameworkAt.c + 5]),
      });
    }
  }
  return out;
}

function parseCalendarSheet(rows) {
  const hr = findHeaderRow(rows, (cells) => cells.includes('date') && cells.includes('type'));
  if (!hr) return null;
  const head = rows[hr];
  const cDate = findCol(head, /^date$/);
  const cWeek = findCol(head, /^week/);
  const cTerm = findCol(head, /^term|^trimestre/);
  const cType = findCol(head, /^type$/);
  const cHoliday = findCol(head, /holiday|observance|ferie/);
  const days = [];
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const date = toISODate(row[cDate]);
    if (!date) continue;
    days.push({
      date,
      week: cWeek ? toNumber(row[cWeek]) : null,
      term: cTerm ? text(row[cTerm]) : '',
      type: norm(row[cType]),
      holiday: cHoliday ? text(row[cHoliday]) : '',
    });
  }
  if (!days.length) return null;
  days.sort((a, b) => a.date.localeCompare(b.date));
  const holidays = days.filter((d) => /holiday|ferie|jour ferie/.test(d.type)).map((d) => ({ date: d.date, name: d.holiday || 'Holiday' }));
  const firstWeek1 = days.find((d) => d.week === 1);
  let week1Start = null;
  if (firstWeek1) {
    const dow = dayOfWeek(firstWeek1.date);
    week1Start = addDays(firstWeek1.date, dow === 0 ? -6 : 1 - dow);
  }
  // Terms as seen on the calendar (school days grouped by the Term column).
  const byTerm = new Map();
  for (const d of days) {
    if (!/school|classe/.test(d.type)) continue;
    const m = d.term.match(/(\d+)/);
    if (!m) continue;
    const n = Number(m[1]);
    const t = byTerm.get(n) ?? { number: n, name: d.term, start: d.date, end: d.date };
    t.end = d.date;
    byTerm.set(n, t);
  }
  return {
    yearStart: days[0].date,
    yearEnd: days[days.length - 1].date,
    week1Start,
    holidays,
    terms: [...byTerm.values()].sort((a, b) => a.number - b.number),
  };
}

const REG_COLUMNS = {
  studentId: /student ?id|matricule/,
  className: /^class(e)?( \/ classe)?$/,
  classNo: /^class n|^n° dans|^no$/,
  fullName: /name|^nom/,
  gender: /gender|sexe/,
  dateOfBirth: /date of birth|date de naissance|^dob$/,
  placeOfBirth: /place of birth|lieu de naissance/,
  guardian: /parent|guardian|tuteur/,
  phone: /phone|tel/,
  address: /address|quarter|adresse|quartier/,
  status: /^status|^statut/,
};

function parseGender(v) {
  const t = norm(v);
  if (!t) return null;
  if (['m', 'male', 'masculin', 'garcon', 'boy', 'g'].includes(t)) return 'M';
  if (['f', 'female', 'feminin', 'fille', 'girl'].includes(t)) return 'F';
  return null;
}

function parseRegistration(rows, warnings) {
  const hr = findHeaderRow(rows, (cells) => cells.some((t) => /student ?id|matricule/.test(t)));
  if (!hr) return [];
  const head = rows[hr];
  const col = {};
  for (const [key, regex] of Object.entries(REG_COLUMNS)) col[key] = findCol(head, regex);
  // "Names & Surnames" must not be confused with "Display (ID - Name)".
  col.fullName = findCol(head, /names? (&|and) surnames?|noms? (&|et) prenoms?/) ?? col.fullName;

  const pupils = [];
  const seen = new Set();
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const studentId = studentIdOf(row[col.studentId]);
    const fullName = text(row[col.fullName]).replace(/\s+/g, ' ');
    if (!studentId || !fullName) continue;
    if (seen.has(studentId)) {
      warnings.add(`Registration: duplicate student ID ${studentId} (row ${r}) skipped`);
      continue;
    }
    seen.add(studentId);
    const statusText = text(row[col.status]);
    const status = PUPIL_STATUSES.find((s) => norm(s) === norm(statusText)) ?? 'Active';
    const idNumber = Number(studentId.match(/(\d+)$/)?.[1] ?? 0);
    pupils.push({
      studentId,
      className: text(row[col.className]),
      classCode: studentId.includes('-') ? studentId.split('-')[0] : '',
      classNo: toNumber(row[col.classNo]) ?? idNumber,
      fullName,
      gender: parseGender(row[col.gender]),
      dateOfBirth: col.dateOfBirth ? toISODate(row[col.dateOfBirth]) : null,
      placeOfBirth: col.placeOfBirth ? text(row[col.placeOfBirth]) || null : null,
      guardian: col.guardian ? text(row[col.guardian]) || null : null,
      phone: col.phone ? text(row[col.phone]) || null : null,
      address: col.address ? text(row[col.address]) || null : null,
      status,
    });
  }
  return pupils;
}

function parseRollCall(rows, knownIds, warnings) {
  const hr = findHeaderRow(rows, (cells) => cells.some((t) => /student ?id/.test(t)));
  if (!hr) return [];
  const head = rows[hr];
  const idCol = findCol(head, /student ?id/);
  const firstDateCol = idCol + 2;
  let endCol = head.length;
  for (let c = firstDateCol; c < head.length; c += 1) {
    if (norm(head[c]) === 'p' && norm(head[c + 1]) === 'a' && norm(head[c + 2]) === 'l') {
      endCol = c;
      break;
    }
  }

  // 1) A header row holding real dates.
  const colDate = new Map();
  let bestRow = null;
  let best = 0;
  for (let r = hr + 1; r <= hr + 8 && r < rows.length; r += 1) {
    let count = 0;
    for (let c = firstDateCol; c < endCol; c += 1) if (rows[r]?.[c] instanceof Date) count += 1;
    if (count > best) {
      best = count;
      bestRow = r;
    }
  }
  if (best >= 5) {
    for (let c = firstDateCol; c < endCol; c += 1) {
      const d = toISODate(rows[bestRow][c]);
      if (d) colDate.set(c, d);
    }
  } else {
    // 2) One column per weekday, starting at the first month label ("September 2026").
    const labels = [];
    for (let c = firstDateCol; c < endCol; c += 1) {
      if (head[c] instanceof Date) {
        const iso = toISODate(head[c]);
        labels.push({ c, month: Number(iso.slice(5, 7)), year: Number(iso.slice(0, 4)) });
        continue;
      }
      const m = text(head[c]).match(/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/);
      if (m) {
        const month = monthNumberFromName(m[1]);
        if (month) labels.push({ c, month, year: Number(m[2]) });
      }
    }
    if (!labels.length) {
      warnings.add('Roll_Call: could not find the date columns — roll marks were not imported');
      return [];
    }
    let date = `${labels[0].year}-${String(labels[0].month).padStart(2, '0')}-01`;
    while (dayOfWeek(date) === 0 || dayOfWeek(date) === 6) date = addDays(date, 1);
    const lastCol = endCol === head.length ? Math.max(...rows.slice(hr).map((r) => r?.length ?? 0)) : endCol;
    for (let c = labels[0].c; c < lastCol; c += 1) {
      colDate.set(c, date);
      do date = addDays(date, 1);
      while (dayOfWeek(date) === 0 || dayOfWeek(date) === 6);
    }
    for (const l of labels) {
      const d = colDate.get(l.c);
      if (!d || Number(d.slice(5, 7)) !== l.month) {
        warnings.add('Roll_Call: date columns do not line up with the month headers — roll marks were not imported');
        return [];
      }
    }
  }

  const marks = [];
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const studentId = studentIdOf(row[idCol]);
    if (!studentId || !knownIds.has(studentId)) continue;
    for (const [c, date] of colDate) {
      const v = norm(row[c]).toUpperCase();
      if (!v) continue;
      if (['P', 'A', 'L', 'E'].includes(v)) marks.push({ studentId, date, mark: v });
      else warnings.add(`Roll_Call: unknown mark "${row[c]}" for ${studentId} on ${date}`);
    }
  }
  return marks;
}

const SUBJECT_PATTERNS = [
  ['english', /english|anglais/],
  ['maths', /math/],
  ['french', /french|francais/],
  ['scitech', /science|sci ?& ?t|sci&t/],
];

const AREA_PATTERNS = [
  ['assignments', /assignment|devoir/],
  ['participation', /particip/],
  ['order', /^order|^ordre/],
  ['discipline', /^discipline$/],
  ['cleanliness', /clean|proprete/],
  ['respect', /^respect$/],
  ['obedience', /obedien|obeissance/],
];

const ATTITUDE_PATTERNS = [
  ['religion', /religion/],
  ['spanish', /espagnol|spanish/],
  ['virtue', /vertu|virtue/],
  ['punctuality', /ponctualite|punctuality/],
  ['homework', /devoirs|homework/],
  ['participation', /participation/],
  ['teamwork', /esprit d.?equipe|team/],
  ['instructions', /consignes|instructions/],
];

function mapColumns(head, patterns, after) {
  const out = [];
  for (let c = after + 1; c < head.length; c += 1) {
    const t = norm(head[c]);
    if (!t) continue;
    const hit = patterns.find(([, re]) => re.test(t));
    if (hit && !out.some((o) => o.code === hit[0])) out.push({ code: hit[0], c });
  }
  return out;
}

function parseWeeklyControls(rows, knownIds, warnings, maxWeek) {
  const hr = findHeaderRow(rows, (cells) => cells.some((t) => /student ?id/.test(t)) && cells.some((t) => /^week|^semaine/.test(t)));
  if (!hr) return [];
  const head = rows[hr];
  const cWeek = findCol(head, /^week|^semaine/);
  const cId = findCol(head, /student ?id/);
  const cols = mapColumns(head, SUBJECT_PATTERNS, cId + 1);
  const out = [];
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const studentId = studentIdOf(row[cId]);
    if (!studentId) continue;
    const week = weekOfCell(row[cWeek]);
    if (!knownIds.has(studentId)) {
      if (cols.some(({ c }) => toNumber(row[c]) !== null)) warnings.add(`Weekly_Controls: unknown student ID ${studentId} (row ${r})`);
      continue;
    }
    if (!week || week < 1 || week > maxWeek) {
      warnings.add(`Weekly_Controls: invalid week for ${studentId} (row ${r})`);
      continue;
    }
    for (const { code, c } of cols) {
      const v = toNumber(row[c]);
      if (v === null) continue;
      if (v < 0 || v > 20) warnings.add(`Weekly_Controls: mark ${v} out of 0–20 for ${studentId} (row ${r})`);
      else out.push({ studentId, week, subject: code, value: v });
    }
  }
  return out;
}

function parseDailyPerformance(rows, knownIds, warnings) {
  const hr = findHeaderRow(rows, (cells) => cells.includes('date') && cells.some((t) => /student ?id/.test(t)));
  if (!hr) return [];
  const head = rows[hr];
  const cDate = findCol(head, /^date$/);
  const cId = findCol(head, /student ?id/);
  const cols = mapColumns(head, AREA_PATTERNS, cId + 1);
  const out = [];
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const studentId = studentIdOf(row[cId]);
    if (!studentId) continue;
    const date = toISODate(row[cDate]);
    if (!knownIds.has(studentId)) {
      if (cols.some(({ c }) => toNumber(row[c]) !== null)) warnings.add(`Daily_Performance: unknown student ID ${studentId} (row ${r})`);
      continue;
    }
    if (!date) {
      warnings.add(`Daily_Performance: missing date for ${studentId} (row ${r})`);
      continue;
    }
    for (const { code, c } of cols) {
      const v = toNumber(row[c]);
      if (v === null) continue;
      if (v < 0 || v > 10) warnings.add(`Daily_Performance: mark ${v} out of 0–10 for ${studentId} (row ${r})`);
      else out.push({ studentId, date, area: code, value: v });
    }
  }
  return out;
}

function parseCardEntry(rows, knownIds, warnings, { sheetName, disciplines, monthKeyOf, withAttitudes }) {
  const hr = findHeaderRow(rows, (cells) => cells.some((t) => /student ?id/.test(t)) && cells.some((t) => /^month|^mois/.test(t)));
  if (!hr) return { marks: [], attitudes: [] };
  const head = rows[hr];
  const cMonth = findCol(head, /^month|^mois/);
  const cId = findCol(head, /student ?id/);
  const discCols = [];
  for (let c = cId + 1; c < head.length; c += 1) {
    const m = text(head[c]).match(/^(\d[A-Za-z]\d?)\b/);
    if (!m) continue;
    const d = disciplines.get(m[1].toUpperCase());
    if (d && !discCols.some((x) => x.code === d.code)) discCols.push({ code: d.code, max: d.max, c });
  }
  const attCols = withAttitudes ? mapColumns(head, ATTITUDE_PATTERNS, cId + 1).filter(({ c }) => !discCols.some((d) => d.c === c)) : [];
  const marks = [];
  const attitudes = [];
  for (let r = hr + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    const studentId = studentIdOf(row[cId]);
    if (!studentId) continue;
    const hasValues = discCols.some(({ c }) => toNumber(row[c]) !== null) || attCols.some(({ c }) => text(row[c]));
    if (!hasValues) continue;
    if (!knownIds.has(studentId)) {
      warnings.add(`${sheetName}: unknown student ID ${studentId} (row ${r})`);
      continue;
    }
    const month = monthKeyOf(row[cMonth]);
    if (!month) {
      warnings.add(`${sheetName}: invalid month "${text(row[cMonth])}" for ${studentId} (row ${r})`);
      continue;
    }
    for (const { code, max, c } of discCols) {
      const v = toNumber(row[c]);
      if (v === null) continue;
      if (v < 0 || v > max) warnings.add(`${sheetName}: ${code} = ${v} is out of 0–${max} for ${studentId} (row ${r})`);
      else marks.push({ studentId, month, discipline: code, value: v });
    }
    for (const { code, c } of attCols) {
      const g = text(row[c]).toUpperCase();
      if (!g) continue;
      if (['A+', 'A', 'B', 'C'].includes(g)) attitudes.push({ studentId, month, attitude: code, grade: g });
      else warnings.add(`${sheetName}: grade "${g}" is not A+, A, B or C for ${studentId} (row ${r})`);
    }
  }
  return { marks, attitudes };
}

function parseSchoolInfo(wb) {
  const info = { name: null, subtitle: null, academicYear: null };
  const card = findSheet(wb, 'Report_Card_Month', 'Report_Card_Term');
  const dash = findSheet(wb, 'Dashboard');
  const scan = (ws, limit = 8) => {
    const out = [];
    if (!ws) return out;
    for (let r = 1; r <= limit; r += 1) {
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        const v = text(cellValue(cell));
        if (v) out.push(v);
      });
    }
    return out;
  };
  const cardTexts = scan(card);
  const header = cardTexts.find((t) => t.includes('—'));
  if (header) {
    const [name, subtitle] = header.split('—').map((s) => s.trim());
    info.name = name || null;
    info.subtitle = subtitle || null;
  }
  const dashTexts = scan(dash, 2);
  if (!info.name) {
    const title = dashTexts.find((t) => t.includes('—'));
    if (title) info.name = title.split('—')[0].trim();
  }
  for (const t of [...cardTexts, ...dashTexts]) {
    const m = t.match(/(20\d{2})\s*[-–/]\s*(20\d{2})/);
    if (m) {
      info.academicYear = `${m[1]}-${m[2]}`;
      break;
    }
  }
  return info;
}

// ---- Public API --------------------------------------------------------------------

/** Parse a workbook buffer into plain data plus warnings (no database writes). */
export async function parseWorkbook(buffer, db) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const warnings = new Warnings();
  const framework = readFramework(db);
  const settings = readSettings(db);

  const sheet = (name) => {
    const ws = findSheet(wb, name);
    return ws ? sheetRows(ws) : null;
  };

  const listsRows = sheet('Lists');
  const lists = listsRows ? parseLists(listsRows) : { classes: [], terms: [], framework: [] };
  const calRows = sheet('Calendar');
  const cal = calRows ? parseCalendarSheet(calRows) : null;

  const yearStart = cal?.yearStart ?? settings.yearStart;
  const yearEnd = cal?.yearEnd ?? settings.yearEnd;
  const monthKeyFromNumber = (n) => {
    for (let y = Number(yearStart.slice(0, 4)); y <= Number(yearEnd.slice(0, 4)); y += 1) {
      const key = `${y}-${String(n).padStart(2, '0')}`;
      if (key >= yearStart.slice(0, 7) && key <= yearEnd.slice(0, 7)) return key;
    }
    return null;
  };
  const monthKeyOf = (v) => {
    if (v instanceof Date) return toISODate(v).slice(0, 7);
    const n = monthNumberFromName(text(v));
    return n ? monthKeyFromNumber(n) : null;
  };

  // Calendar: dates from the Calendar sheet, terms & UA months from Lists when available.
  let calendar = null;
  if (cal) {
    const terms = (lists.terms.length ? lists.terms : cal.terms).map((t, i) => {
      const number = Number(String(t.name).match(/(\d+)/)?.[1] ?? t.number ?? i + 1);
      const fromCal = cal.terms.find((ct) => ct.number === number);
      const start = t.start ?? fromCal?.start;
      const end = t.end ?? fromCal?.end;
      let uaMonths = (t.uaMonthNames ?? []).map((name) => monthKeyFromNumber(monthNumberFromName(name))).filter(Boolean);
      if (!uaMonths.length && start && end) {
        const months = [];
        for (let m = start.slice(0, 7); m <= end.slice(0, 7); m = addDays(`${m}-28`, 7).slice(0, 7)) months.push(m);
        uaMonths = months.slice(-3);
      }
      return { number, name: t.name || `Term ${number}`, start, end, uaMonths };
    }).filter((t) => t.start && t.end);
    calendar = {
      yearStart: cal.yearStart,
      yearEnd: cal.yearEnd,
      week1Start: cal.week1Start ?? settings.week1Start,
      holidays: cal.holidays,
      terms,
    };
  } else {
    warnings.add('Calendar sheet not found — the current calendar is kept');
  }

  const regRows = sheet('Registration');
  if (!regRows) warnings.add('Registration sheet not found — no pupils imported');
  const pupils = regRows ? parseRegistration(regRows, warnings) : [];
  const knownIds = new Set(pupils.map((p) => p.studentId));

  // Classes: Lists order first, then any class only found in Registration.
  const classes = [...lists.classes];
  for (const p of pupils) {
    if (p.className && !classes.some((c) => c.name === p.className)) {
      classes.push({ name: p.className, code: p.classCode || p.className.toUpperCase().replace(/[^A-Z0-9]/g, '') });
    }
  }

  const weeksInYear = buildCalendar({
    yearStart,
    yearEnd,
    week1Start: calendar?.week1Start ?? settings.week1Start,
    terms: [],
    holidays: [],
  }).weeks.length;

  const rollRows = sheet('Roll_Call');
  const attendance = rollRows ? parseRollCall(rollRows, knownIds, warnings) : [];
  const ctrlRows = sheet('Weekly_Controls');
  const controls = ctrlRows ? parseWeeklyControls(ctrlRows, knownIds, warnings, weeksInYear) : [];
  const perfRows = sheet('Daily_Performance');
  const performance = perfRows ? parseDailyPerformance(perfRows, knownIds, warnings) : [];

  const disciplines = new Map(framework.disciplines.map((d) => [d.code, d]));
  for (const f of lists.framework) {
    const d = disciplines.get(f.code);
    if (d) disciplines.set(f.code, { ...d, max: f.max });
  }
  const monthRows = sheet('Month_Card_Entry');
  const monthEntry = monthRows
    ? parseCardEntry(monthRows, knownIds, warnings, { sheetName: 'Month_Card_Entry', disciplines, monthKeyOf, withAttitudes: false })
    : { marks: [], attitudes: [] };
  const termRows = sheet('Term_Card_Entry');
  const termEntry = termRows
    ? parseCardEntry(termRows, knownIds, warnings, { sheetName: 'Term_Card_Entry', disciplines, monthKeyOf, withAttitudes: true })
    : { marks: [], attitudes: [] };

  // Month_Card_Entry is the source for monthly-card disciplines; Term_Card_Entry
  // repeats them (grey formula columns) and adds the term-only ones.
  const markKey = (m) => `${m.studentId}|${m.month}|${m.discipline}`;
  const marks = new Map(monthEntry.marks.map((m) => [markKey(m), m]));
  for (const m of termEntry.marks) if (!marks.has(markKey(m))) marks.set(markKey(m), m);

  return {
    sheets: wb.worksheets.map((ws) => ws.name),
    school: parseSchoolInfo(wb),
    calendar,
    framework: lists.framework,
    classes,
    pupils,
    attendance,
    controls,
    performance,
    marks: [...marks.values()],
    attitudes: termEntry.attitudes,
    warnings: warnings.list,
    warningCount: warnings.total,
  };
}

/** Short summary of a parsed workbook for the import preview. */
export function summarize(parsed) {
  const perClass = parsed.classes.map((c) => ({
    name: c.name,
    code: c.code,
    pupils: parsed.pupils.filter((p) => p.className === c.name).length,
  }));
  return {
    sheets: parsed.sheets,
    school: parsed.school,
    calendar: parsed.calendar && {
      yearStart: parsed.calendar.yearStart,
      yearEnd: parsed.calendar.yearEnd,
      week1Start: parsed.calendar.week1Start,
      terms: parsed.calendar.terms,
      holidays: parsed.calendar.holidays.length,
    },
    classes: perClass,
    counts: {
      pupils: parsed.pupils.length,
      attendance: parsed.attendance.length,
      controls: parsed.controls.length,
      performance: parsed.performance.length,
      marks: parsed.marks.length,
      attitudes: parsed.attitudes.length,
    },
    warnings: parsed.warnings,
    warningCount: parsed.warningCount,
  };
}

/**
 * Write a parsed workbook to the database in one transaction.
 * mode "replace": pupils and all their records are replaced by the workbook's.
 * mode "merge":   pupils are matched by student ID and records are upserted.
 */
export function commitImport(db, parsed, { mode = 'replace' } = {}) {
  const result = { pupils: 0, attendance: 0, controls: 0, performance: 0, marks: 0, attitudes: 0, skipped: 0 };
  db.transaction(() => {
    const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (parsed.school.name) setSetting.run('school_name', parsed.school.name);
    if (parsed.school.subtitle) setSetting.run('school_subtitle', parsed.school.subtitle);
    if (parsed.school.academicYear) setSetting.run('academic_year', parsed.school.academicYear);

    if (parsed.calendar) {
      const c = parsed.calendar;
      setSetting.run('year_start', c.yearStart);
      setSetting.run('year_end', c.yearEnd);
      if (c.week1Start) setSetting.run('week1_start', c.week1Start);
      db.prepare('DELETE FROM holidays').run();
      const h = db.prepare('INSERT OR REPLACE INTO holidays (date, name) VALUES (?, ?)');
      for (const x of c.holidays) h.run(x.date, x.name);
      if (c.terms.length) {
        db.prepare('DELETE FROM terms').run();
        const t = db.prepare('INSERT INTO terms (number, name, start_date, end_date, ua_months) VALUES (?, ?, ?, ?, ?)');
        for (const x of c.terms) t.run(x.number, x.name, x.start, x.end, JSON.stringify(x.uaMonths));
      }
    }

    const updDisc = db.prepare('UPDATE disciplines SET max = ?, criteria = CASE WHEN ? <> \'\' THEN ? ELSE criteria END WHERE code = ?');
    for (const f of parsed.framework) updDisc.run(f.max, f.criteria, f.criteria, f.code);

    // Classes & pupils
    if (mode === 'replace' && parsed.pupils.length) {
      db.prepare('DELETE FROM pupils').run();
      if (parsed.classes.length) db.prepare('DELETE FROM classes').run();
    }
    const findClass = db.prepare('SELECT id FROM classes WHERE name = ?');
    const insertClass = db.prepare('INSERT INTO classes (name, code, sort_order) VALUES (?, ?, ?)');
    const updateClass = db.prepare('UPDATE classes SET code = ?, sort_order = ? WHERE id = ?');
    parsed.classes.forEach((c, i) => {
      const existing = findClass.get(c.name);
      if (existing) updateClass.run(c.code, i + 1, existing.id);
      else {
        const clash = db.prepare('SELECT id FROM classes WHERE code = ?').get(c.code);
        insertClass.run(c.name, clash ? `${c.code}${i + 1}` : c.code, i + 1);
      }
    });
    const classIdByName = new Map(db.prepare('SELECT id, name FROM classes').all().map((c) => [c.name, c.id]));

    const findPupil = db.prepare('SELECT * FROM pupils WHERE student_id = ?');
    const insertPupil = db.prepare(
      `INSERT INTO pupils (student_id, class_id, class_no, full_name, gender, date_of_birth, place_of_birth, guardian, phone, address, status)
       VALUES (@studentId, @classId, @classNo, @fullName, @gender, @dateOfBirth, @placeOfBirth, @guardian, @phone, @address, @status)`,
    );
    const updatePupil = db.prepare(
      `UPDATE pupils SET class_id = @classId, class_no = @classNo, full_name = @fullName, gender = @gender,
              date_of_birth = @dateOfBirth, place_of_birth = @placeOfBirth, guardian = @guardian, phone = @phone,
              address = @address, status = @status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = @id`,
    );
    for (const p of parsed.pupils) {
      const classId = classIdByName.get(p.className) ?? db.prepare('SELECT id FROM classes WHERE code = ?').get(p.classCode)?.id;
      if (!classId) {
        result.skipped += 1;
        continue;
      }
      const existing = findPupil.get(p.studentId);
      const row = { ...p, classId };
      if (existing) {
        // Keep details typed in the web app when the workbook leaves them blank.
        for (const k of ['gender', 'dateOfBirth', 'placeOfBirth', 'guardian', 'phone', 'address']) {
          const col = { dateOfBirth: 'date_of_birth', placeOfBirth: 'place_of_birth' }[k] ?? k;
          if (row[k] === null || row[k] === '') row[k] = existing[col];
        }
        updatePupil.run({ ...row, id: existing.id });
      } else insertPupil.run(row);
      result.pupils += 1;
    }

    const pupilIds = new Map(db.prepare('SELECT id, student_id FROM pupils').all().map((p) => [p.student_id.toUpperCase(), p.id]));
    const settingsNow = readSettings(db);
    const cal = buildCalendar({
      yearStart: settingsNow.yearStart,
      yearEnd: settingsNow.yearEnd,
      week1Start: settingsNow.week1Start,
      terms: readTerms(db),
      holidays: db.prepare('SELECT date, name FROM holidays').all(),
    });
    const isSchoolDay = (d) => cal.dayByDate.get(d)?.type === 'school';
    const months = new Set(cal.months.map((m) => m.key));

    const upAtt = db.prepare(
      'INSERT INTO attendance (pupil_id, date, mark) VALUES (?, ?, ?) ON CONFLICT(pupil_id, date) DO UPDATE SET mark = excluded.mark',
    );
    for (const a of parsed.attendance) {
      const id = pupilIds.get(a.studentId);
      if (!id || !isSchoolDay(a.date)) {
        result.skipped += 1;
        continue;
      }
      upAtt.run(id, a.date, a.mark);
      result.attendance += 1;
    }
    const upCtrl = db.prepare(
      'INSERT INTO control_marks (pupil_id, week, subject, value) VALUES (?, ?, ?, ?) ON CONFLICT(pupil_id, week, subject) DO UPDATE SET value = excluded.value',
    );
    for (const c of parsed.controls) {
      const id = pupilIds.get(c.studentId);
      if (!id) {
        result.skipped += 1;
        continue;
      }
      upCtrl.run(id, c.week, c.subject, c.value);
      result.controls += 1;
    }
    const upPerf = db.prepare(
      'INSERT INTO performance_marks (pupil_id, date, area, value) VALUES (?, ?, ?, ?) ON CONFLICT(pupil_id, date, area) DO UPDATE SET value = excluded.value',
    );
    for (const p of parsed.performance) {
      const id = pupilIds.get(p.studentId);
      if (!id || !isSchoolDay(p.date)) {
        result.skipped += 1;
        continue;
      }
      upPerf.run(id, p.date, p.area, p.value);
      result.performance += 1;
    }
    const upMark = db.prepare(
      'INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?) ON CONFLICT(pupil_id, month, discipline) DO UPDATE SET value = excluded.value',
    );
    for (const m of parsed.marks) {
      const id = pupilIds.get(m.studentId);
      if (!id || !months.has(m.month)) {
        result.skipped += 1;
        continue;
      }
      upMark.run(id, m.month, m.discipline, m.value);
      result.marks += 1;
    }
    const upGrade = db.prepare(
      'INSERT INTO attitude_grades (pupil_id, month, attitude, grade) VALUES (?, ?, ?, ?) ON CONFLICT(pupil_id, month, attitude) DO UPDATE SET grade = excluded.grade',
    );
    for (const g of parsed.attitudes) {
      const id = pupilIds.get(g.studentId);
      if (!id || !months.has(g.month)) {
        result.skipped += 1;
        continue;
      }
      upGrade.run(id, g.month, g.attitude, g.grade);
      result.attitudes += 1;
    }
    setSetting.run('demo_mode', '0');
  })();
  return result;
}
