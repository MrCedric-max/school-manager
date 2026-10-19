// Dashboard and Statistics sheets.
import { attendanceRate, coteFor, isNum, isPass, mean, passCote, passMark } from '../lib/grading.js';
import { notFound } from '../lib/http.js';
import { readClasses, findMonth, findWeek } from './context.js';
import { classPupils, getClass, loadDisciplineMarks } from './records.js';

const placeholders = (list) => list.map(() => '?').join(',') || "''";

/**
 * Share of a competence score that comes from the weekly controls when they are folded in
 * (statistics chart 8): 70% monthly evaluation, 30% weekly controls.
 */
export const CONTROL_WEIGHT = 0.3;

export function dashboard(db, ctx) {
  const { framework, settings, calendar, today } = ctx;
  const classes = readClasses(db);
  const monthlyCodes = framework.monthlyDisciplines.map((d) => d.code);

  // Monthly evaluations = one per pupil & month with monthly-card marks (/180).
  const evaluations = db
    .prepare(
      `SELECT m.pupil_id, p.class_id, m.month, SUM(m.value) AS total
         FROM discipline_marks m JOIN pupils p ON p.id = m.pupil_id
        WHERE m.discipline IN (${placeholders(monthlyCodes)})
        GROUP BY m.pupil_id, m.month`,
    )
    .all(...monthlyCodes)
    .map((e) => ({
      ...e,
      average: (e.total / framework.monthlyMax) * 20,
      cote: coteFor(e.total / framework.monthlyMax, settings.cotes),
    }));

  const controlRows = db
    .prepare(
      `SELECT c.pupil_id, p.class_id, c.week, AVG(c.value) AS avg
         FROM control_marks c JOIN pupils p ON p.id = c.pupil_id
        GROUP BY c.pupil_id, c.week`,
    )
    .all();

  const attendanceByClass = db
    .prepare(
      `SELECT p.class_id, a.mark, COUNT(*) AS n
         FROM attendance a JOIN pupils p ON p.id = a.pupil_id
        GROUP BY p.class_id, a.mark`,
    )
    .all();

  const rollTotals = { P: 0, A: 0, L: 0, E: 0 };
  const classAttendance = new Map();
  for (const r of attendanceByClass) {
    rollTotals[r.mark] += r.n;
    if (!classAttendance.has(r.class_id)) classAttendance.set(r.class_id, { P: 0, A: 0, L: 0, E: 0 });
    classAttendance.get(r.class_id)[r.mark] += r.n;
  }

  const todayMarks = new Map(
    db
      .prepare(
        `SELECT p.class_id, COUNT(*) AS n FROM attendance a JOIN pupils p ON p.id = a.pupil_id
          WHERE a.date = ? GROUP BY p.class_id`,
      )
      .all(today.date)
      .map((r) => [r.class_id, r.n]),
  );

  const perClass = classes.map((c) => {
    const evs = evaluations.filter((e) => e.class_id === c.id);
    const ctrl = controlRows.filter((r) => r.class_id === c.id);
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      enrolled: c.enrolled,
      evaluationAverage: mean(evs.map((e) => e.average)),
      controlsAverage: mean(ctrl.map((r) => r.avg)),
      attendanceRate: attendanceRate(classAttendance.get(c.id) ?? {}),
      studentsEvaluated: new Set(evs.map((e) => e.pupil_id)).size,
      rollToday: todayMarks.get(c.id) ?? 0,
    };
  });

  const subjectAverages = new Map(
    db.prepare('SELECT subject, AVG(value) AS avg FROM control_marks GROUP BY subject').all().map((r) => [r.subject, r.avg]),
  );
  const areaAverages = new Map(
    db.prepare('SELECT area, AVG(value) AS avg FROM performance_marks GROUP BY area').all().map((r) => [r.area, r.avg]),
  );

  const coteDistribution = settings.cotes.map((c) => ({
    code: c.code,
    en: c.en,
    fr: c.fr,
    count: evaluations.filter((e) => e.cote === c.code).length,
  }));

  return {
    today,
    totals: {
      enrolled: classes.reduce((a, c) => a + c.enrolled, 0),
      registered: classes.reduce((a, c) => a + c.registered, 0),
      classes: classes.length,
      generalAverage: mean(evaluations.map((e) => e.average)),
      attendanceRate: attendanceRate(rollTotals),
      schoolDays: calendar.summary.schoolDays,
      schoolDaysElapsed: calendar.schoolDays.filter((d) => d <= today.date).length,
      monthlyEvaluations: evaluations.length,
    },
    perClass,
    subjectAverages: framework.subjects.map((s) => ({
      code: s.code,
      label_en: s.label_en,
      label_fr: s.label_fr,
      average: subjectAverages.get(s.code) ?? null,
    })),
    areaAverages: framework.areas.map((a) => ({
      code: a.code,
      label_en: a.label_en,
      label_fr: a.label_fr,
      average: areaAverages.get(a.code) ?? null,
    })),
    coteDistribution,
    rollMarks: rollTotals,
  };
}

