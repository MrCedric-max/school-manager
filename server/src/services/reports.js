// Weekly / Monthly / Term class reports and the two report cards —
// the web equivalent of the workbook's report sheets.
import { schoolDaysBetween } from '../lib/calendar.js';
import {
  columnStats,
  coteFor,
  isNum,
  mean,
  overallScore,
  rankDescending,
  sumOrNull,
} from '../lib/grading.js';
import { notFound } from '../lib/http.js';
import { findMonth, findTerm, findWeek } from './context.js';
import {
  attendanceSummary,
  classPupils,
  controlsSummary,
  getClass,
  loadAttendance,
  loadAttitudes,
  loadControls,
  loadDisciplineMarks,
  loadPerformance,
  loadRemarks,
  performanceSummary,
  range,
  visiblePupils,
} from './records.js';

const pct = (value, max) => (isNum(value) && max ? value / max : null);

/**
 * Evaluate one pupil's marks for one month, both for the full framework
 * (/280, term card) and for the monthly-card scope (/180).
 */
export function evaluateMonth(marks, framework, cotes) {
  const notes = {};
  for (const d of framework.disciplines) notes[d.code] = isNum(marks?.[d.code]) ? marks[d.code] : null;

  const scope = (disciplines, maxKey, totalMax) => {
    const competences = {};
    for (const c of framework.competences) {
      const ds = disciplines.filter((d) => d.competence === c.number);
      if (!ds.length) continue;
      competences[c.number] = sumOrNull(ds.map((d) => notes[d.code]));
    }
    const entered = disciplines.filter((d) => isNum(notes[d.code])).length;
    const total = sumOrNull(disciplines.map((d) => notes[d.code]));
    const average = isNum(total) ? (total / totalMax) * 20 : null;
    return {
      competences,
      total,
      average,
      cote: coteFor(pct(total, totalMax), cotes),
      entered,
      complete: entered === disciplines.length,
      maxKey,
    };
  };

  return {
    notes,
    full: scope(framework.disciplines, 'max', framework.totalMax),
    monthly: scope(framework.monthlyDisciplines, 'monthlyMax', framework.monthlyMax),
  };
}

function requireClass(db, classId) {
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  return cls;
}

function statsMap(rows, codes, pick) {
  return Object.fromEntries(codes.map((code) => [code, columnStats(rows.map((r) => pick(r, code)))]));
}

// ---------------------------------------------------------------------------
// Weekly report: controls + daily performance + attendance for one week.
// Rank = weekly controls average /20.
// ---------------------------------------------------------------------------
export function weeklyReport(db, ctx, classId, weekNo) {
  const cls = requireClass(db, classId);
  const week = findWeek(ctx, weekNo);
  if (!week) throw notFound('Week not found');
  const { subjects, areas } = ctx.framework;
  const { cotes } = ctx.settings;
  const dates = schoolDaysBetween(ctx.calendar, week.monday, week.friday);

  const controls = loadControls(db, classId, weekNo, weekNo);
  const perf = loadPerformance(db, classId, week.monday, week.friday);
  const att = loadAttendance(db, classId, week.monday, week.friday);
  const pupils = visiblePupils(classPupils(db, classId), new Set([...controls.keys(), ...perf.keys(), ...att.keys()]));

  const rows = pupils.map((p, i) => {
    const c = controls.get(p.id)?.get(weekNo) ?? {};
    const marks = Object.fromEntries(subjects.map((s) => [s.code, isNum(c[s.code]) ? c[s.code] : null]));
    const controlsAverage = mean(Object.values(marks));
    const ps = performanceSummary(perf.get(p.id), dates, areas);
    return {
      n: i + 1,
      pupilId: p.id,
      studentId: p.student_id,
      name: p.full_name,
      status: p.status,
      controls: marks,
      controlsAverage,
      controlsCote: coteFor(pct(controlsAverage, 20), cotes),
      performance: ps.areas,
      performanceAverage: ps.average,
      performanceEntries: ps.entries,
      attendance: attendanceSummary(att.get(p.id), dates),
      rank: null,
    };
  });

  const { ranks, count } = rankDescending(rows.map((r) => ({ key: r.pupilId, value: r.controlsAverage })));
  for (const r of rows) r.rank = ranks.get(r.pupilId) ?? null;

  return {
    class: cls,
    week: { ...week, dates },
    rows,
    footer: {
      controls: statsMap(rows, subjects.map((s) => s.code), (r, k) => r.controls[k]),
      controlsAverage: columnStats(rows.map((r) => r.controlsAverage)),
      performance: statsMap(rows, areas.map((a) => a.code), (r, k) => r.performance[k]),
      performanceAverage: columnStats(rows.map((r) => r.performanceAverage)),
      attendanceRate: columnStats(rows.map((r) => r.attendance.rate)),
    },
    counts: {
      schoolDays: dates.length,
      controlsLogged: rows.filter((r) => Object.values(r.controls).some(isNum)).length,
      performanceEntries: rows.reduce((a, r) => a + r.performanceEntries, 0),
      rollMarks: rows.reduce((a, r) => a + r.attendance.marked, 0),
      ranked: count,
    },
  };
}

