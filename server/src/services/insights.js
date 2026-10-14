// Dashboard and Statistics sheets.
import { attendanceRate, coteFor, isNum, mean } from '../lib/grading.js';
import { notFound } from '../lib/http.js';
import { readClasses, findMonth, findWeek } from './context.js';
import { getClass, loadDisciplineMarks } from './records.js';

const placeholders = (list) => list.map(() => '?').join(',') || "''";

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