/** Statistics sheet: five per-class charts for a chosen week and month. */
export function statistics(db, ctx, classId, weekNo, monthKey) {
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  const month = findMonth(ctx, monthKey);
  if (!month) throw notFound('Month not found');
  const week = findWeek(ctx, weekNo);
  if (!week) throw notFound('Week not found');
  const { framework } = ctx;

  const perfByArea = new Map(
    db
      .prepare(
        `SELECT m.area, AVG(m.value) AS avg FROM performance_marks m JOIN pupils p ON p.id = m.pupil_id
          WHERE p.class_id = ? AND m.date BETWEEN ? AND ? GROUP BY m.area`,
      )
      .all(classId, month.firstDay, month.lastDay)
      .map((r) => [r.area, r.avg]),
  );

  const controlsBySubject = new Map(
    db
      .prepare(
        `SELECT c.subject, AVG(c.value) AS avg FROM control_marks c JOIN pupils p ON p.id = c.pupil_id
          WHERE p.class_id = ? AND c.week = ? GROUP BY c.subject`,
      )
      .all(classId, weekNo)
      .map((r) => [r.subject, r.avg]),
  );

  const marks = loadDisciplineMarks(db, classId, [month.key]);
  const pupilMarks = [...marks.values()].map((byMonth) => byMonth.get(month.key) ?? {});

  const disciplines = framework.disciplines.map((d) => {
    const avg = mean(pupilMarks.map((m) => m[d.code]));
    return {
      code: d.code,
      short_en: d.short_en,
      short_fr: d.short_fr,
      max: d.max,
      average: avg,
      pct: isNum(avg) ? avg / d.max : null,
    };
  });

  const competences = framework.competences.map((c) => {
    const codes = framework.disciplines.filter((d) => d.competence === c.number).map((d) => d.code);
    const totals = pupilMarks
      .map((m) => {
        const vals = codes.map((code) => m[code]).filter(isNum);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
      })
      .filter(isNum);
    const avg = mean(totals);
    return {
      number: c.number,
      short_en: c.short_en,
      short_fr: c.short_fr,
      max: c.max,
      average: avg,
      pct: isNum(avg) ? avg / c.max : null,
    };
  });

  const monthCounts = { P: 0, A: 0, L: 0, E: 0 };
  for (const r of db
    .prepare(
      `SELECT a.mark, COUNT(*) AS n FROM attendance a JOIN pupils p ON p.id = a.pupil_id
        WHERE p.class_id = ? AND a.date BETWEEN ? AND ? GROUP BY a.mark`,
    )
    .all(classId, month.firstDay, month.lastDay)) {
    monthCounts[r.mark] = r.n;
  }

  const trendRows = db
    .prepare(
      `SELECT substr(a.date, 1, 7) AS month, a.mark, COUNT(*) AS n FROM attendance a
         JOIN pupils p ON p.id = a.pupil_id WHERE p.class_id = ? GROUP BY month, a.mark`,
    )
    .all(classId);
  const trend = ctx.calendar.months.map((m) => {
    const counts = { P: 0, A: 0, L: 0, E: 0 };
    for (const r of trendRows) if (r.month === m.key) counts[r.mark] = r.n;
    return { key: m.key, name_en: m.name_en, name_fr: m.name_fr, rate: attendanceRate(counts) };
  });

  return {
    class: cls,
    week,
    month,
    /** Success rates: share of pupils who reached the pass mark (charts 6–9). */
    success: monthlySuccess(db, ctx, classId, month.key),
    performanceByArea: framework.areas.map((a) => ({
      code: a.code,
      label_en: a.label_en,
      label_fr: a.label_fr,
      average: perfByArea.get(a.code) ?? null,
    })),
    controlsBySubject: framework.subjects.map((s) => ({
      code: s.code,
      label_en: s.label_en,
      label_fr: s.label_fr,
      average: controlsBySubject.get(s.code) ?? null,
    })),
    disciplines,
    competences,
    attendance: { counts: monthCounts, rate: attendanceRate(monthCounts), trend },
  };
}