// ---------------------------------------------------------------------------
// Monthly report: monthly-card marks (/180) + control averages over the
// month's weeks + daily performance + attendance. Rank = overall /20.
// ---------------------------------------------------------------------------
export function monthlyReport(db, ctx, classId, monthKey) {
  const cls = requireClass(db, classId);
  const month = findMonth(ctx, monthKey);
  if (!month) throw notFound('Month not found');
  const { framework } = ctx;
  const { subjects, areas } = framework;
  const { cotes, academicWeight } = ctx.settings;
  const dates = schoolDaysBetween(ctx.calendar, month.firstDay, month.lastDay);
  const weeks = range(month.weekFrom, month.weekTo);

  const marks = loadDisciplineMarks(db, classId, [monthKey]);
  const controls = loadControls(db, classId, month.weekFrom, month.weekTo);
  const perf = loadPerformance(db, classId, month.firstDay, month.lastDay);
  const att = loadAttendance(db, classId, month.firstDay, month.lastDay);
  const pupils = visiblePupils(
    classPupils(db, classId),
    new Set([...marks.keys(), ...controls.keys(), ...perf.keys(), ...att.keys()]),
  );

  const rows = pupils.map((p, i) => {
    const ev = evaluateMonth(marks.get(p.id)?.get(monthKey), framework, cotes);
    const cs = controlsSummary(controls.get(p.id), weeks, subjects);
    const ps = performanceSummary(perf.get(p.id), dates, areas);
    const overall = overallScore(ev.monthly.average, ps.average, academicWeight);
    return {
      n: i + 1,
      pupilId: p.id,
      studentId: p.student_id,
      name: p.full_name,
      status: p.status,
      notes: ev.notes,
      competences: ev.monthly.competences,
      total: ev.monthly.total,
      average: ev.monthly.average,
      cote: ev.monthly.cote,
      entered: ev.monthly.entered,
      complete: ev.monthly.complete,
      controls: cs.subjects,
      controlsAverage: cs.average,
      controlsLogged: cs.rows,
      performance: ps.areas,
      performanceAverage: ps.average,
      performanceEntries: ps.entries,
      attendance: attendanceSummary(att.get(p.id), dates),
      overall,
      overallCote: coteFor(pct(overall, 20), cotes),
      rank: null,
    };
  });

  const { ranks, count } = rankDescending(rows.map((r) => ({ key: r.pupilId, value: r.overall })));
  for (const r of rows) r.rank = ranks.get(r.pupilId) ?? null;

  const monthlyCompetences = framework.competences.filter((c) => c.monthlyMax > 0);
  return {
    class: cls,
    month: { ...month, dates, weeks },
    rows,
    footer: {
      competences: statsMap(rows, monthlyCompetences.map((c) => c.number), (r, k) => r.competences[k]),
      total: columnStats(rows.map((r) => r.total)),
      average: columnStats(rows.map((r) => r.average)),
      controls: statsMap(rows, subjects.map((s) => s.code), (r, k) => r.controls[k]),
      performanceAverage: columnStats(rows.map((r) => r.performanceAverage)),
      attendance: {
        P: columnStats(rows.map((r) => r.attendance.P)),
        A: columnStats(rows.map((r) => r.attendance.A)),
        L: columnStats(rows.map((r) => r.attendance.L)),
        rate: columnStats(rows.map((r) => r.attendance.rate)),
      },
      overall: columnStats(rows.map((r) => r.overall)),
    },
    counts: {
      schoolDays: dates.length,
      studentsEvaluated: rows.filter((r) => r.entered > 0).length,
      controlsLogged: rows.reduce((a, r) => a + r.controlsLogged, 0),
      performanceEntries: rows.reduce((a, r) => a + r.performanceEntries, 0),
      classAverage: mean(rows.map((r) => r.average)),
      ranked: count,
    },
  };
}

