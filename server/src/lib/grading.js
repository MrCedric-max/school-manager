// Grading rules of the School_Manager workbook.

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Average of the numeric values (blank cells ignored, like Excel's AVERAGE). */
export function mean(values) {
  let total = 0;
  let n = 0;
  for (const v of values) {
    if (isNum(v)) {
      total += v;
      n += 1;
    }
  }
  return n ? total / n : null;
}

/** Sum of the numeric values, or null when nothing was entered. */
export function sumOrNull(values) {
  let total = 0;
  let n = 0;
  for (const v of values) {
    if (isNum(v)) {
      total += v;
      n += 1;
    }
  }
  return n ? total : null;
}

export function round(value, digits = 2) {
  if (!isNum(value)) return null;
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Cote for a percentage (0–1): A+ ≥ 90% · A ≥ 75% · ECA/B ≥ 50% · NA < 50%.
 * `cotes` is ordered from highest to lowest minimum.
 */
export function coteFor(pct, cotes) {
  if (!isNum(pct)) return null;
  for (const c of cotes) {
    if (pct >= c.min - 1e-9) return c.code;
  }
  return cotes[cotes.length - 1]?.code ?? null;
}

/**
 * Overall score /20 = academic% × academic average + (1 − academic%) × daily
 * performance average rescaled to /20. Without performance data the academic
 * average is used on its own.
 */
export function overallScore(academic20, perf10, academicWeight = 0.7) {
  if (!isNum(academic20)) return null;
  if (!isNum(perf10)) return academic20;
  return academicWeight * academic20 + (1 - academicWeight) * perf10 * 2;
}

/** Attendance rate = (Present + Late) ÷ days marked. Late pupils were present. */
export function attendanceRate({ P = 0, A = 0, L = 0, E = 0 }) {
  const total = P + A + L + E;
  return total ? (P + L) / total : null;
}

/**
 * Competition ranking (Excel RANK.EQ, descending): ties share a rank and the
 * next rank is skipped. Returns a Map key → rank, plus the number ranked.
 */
export function rankDescending(entries) {
  const valid = entries.filter((e) => isNum(e.value)).map((e) => ({ ...e, v: round(e.value, 6) }));
  const ranks = new Map();
  for (const e of valid) {
    ranks.set(e.key, 1 + valid.filter((o) => o.v > e.v).length);
  }
  return { ranks, count: valid.length };
}

/** Class average / highest / lowest of a column (blank values ignored). */
export function columnStats(values) {
  const nums = values.filter(isNum);
  if (!nums.length) return { avg: null, max: null, min: null, count: 0 };
  return {
    avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    max: Math.max(...nums),
    min: Math.min(...nums),
    count: nums.length,
  };
}

/** Parse a mark typed by a user ("12,5" or "12.5"). Returns NaN when invalid. */
export function parseMark(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') return input;
  const n = Number(String(input).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
}
