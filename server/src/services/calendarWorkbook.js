// Read the school's planner workbook — the "Calendrier scolaire" file the school keeps
// year after year — and turn its notes into events.
//
// The layout is the one schools actually use: one sheet per half-year, and on each sheet
// one block of columns per month running side by side. Every month block is
//
//     day number | weekday (Lu Ma Me Je Ve Sa Di) | what happens that day
//
// The notes are free text, so the file is read as loosely as it is written: the month row
// is found by looking for month names, the blocks by walking along that row, and the day
// of the month from the row's position when the day cell itself has been swallowed by a
// merged block of text. Columns are never assumed to sit at a fixed place.
import ExcelJS from 'exceljs';
import { MONTH_NAMES, isValidISODate } from '../lib/dates.js';

const MONTH_WORDS = new Map();
for (let i = 0; i < 12; i += 1) {
  MONTH_WORDS.set(norm(MONTH_NAMES.fr[i]), i + 1);
  MONTH_WORDS.set(norm(MONTH_NAMES.en[i]), i + 1);
}

const WEEKDAY_WORDS = new Set(['lu', 'lun', 'lundi', 'ma', 'mar', 'mardi', 'me', 'mer', 'mercredi', 'je', 'jeu', 'jeudi', 've', 'ven', 'vendredi', 'sa', 'sam', 'samedi', 'di', 'dim', 'dimanche']);

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text of a cell, whatever Excel put in it (plain text, number, rich text, date). */
function cellText(cell) {
  if (!cell) return '';
  let v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text ?? '').join('');
    if ('result' in v && v.result !== undefined && v.result !== null) v = v.result;
    else if ('text' in v) v = v.text;
    else return '';
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