// ---------------------------------------------------------------------------
// Monthly success rates: the share of pupils who reached the pass mark, per
// competence and per subject of the monthly card (charts 6–9 of the sheet).

/** `AND p.class_id = ?` when a class is asked for, nothing for the whole school. */
function classClause(classId) {
  return classId === null || classId === undefined ? '' : ' AND p.class_id = ?';
}

function classParams(classId) {
  return classId === null || classId === undefined ? [] : [classId];
}

/** Pupil → { code: mark }, for every pupil of the class (or of the school) that has marks. */
function marksByPupil(db, sql, params) {
  const map = new Map();
  for (const r of db.prepare(sql).all(...params)) {
    if (!map.has(r.pupil_id)) map.set(r.pupil_id, {});
    map.get(r.pupil_id)[r.code] = r.value;
  }
  return map;
}

/**
 * Pupil → { subject: share of the maximum }, averaged over the weeks of the month: a control week is
 * a sample of the month, not a separate result.
 */
function controlsByPupil(db, classId, weekFrom, weekTo) {
  const rows = db
    .prepare(
      `SELECT c.pupil_id, c.subject AS code, s.max AS max, AVG(c.value) AS avg
         FROM control_marks c
         JOIN pupils p ON p.id = c.pupil_id
         JOIN control_subjects s ON s.code = c.subject
        WHERE c.week BETWEEN ? AND ?${classClause(classId)}
        GROUP BY c.pupil_id, c.subject`,
    )
    .all(weekFrom, weekTo, ...classParams(classId));
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.pupil_id)) map.set(r.pupil_id, {});
    map.get(r.pupil_id)[r.code] = r.max ? r.avg / r.max : null;
  }
  return map;
}

/**
 * Share of a pupil's marks for one row, as a fraction of the maximum.
 *
 * A row is judged only when every subject behind it was entered: a competence scored on half its
 * subjects would otherwise read as a failure. Pupils with a partial evaluation are left out and
 * counted in `skipped`, so the sheet can say how many results the rate rests on.
 */
function monthlyShare(marks, codes, max) {
  if (!max || !codes.length) return null;
  const values = codes.map((code) => marks?.[code]);
  if (values.some((v) => !isNum(v))) return null;
  return values.reduce((a, b) => a + b, 0) / max;
}