// ---------------------------------------------------------------------------
// Term report: each value is the average of the term's monthly evaluations
// (UA1–UA3 months); performance, attendance, overall and rank cover the term.
// ---------------------------------------------------------------------------
export function termReport(db, ctx, classId, termNo) {
  const cls = requireClass(db, classId);
  const term = findTerm(ctx, termNo);
  if (!term) throw notFound('Term not found');
  const { framework } = ctx;
  const { subjects, areas } = framework;
  const { cotes, academicWeight } = ctx.settings;
  const dates = schoolDaysBetween(ctx.calendar, term.start, term.end);
  const weeks = range(term.weekFrom, term.weekTo);
  const months = term.uaMonths;

  const marks = loadDisciplineMarks(db, classId, months);
  const controls = loadControls(db, classId, term.weekFrom, term.weekTo);
  const perf = loadPerformance(db, classId, term.start, term.end);
  const att = loadAttendance(db, classId, term.start, term.end);
  const pupils = visiblePupils(
    classPupils(db, classId),
    new Set([...marks.keys(), ...controls.keys(), ...perf.keys(), ...att.keys()]),
  );

  const rows = pupils.map((p, i) => {
    const monthly = months.map((m) => evaluateMonth(marks.get(p.id)?.get(m), framework, cotes));
    const notes = Object.fromEntries(framework.disciplines.map((d) => [d.code, mean(monthly.map((e) => e.notes[d.code]))]));
    const competences = Object.fromEntries(
      framework.competences.map((c) => [c.number, mean(monthly.map((e) => e.full.competences[c.number]))]),
    );
    const total = mean(monthly.map((e) => e.full.total));
    const average = isNum(total) ? (total / framework.totalMax) * 20 : null;
    const cs = controlsSummary(controls.get(p.id), weeks, subjects);
    const ps = performanceSummary(perf.get(p.id), dates, areas);
    const overall = overallScore(average, ps.average, academicWeight);
    return {
      n: i + 1,
      pupilId: p.id,
      studentId: p.student_id,
      name: p.full_name,
      status: p.status,
      monthly,
      notes,
      competences,
      total,
      average,
      cote: coteFor(pct(total, framework.totalMax), cotes),
      monthsEvaluated: monthly.filter((e) => e.full.entered > 0).length,
      controls: cs.subjects,
      controlsLogged: cs.rows,
      performance: ps.areas,
      performanceAverage: ps.average,
      performanceEntries: ps.entries,
      attendance: attendanceSummary(att.get(p.id), dates),
      overall,
      overallCote: coteFor(pct(overall, 20), cotes),
      rank: null,
    };
  });

  const { ranks, count } = rankDescending(rows.map((r) => ({ key: r.pupilId, value: r.overall })));
  for (const r of rows) r.rank = ranks.get(r.pupilId) ?? null;

  return {
    class: cls,
    term: { ...term, dates, weeks },
    rows,
    footer: {
      competences: statsMap(rows, framework.competences.map((c) => c.number), (r, k) => r.competences[k]),
      total: columnStats(rows.map((r) => r.total)),
      average: columnStats(rows.map((r) => r.average)),
      controls: statsMap(rows, subjects.map((s) => s.code), (r, k) => r.controls[k]),
      performanceAverage: columnStats(rows.map((r) => r.performanceAverage)),
      attendance: {
        P: columnStats(rows.map((r) => r.attendance.P)),
        A: columnStats(rows.map((r) => r.attendance.A)),
        L: columnStats(rows.map((r) => r.attendance.L)),
        rate: columnStats(rows.map((r) => r.attendance.rate)),
      },
      overall: columnStats(rows.map((r) => r.overall)),
    },
    counts: {
      schoolDays: dates.length,
      studentsEvaluated: rows.filter((r) => r.monthsEvaluated > 0).length,
      controlsLogged: rows.reduce((a, r) => a + r.controlsLogged, 0),
      performanceEntries: rows.reduce((a, r) => a + r.performanceEntries, 0),
      classAverage: mean(rows.map((r) => r.average)),
      classAverageByMonth: months.map((_, i) => mean(rows.map((r) => r.monthly[i].full.average))),
      ranked: count,
    },
  };
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------
function schoolHeader(ctx) {
  const s = ctx.settings;
  return { name: s.schoolName, subtitle: s.schoolSubtitle, academicYear: s.academicYear, logo: s.logo };
}

function cotePair(note, max, cotes) {
  const p = pct(note, max);
  return { note: isNum(note) ? note : null, pct: p, cote: coteFor(p, cotes) };
}

/** Monthly report card (Competences 1 without national languages, 2, 4, 5 — /180). */
export function monthlyCards(db, ctx, classId, monthKey, pupilId) {
  const report = monthlyReport(db, ctx, classId, monthKey);
  const { framework } = ctx;
  const { cotes } = ctx.settings;
  const remarks = loadRemarks(db, classId, `M:${monthKey}`);
  const rows = pupilId ? report.rows.filter((r) => r.pupilId === pupilId) : report.rows;
  const monthlyCompetences = framework.competences.filter((c) => c.monthlyMax > 0);

  const cards = rows.map((r) => ({
    pupil: { id: r.pupilId, studentId: r.studentId, name: r.name },
    competences: monthlyCompetences.map((c) => ({
      number: c.number,
      title_fr: c.title_fr,
      title_en: c.title_en,
      max: c.monthlyMax,
      disciplines: framework.monthlyDisciplines
        .filter((d) => d.competence === c.number)
        .map((d) => ({
          code: d.code,
          label: d.label,
          max: d.max,
          criteria: d.criteria,
          ...cotePair(r.notes[d.code], d.max, cotes),
        })),
      ...cotePair(r.competences[c.number], c.monthlyMax, cotes),
    })),
    total: { ...cotePair(r.total, framework.monthlyMax, cotes), max: framework.monthlyMax },
    average: r.average,
    complete: r.complete,
    performance: r.performance,
    performanceAverage: r.performanceAverage,
    attendance: r.attendance,
    overall: r.overall,
    overallCote: r.overallCote,
    rank: r.rank,
    remarks: remarks.get(r.pupilId) ?? '',
  }));

  return {
    school: schoolHeader(ctx),
    class: report.class,
    month: report.month,
    classAverage: report.counts.classAverage,
    ranked: report.counts.ranked,
    pupilsInClass: report.rows.length,
    cards,
  };
}

/** Term report card (full framework /280, UA1–UA3 + term note, attitudes). */
export function termCards(db, ctx, classId, termNo, pupilId) {
  const report = termReport(db, ctx, classId, termNo);
  const { framework } = ctx;
  const { cotes } = ctx.settings;
  const months = report.term.uaMonths;
  const attitudes = loadAttitudes(db, classId, months);
  const remarks = loadRemarks(db, classId, `T:${termNo}`);
  const rows = pupilId ? report.rows.filter((r) => r.pupilId === pupilId) : report.rows;

  const cards = rows.map((r) => ({
    pupil: { id: r.pupilId, studentId: r.studentId, name: r.name },
    competences: framework.competences.map((c) => ({
      number: c.number,
      title_fr: c.title_fr,
      title_en: c.title_en,
      max: c.max,
      disciplines: framework.disciplines
        .filter((d) => d.competence === c.number)
        .map((d) => ({
          code: d.code,
          label: d.label,
          max: d.max,
          criteria: d.criteria,
          ua: r.monthly.map((e) => cotePair(e.notes[d.code], d.max, cotes)),
          term: cotePair(r.notes[d.code], d.max, cotes),
        })),
    })),
    totals: {
      ua: r.monthly.map((e) => e.full.total),
      term: r.total,
      max: framework.totalMax,
    },
    averages: { ua: r.monthly.map((e) => e.full.average), term: r.average },
    termCote: r.cote,
    performance: r.performance,
    performanceAverage: r.performanceAverage,
    attendance: r.attendance,
    overall: r.overall,
    overallCote: r.overallCote,
    rank: r.rank,
    attitudes: framework.attitudes.map((a) => ({
      code: a.code,
      label_fr: a.label_fr,
      label_en: a.label_en,
      ua: months.map((m) => attitudes.get(r.pupilId)?.get(m)?.[a.code] ?? null),
    })),
    remarks: remarks.get(r.pupilId) ?? '',
  }));

  return {
    school: schoolHeader(ctx),
    class: report.class,
    term: report.term,
    classAverage: report.counts.classAverage,
    classAverageByMonth: report.counts.classAverageByMonth,
    ranked: report.counts.ranked,
    pupilsInClass: report.rows.length,
    cards,
  };
}