const clean = (s) =>
  String(s ?? '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/+\s*/g, ' / ')
    .trim();

function colNumber(letters) {
  let n = 0;
  for (const ch of String(letters)) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Merged ranges of a sheet, as { top, bottom, left, right } in 1-based coordinates. */
function mergeSpans(ws) {
  const raw = ws?.model?.merges;
  const list = Array.isArray(raw) ? raw : raw instanceof Map ? [...raw.values()] : [];
  const spans = [];
  for (const ref of list) {
    const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(String(ref).trim());
    if (!m) continue;
    const left = colNumber(m[1]);
    const top = Number(m[2]);
    const right = m[3] ? colNumber(m[3]) : left;
    const bottom = m[4] ? Number(m[4]) : top;
    spans.push({ top, bottom, left, right });
  }
  return spans;
}

/**
 * The row holding the month names. The school puts them wherever the header ends up
 * (row 3 on one sheet, row 5 on the other), so it is found by looking for a row with
 * several month names in it.
 */
function findMonthRow(ws, maxRow = 15) {
  let best = null;
  for (let r = 1; r <= Math.min(maxRow, ws.rowCount); r += 1) {
    const row = ws.getRow(r);
    let hits = 0;
    for (let c = 1; c <= ws.columnCount; c += 1) if (MONTH_WORDS.has(norm(cellText(row.getCell(c))))) hits += 1;
    if (hits > (best?.hits ?? 1)) best = { row: r, hits };
  }
  return best?.hits >= 2 ? best.row : null;
}

/** The row above the months holding each block's year (2026, 2026, …, 2027). */
function findYearRow(ws, monthRow) {
  for (let r = monthRow - 1; r >= 1; r -= 1) {
    const row = ws.getRow(r);
    let hits = 0;
    for (let c = 1; c <= ws.columnCount; c += 1) if (/^(19|20)\d{2}$/.test(clean(cellText(row.getCell(c))))) hits += 1;
    if (hits >= 2) return r;
  }
  return null;
}

/**
 * The month blocks of a sheet. A month is usually named across every column of its block
 * (merged or repeated), but a single heading works too: whichever way it is written, a
 * block runs from its own heading to the one before the next month's.
 */
function monthBlocks(ws, monthRow) {
  const blocks = [];
  for (let c = 1; c <= ws.columnCount; c += 1) {
    const name = clean(cellText(ws.getRow(monthRow).getCell(c)));
    if (!MONTH_WORDS.has(norm(name))) continue;
    const last = blocks.at(-1);
    if (last && norm(last.name) === norm(name)) last.end = c;
    else blocks.push({ name, month: MONTH_WORDS.get(norm(name)), start: c, end: c });
  }
  for (let i = 0; i < blocks.length - 1; i += 1) blocks[i].end = blocks[i + 1].start - 1;
  const last = blocks.at(-1);
  if (last) last.end = Math.max(last.end, ws.columnCount);
  return blocks;
}

/**
 * A column shared with the next block (the two months' columns are merged together) would
 * otherwise drop the neighbouring month's day numbers into this month's notes, so the
 * block stops at the last column that is really its own.
 */
function trimBlocks(blocks, spans, monthRow) {
  // Only merges that reach down into the day rows count: the title and the month row are
  // merged across the whole sheet too, and those say nothing about where a month ends.
  const daySpans = spans.filter((s) => s.bottom > monthRow && s.top <= monthRow + 32);
  const crossing = (col, nextStart) => daySpans.some((s) => s.left <= col && s.right >= nextStart);
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const nextStart = blocks[i + 1].start;
    while (blocks[i].end > blocks[i].start + 1 && crossing(blocks[i].end, nextStart)) blocks[i].end -= 1;
  }
  return blocks.filter((b) => b.end >= b.start + 1);
}

const isWeekdayWord = (s) => WEEKDAY_WORDS.has(norm(s));

/** Drop repeated fragments: merged cells repeat their text, sometimes twice in one cell. */
function dedupe(parts) {
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const key = norm(part);
    if (!key || seen.has(key)) continue;
    if (out.some((k) => norm(k).length >= 8 && (key.includes(norm(k)) || norm(k).includes(key)))) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

/** Join the pieces of one day's note into a single readable line. */
function joinNote(parts) {
  // Split the lines of a cell first: `clean` folds newlines into spaces, and a note is
  // often written on two or three lines.
  const pieces = dedupe(
    parts
      .flatMap((p) => String(p).split(/\r?\n/))
      .map((p) => clean(p))
      .filter(Boolean),
  );
  return pieces.join(' · ').replace(/\s*·\s*$/, '').trim();
}

// Deadlines before exams: "dépôt des épreuves" is a deadline, not an exam.
const CATEGORY_RULES = [
  ['break', /cong[ée]{1,2}s?|vacances?|d[ée]part en (cong[ée]s|vacances)/i],
  ['deadline', /d[ée]lai de d[ée]p[ôo]t|d[ée]p[ôo]t des [ée]preuves|remise des copies|r[eé]ception des notes/i],
  [
    'holiday',
    /toussaint|armistice|assomption|jour de l.?an|nouvel an|f[eê]te nationale|f[eê]te du travail|ascension|pentec[oô]te|f[eê]te du mouton|f[eê]te de la jeunesse|(vendredi|samedi) saint|de p[aâ]ques|mercredi des cendres|ramadan|saint-sylvestre|r[eé]veillon|no[eë]l/i,
  ],
  // `\b` only where the word starts with a plain letter — accented capitals (Évaluation)
  // are not word characters, so a boundary in front of them never matches.
  [
    'exam',
    /exam|examen|examens|[ée]valuation|[ée]valuations|pre-?test|final selection|[ée]preuves?|challenge|dict[ée]e|composition|\b(bepc|cep|blanc|cof\s*\d|eva\s*\d|concours)\b/i,
  ],
];

export function categorise(title) {
  for (const [category, re] of CATEGORY_RULES) if (re.test(title)) return category;
  return 'event';
}

/**
 * Read one sheet: every day that carries a note becomes an event.
 * `yearOf(month)` answers the year of a block when the sheet does not say.
 */
function readSheet(ws, defaultYear) {
  const spans = mergeSpans(ws);
  const monthRow = findMonthRow(ws);
  if (!monthRow) return [];
  const yearRow = findYearRow(ws, monthRow);
  const blocks = trimBlocks(monthBlocks(ws, monthRow), spans, monthRow);
  const events = [];

  for (const block of blocks) {
    const year = Number(clean(cellText(ws.getRow(yearRow ?? monthRow).getCell(block.start)))) || defaultYear;
    if (!year) continue;
    for (let r = monthRow + 1; r <= Math.min(ws.rowCount, monthRow + 32); r += 1) {
      const dayCell = ws.getRow(r).getCell(block.start);
      const insideRows = spans.some((s) => s.left <= block.start && s.right >= block.start && s.top < r && s.bottom >= r);
      const rawDay = clean(cellText(dayCell));
      const fromCell = !insideRows && /^\d{1,2}$/.test(rawDay) ? Number(rawDay) : null;
      const day = fromCell ?? r - monthRow;
      if (day < 1 || day > 31) continue;
      const iso = `${year}-${String(block.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!isValidISODate(iso)) continue;

      const parts = [];
      for (let c = block.start + 1; c <= block.end; c += 1) {
        // Raw text: the line breaks are what tells one line of a note from the next, and
        // `clean` (in joinNote) is what folds them.
        const raw = cellText(ws.getRow(r).getCell(c));
        const text = clean(raw);
        if (!text) continue;
        // The weekday column only holds a weekday; anything else there is part of the note
        // (a long note merged across the whole row starts in that column).
        if (c === block.start + 1 && isWeekdayWord(text)) continue;
        parts.push(raw);
      }
      const title = joinNote(parts);
      if (!title) continue;
      events.push({ date: iso, title, category: categorise(title) });
    }
  }
  return events;
}

/** Guess the year a sheet starts in, for sheets that do not repeat it above the months. */
function sheetYear(ws, monthRow) {
  for (let r = 1; r <= Math.min(monthRow ?? 6, ws.rowCount); r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const m = /(20\d{2})\s*[-/]\s*(\d{2,4})/.exec(clean(cellText(row.getCell(c))));
      if (m) return Number(m[1]);
    }
  }
  return null;
}

/**
 * Parse a planner workbook into events.
 * @returns {{events: Array, sheets: string[], skipped: string[], title: string|null}}
 */
export async function parsePlannerWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const events = [];
  const sheets = [];
  const skipped = [];
  let title = null;

  for (const ws of wb.worksheets) {
    const monthRow = findMonthRow(ws);
    if (!monthRow) {
      skipped.push(ws.name);
      continue;
    }
    if (!title) {
      for (let r = 1; r < monthRow; r += 1) {
        const text = clean(cellText(ws.getRow(r).getCell(1)));
        if (text && text.length > 4 && !/^\d+$/.test(text)) {
          title = text;
          break;
        }
      }
    }
    const year = sheetYear(ws, monthRow);
    const found = readSheet(ws, year);
    if (!found.length) {
      skipped.push(ws.name);
      continue;
    }
    sheets.push(ws.name);
    events.push(...found);
  }

  const byDate = new Map();
  for (const e of events) {
    const key = `${e.date}|${e.category}|${norm(e.title)}`;
    if (!byDate.has(key)) byDate.set(key, e);
  }
  const unique = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return { events: unique, sheets, skipped, title };
}

/** How the events spread over the year — shown before the school confirms the import. */
export function summarisePlanner(parsed) {
  const byCategory = {};
  const byMonth = {};
  for (const e of parsed.events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    const key = e.date.slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + 1;
  }
  return {
    title: parsed.title,
    sheets: parsed.sheets,
    skipped: parsed.skipped,
    count: parsed.events.length,
    byCategory,
    months: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    from: parsed.events[0]?.date ?? null,
    to: parsed.events.at(-1)?.date ?? null,
    sample: parsed.events.slice(0, 8),
  };
}