/** Average share of the weekly controls of a competence (null when the pupil has none of them). */
function controlShare(controls, codes) {
  const values = codes.map((code) => controls?.[code]).filter(isNum);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Success rates for one scope (a class, or the whole school when `classId` is null).
 *
 * `competences` and `subjects` look at the monthly card only; `competencesWithControls` folds the
 * weekly controls into them (70/30 — see CONTROL_WEIGHT).
 */
function successScope(db, ctx, classId, month) {
  const { framework, settings } = ctx;
  const threshold = passMark(settings.cotes);
  const pupils = classId === null || classId === undefined
    ? db.prepare('SELECT id FROM pupils').all().map((r) => r.id)
    : classPupils(db, classId).map((p) => p.id);

  const marks = marksByPupil(
    db,
    `SELECT m.pupil_id, m.discipline AS code, m.value FROM discipline_marks m
       JOIN pupils p ON p.id = m.pupil_id
      WHERE m.month = ?${classClause(classId)}`,
    [month.key, ...classParams(classId)],
  );
  const controls = controlsByPupil(db, classId, month.weekFrom, month.weekTo);

  /** Turn one share per pupil into "how many pupils passed, out of how many judged". */
  const row = (base, shares, controlsIncluded = 0) => {
    const judged = shares.filter(isNum);
    const passed = judged.filter((p) => isPass(p, settings.cotes)).length;
    return {
      ...base,
      evaluated: judged.length,
      skipped: shares.length - judged.length,
      passed,
      rate: judged.length ? passed / judged.length : null,
      averagePct: mean(judged),
      controlsIncluded,
    };
  };

  const monthlyCodes = (number) =>
    framework.monthlyDisciplines.filter((d) => d.competence === number).map((d) => d.code);
  const controlCodes = (number) => framework.subjects.filter((s) => s.competence === number).map((s) => s.code);

  const competences = framework.competences.map((c) => {
    const codes = monthlyCodes(c.number);
    return row(
      {
        key: `C${c.number}`,
        number: c.number,
        short_en: c.short_en,
        short_fr: c.short_fr,
        title_en: c.title_en,
        title_fr: c.title_fr,
        max: c.monthlyMax,
        subjects: codes,
      },
      pupils.map((id) => monthlyShare(marks.get(id), codes, c.monthlyMax)),
    );
  });

  const competencesWithControls = framework.competences.map((c) => {
    const codes = monthlyCodes(c.number);
    const cCodes = controlCodes(c.number);
    let controlsIncluded = 0;
    const shares = pupils.map((id) => {
      const monthly = monthlyShare(marks.get(id), codes, c.monthlyMax);
      const control = controlShare(controls.get(id), cCodes);
      if (isNum(monthly) && isNum(control)) {
        controlsIncluded += 1;
        return (1 - CONTROL_WEIGHT) * monthly + CONTROL_WEIGHT * control;
      }
      // No controls for this competence (or no monthly card): judge on what exists.
      return isNum(monthly) ? monthly : control;
    });
    return row(
      {
        key: `C${c.number}`,
        number: c.number,
        short_en: c.short_en,
        short_fr: c.short_fr,
        title_en: c.title_en,
        title_fr: c.title_fr,
        max: c.monthlyMax,
        subjects: codes,
        controlSubjects: cCodes,
      },
      shares,
      controlsIncluded,
    );
  });

  const subjects = framework.monthlyDisciplines.map((d) =>
    row(
      {
        key: d.code,
        code: d.code,
        short_en: d.short_en,
        short_fr: d.short_fr,
        label_en: d.label_en,
        label_fr: d.label_fr,
        max: d.max,
      },
      pupils.map((id) => monthlyShare(marks.get(id), [d.code], d.max)),
    ),
  );

  return { competences, competencesWithControls, subjects };
}

/**
 * Monthly success rates — the share of pupils who reached the pass mark — for one class and for the
 * whole school, on the monthly card and (for competences) with the weekly controls folded in.
 */
export function monthlySuccess(db, ctx, classId, monthKey) {
  const month = findMonth(ctx, monthKey);
  if (!month) throw notFound('Month not found');
  const { settings } = ctx;

  return {
    month,
    passMark: passMark(settings.cotes),
    passCote: passCote(settings.cotes),
    controlWeight: CONTROL_WEIGHT,
    /** Rows that can never have a rate: competences with no subject on the monthly card. */
    notEvaluated: ctx.framework.competences.filter((c) => !c.monthlyMax).map((c) => c.number),
    class: successScope(db, ctx, classId, month),
    school: successScope(db, ctx, null, month),
  };
}
