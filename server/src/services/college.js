// The college: subjects with coefficients, six-week séquences, and the bulletin de notes.
//
// Where the primary is marked by discipline (/280, monthly and term cards), the college
// is marked by subject out of twenty, weighted by a coefficient, and reported twice a term
// — once per séquence of six weeks — on the MINESEC bulletin.
import { COLLEGE_GROUPS, COLLEGE_SUBJECT_TEMPLATE } from '../db/defaults.js';
import { mean, rankDescending, round } from '../lib/grading.js';
import { notFound, badRequest } from '../lib/http.js';
import { mentionFor, cycleOf } from '../lib/cycles.js';
import { getClass, visiblePupils } from './records.js';

// ---- The subjects of a class ---------------------------------------------------

/**
 * The subjects of one class, in the order they are printed: group 1, then 2, then 3.
 * They belong to the class, because 6ème and 3ème do not weigh the same subjects.
 */
export function collegeSubjects(db, classId) {
  return db
    .prepare('SELECT * FROM college_subjects WHERE class_id = ? ORDER BY group_no, sort_order, id')
    .all(classId)
    .map((s) => ({
      id: s.id,
      classId: s.class_id,
      code: s.code,
      label: s.label_fr,
      labelEn: s.label_en,
      groupNo: s.group_no,
      coefficient: s.coefficient,
      teacher: s.teacher,
    }));
}

/** Give a college class its starting list of subjects (only when it has none). */
export function ensureClassSubjects(db, classId) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM college_subjects WHERE class_id = ?').get(classId).n;
  if (n > 0) return 0;
  const stmt = db.prepare(
    'INSERT INTO college_subjects (class_id, code, label_fr, label_en, group_no, coefficient, teacher, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    COLLEGE_SUBJECT_TEMPLATE.forEach(([code, fr, en, group, coef], i) => stmt.run(classId, code, fr, en, group, coef, '', i + 1));
  })();
  return COLLEGE_SUBJECT_TEMPLATE.length;
}

/** Replace the subject list of a class (Settings → Subjects of the college). */
export function saveCollegeSubjects(db, classId, subjects) {
  if (!Array.isArray(subjects)) throw badRequest('The subjects must be a list');
  const clean = subjects.map((s, i) => {
    const label = String(s?.labelFr ?? s?.label_fr ?? '').trim().slice(0, 80);
    if (!label) throw badRequest(`Subject ${i + 1} needs a name`);
    const code = String(s?.code ?? '').trim().slice(0, 40) || slug(label);
    const coef = Number(s?.coefficient ?? s?.coef ?? 1);
    if (!Number.isFinite(coef) || coef <= 0 || coef > 20) throw badRequest(`"${label}" needs a coefficient between 0 and 20`);
    const group = Number(s?.group_no ?? s?.groupNo ?? 1);
    if (![1, 2, 3].includes(group)) throw badRequest(`"${label}" must be in group 1, 2 or 3`);
    return {
      code,
      label_fr: label,
      label_en: String(s?.labelEn ?? s?.label_en ?? '').trim().slice(0, 80),
      group_no: group,
      coefficient: coef,
      teacher: String(s?.teacher ?? '').trim().slice(0, 120),
      sort_order: i + 1,
    };
  });
  const codes = new Set(clean.map((s) => s.code));
  if (codes.size !== clean.length) throw badRequest('Two subjects cannot share the same short name');
  if (!clean.length) throw badRequest('A college class needs at least one subject');

  db.transaction(() => {
    db.prepare('DELETE FROM college_subjects WHERE class_id = ?').run(classId);
    const stmt = db.prepare(
      'INSERT INTO college_subjects (class_id, code, label_fr, label_en, group_no, coefficient, teacher, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const s of clean) stmt.run(classId, s.code, s.label_fr, s.label_en, s.group_no, s.coefficient, s.teacher, s.sort_order);
  })();
  return collegeSubjects(db, classId);
}

function slug(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'matiere'
  );
}

// ---- The six-week séquences -----------------------------------------------------

/**
 * The séquences of the year: each term's teaching weeks cut in two, so a term holds two
 * séquences of about six weeks. Sequence 3 and 4 belong to term 2, as on the bulletin.
 */
export function sequenceGrid(ctx) {
  const out = [];
  for (const term of ctx.calendar.terms) {
    const weeks = ctx.calendar.weeks.filter((w) => w.term === term.number && w.schoolDays > 0);
    if (!weeks.length) continue;
    const half = Math.ceil(weeks.length / 2);
    [weeks.slice(0, half), weeks.slice(half)].forEach((part, i) => {
      if (!part.length) return;
      out.push({
        number: (term.number - 1) * 2 + i + 1,
        term: term.number,
        part: i + 1,
        label: `Séquence ${(term.number - 1) * 2 + i + 1}`,
        start: part[0].monday,
        end: part.at(-1).friday,
        weeks: part.map((w) => w.number),
        schoolDays: part.reduce((a, w) => a + w.schoolDays, 0),
      });
    });
  }
  return out;
}

export function sequencesOfTerm(grid, term) {
  return grid.filter((s) => s.term === term).map((s) => s.number);
}

// ---- Reading and writing marks ---------------------------------------------------

/** Marks of a term: pupil → subject → { '3': {interro, devoir, mark}, … }. */
export function loadSequenceMarks(db, classId, term) {
  const grid = {};
  const rows = db
    .prepare(
      `SELECT m.pupil_id, m.sequence, m.subject, m.kind, m.value
         FROM sequence_marks m
         JOIN pupils p ON p.id = m.pupil_id
        WHERE p.class_id = ? AND m.term = ?
        ORDER BY m.sequence, m.subject`,
    )
    .all(classId, term);
  for (const r of rows) {
    const bySubject = (grid[r.pupil_id] ??= {});
    const bySequence = (bySubject[r.subject] ??= {});
    (bySequence[r.sequence] ??= {})[r.kind] = r.value;
  }
  return grid;
}

/** One pupil's marks for one séquence: { interro: 12, devoir: 14 }. */
export function subjectMarks(markRow, sequence) {
  return markRow?.[sequence] ?? {};
}

const round2 = (v) => (Number.isFinite(v) ? round(v, 2) : null);

/** The mark of a subject for a séquence: the average of the tests written for it. */
export function sequenceMark(markRow, sequence) {
  const kinds = Object.values(subjectMarks(markRow, sequence)).filter((v) => Number.isFinite(v));
  return round2(mean(kinds));
}

/** The mark of a subject for a term: the average of its two séquences. */
export function termMark(markRow, sequences) {
  const marks = sequences.map((s) => sequenceMark(markRow, s)).filter((v) => Number.isFinite(v));
  return round2(mean(marks));
}

/** Weighted average of { value, coefficient } rows, as the bulletin computes it. */
export function weightedAverage(rows) {
  const valid = rows.filter((r) => Number.isFinite(r.value));
  const coef = valid.reduce((a, r) => a + r.coefficient, 0);
  if (!coef) return null;
  return round2(valid.reduce((a, r) => a + r.value * r.coefficient, 0) / coef);
}

export function saveSequenceMark(db, { pupilId, term, sequence, subject, kind, value }) {
  if (!['interro', 'devoir'].includes(kind)) throw badRequest('A test is either an interrogation or a devoir');
  if (value === null || value === undefined || value === '') {
    db.prepare('DELETE FROM sequence_marks WHERE pupil_id = ? AND sequence = ? AND subject = ? AND kind = ?').run(
      pupilId,
      sequence,
      subject,
      kind,
    );
    return null;
  }
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0 || v > 20) throw badRequest('A mark is between 0 and 20');
  db.prepare(
    `INSERT INTO sequence_marks (pupil_id, term, sequence, subject, kind, value) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (pupil_id, sequence, subject, kind) DO UPDATE SET value = excluded.value, term = excluded.term, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(pupilId, term, sequence, subject, kind, v);
  return v;
}

// ---- The bulletin de notes --------------------------------------------------------

/**
 * Everything the bulletin prints for one class and one term: the subjects with their
 * séquence and term marks, the group averages, the ranks, the points, the pupil's general
 * average, and the profile of the class to compare them with.
 */
export function collegeBulletin(db, ctx, classId, termNo) {
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  const cycle = cycleOf(cls);
  const term = ctx.calendar.terms.find((t) => t.number === termNo);
  if (!term) throw notFound('Term not found');

  const subjects = collegeSubjects(db, classId);
  const sequences = sequencesOfTerm(sequenceGrid(ctx), termNo);
  const marks = loadSequenceMarks(db, classId, termNo);
  const pupils = visiblePupils(
    db
      .prepare(
        `SELECT id, student_id, class_no, full_name, gender, status, date_of_birth, place_of_birth, address, guardian
           FROM pupils WHERE class_id = ? ORDER BY class_no, full_name`,
      )
      .all(classId),
    new Set(Object.keys(marks).map(Number)),
  );
  const conduct = loadConduct(db, classId, termNo);
  const remarks = loadRemarks(db, classId, termNo);
  const attendance = loadTermAttendance(db, classId, term);

  // Marks per pupil: subject → { seq3, seq4, trim }, then the group rows, then the totals.
  const rows = pupils.map((p) => {
    const bySubject = marks[p.id] ?? {};
    const subjectRows = subjects.map((s) => {
      const row = bySubject[s.code] ?? {};
      const seq = Object.fromEntries(sequences.map((n) => [n, sequenceMark(row, n)]));
      const trim = termMark(row, sequences);
      return { code: s.code, label: s.label, labelEn: s.labelEn, groupNo: s.groupNo, coefficient: s.coefficient, teacher: s.teacher, seq, trim };
    });
    const groupRows = COLLEGE_GROUPS.map((g) => {
      const members = subjectRows.filter((s) => s.groupNo === g.no);
      if (!members.length) return null;
      const seq = Object.fromEntries(sequences.map((n) => [n, weightedAverage(members.map((m) => ({ value: m.seq[n], coefficient: m.coefficient })))]));
      return { groupNo: g.no, label: g.fr, labelEn: g.en, coefficient: members.reduce((a, m) => a + m.coefficient, 0), seq, trim: weightedAverage(members.map((m) => ({ value: m.trim, coefficient: m.coefficient }))) };
    }).filter(Boolean);

    const points = subjectRows.reduce((a, s) => a + (Number.isFinite(s.trim) ? s.trim * s.coefficient : 0), 0);
    const coefficient = subjectRows.reduce((a, s) => a + s.coefficient, 0);
    const average = weightedAverage(subjectRows.map((s) => ({ value: s.trim, coefficient: s.coefficient })));
    return {
      pupilId: p.id,
      studentId: p.student_id,
      classNo: p.class_no,
      name: p.full_name,
      gender: p.gender,
      dateOfBirth: p.date_of_birth,
      placeOfBirth: p.place_of_birth,
      address: p.address,
      guardian: p.guardian,
      status: p.status,
      subjects: subjectRows,
      groups: groupRows,
      points: round2(points),
      coefficient,
      average,
      mention: mentionFor(average),
      sequenceAverages: Object.fromEntries(sequences.map((n) => [n, weightedAverage(subjectRows.map((s) => ({ value: s.seq[n], coefficient: s.coefficient })))])),
      conduct: conduct.get(p.id) ?? null,
      remark: remarks.get(p.id) ?? '',
      attendance: attendance.get(p.id) ?? { justified: 0, unjustified: 0, late: 0, present: 0 },
      rank: null,
    };
  });

  // Ranks: per subject, per group, and the general rank of the pupil in the class.
  const rank = (values) => {
    const { ranks } = rankDescending(pupils.map((p, i) => ({ key: p.id, value: values(rows[i]) })));
    return ranks;
  };
  for (const s of subjects) {
    const ranks = rank((row) => row.subjects.find((x) => x.code === s.code)?.trim ?? null);
    for (const row of rows) {
      const cell = row.subjects.find((x) => x.code === s.code);
      cell.rank = ranks.get(row.pupilId) ?? null;
    }
  }
  for (const g of COLLEGE_GROUPS) {
    const ranks = rank((row) => row.groups.find((x) => x.groupNo === g.no)?.trim ?? null);
    for (const row of rows) {
      const cell = row.groups.find((x) => x.groupNo === g.no);
      if (cell) cell.rank = ranks.get(row.pupilId) ?? null;
    }
  }
  const generalRanks = rank((row) => row.average);
  for (const row of rows) row.rank = generalRanks.get(row.pupilId) ?? null;

  // The class average of each subject and of each group — the "Moy. Gén." column.
  const classAverageOf = (pick) => round2(mean(rows.map(pick).filter((v) => Number.isFinite(v))));
  const columns = subjects.map((s) => ({
    code: s.code,
    classAverage: classAverageOf((row) => row.subjects.find((x) => x.code === s.code)?.trim ?? null),
  }));
  const groupColumns = COLLEGE_GROUPS.map((g) => ({
    groupNo: g.no,
    classAverage: classAverageOf((row) => row.groups.find((x) => x.groupNo === g.no)?.trim ?? null),
  }));

  const averages = rows.map((r) => r.average).filter((v) => Number.isFinite(v));
  return {
    cycle,
    class: { id: cls.id, name: cls.name, code: cls.code, cycle },
    term: { number: term.number, name: term.name, start: term.start, end: term.end },
    sequences,
    sequenceGrid: sequenceGrid(ctx).filter((s) => s.term === termNo),
    subjects: subjects.map((s) => ({
      code: s.code,
      label: s.label,
      labelEn: s.labelEn,
      groupNo: s.groupNo,
      coefficient: s.coefficient,
      teacher: s.teacher,
      classAverage: columns.find((c) => c.code === s.code)?.classAverage ?? null,
    })),
    // The groups come from the subjects, not from the pupils: an unmarked class still has
    // its three blocks on the bulletin.
    groups: COLLEGE_GROUPS.map((g) => ({
      groupNo: g.no,
      label: g.fr,
      labelEn: g.en,
      coefficient: subjects.filter((s) => s.groupNo === g.no).reduce((a, s) => a + s.coefficient, 0),
      classAverage: groupColumns.find((c) => c.groupNo === g.no)?.classAverage ?? null,
    })).filter((g) => g.coefficient > 0),
    pupils: rows,
    classProfile: {
      count: rows.length,
      average: round2(mean(averages)),
      best: averages.length ? Math.max(...averages) : null,
      worst: averages.length ? Math.min(...averages) : null,
      passMark: 10,
      passing: averages.filter((v) => v >= 10).length,
    },
    school: {
      name: ctx.settings.schoolName,
      subtitle: ctx.settings.schoolSubtitle,
      academicYear: ctx.settings.academicYear,
      cycle,
    },
  };
}

function loadConduct(db, classId, termNo) {
  const rows = db
    .prepare(
      `SELECT c.pupil_id, c.value FROM conduct_marks c
         JOIN pupils p ON p.id = c.pupil_id
        WHERE p.class_id = ? AND c.period = ?`,
    )
    .all(classId, `T:${termNo}`);
  return new Map(rows.map((r) => [r.pupil_id, r.value]));
}

function loadRemarks(db, classId, termNo) {
  const rows = db
    .prepare(
      `SELECT r.pupil_id, r.text FROM remarks r
         JOIN pupils p ON p.id = r.pupil_id
        WHERE p.class_id = ? AND r.period = ?`,
    )
    .all(classId, `T:${termNo}`);
  return new Map(rows.map((r) => [r.pupil_id, r.text]));
}

/** Absences of the term: justified (excused), unjustified, and late arrivals. */
function loadTermAttendance(db, classId, term) {
  const rows = db
    .prepare(
      `SELECT a.pupil_id, a.mark, COUNT(*) AS n FROM attendance a
         JOIN pupils p ON p.id = a.pupil_id
        WHERE p.class_id = ? AND a.date BETWEEN ? AND ?
        GROUP BY a.pupil_id, a.mark`,
    )
    .all(classId, term.start, term.end);
  const out = new Map();
  for (const r of rows) {
    const entry = out.get(r.pupil_id) ?? { justified: 0, unjustified: 0, late: 0, present: 0 };
    if (r.mark === 'A') entry.unjustified += r.n;
    else if (r.mark === 'E') entry.justified += r.n;
    else if (r.mark === 'L') entry.late += r.n;
    else entry.present += r.n;
    out.set(r.pupil_id, entry);
  }
  return out;
}

export function saveConduct(db, pupilId, period, value) {
  if (value === null || value === undefined || value === '') {
    db.prepare('DELETE FROM conduct_marks WHERE pupil_id = ? AND period = ?').run(pupilId, period);
    return null;
  }
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0 || v > 20) throw badRequest('Conduite is marked out of 20');
  db.prepare(
    `INSERT INTO conduct_marks (pupil_id, period, value) VALUES (?, ?, ?)
     ON CONFLICT (pupil_id, period) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(pupilId, period, v);
  return v;
}

// ---- The marks sheet of one séquence ---------------------------------------------

/**
 * What the marks sheet of a séquence shows: one row per pupil, one column per subject,
 * two boxes per subject (the interrogation and the devoir), and the mark of the séquence
 * that comes out of them.
 */
export function sequenceSheet(db, ctx, classId, sequenceNo) {
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  const grid = sequenceGrid(ctx);
  const sequence = grid.find((s) => s.number === Number(sequenceNo));
  if (!sequence) throw notFound('Séquence not found');

  const subjects = collegeSubjects(db, classId);
  const marks = loadSequenceMarks(db, classId, sequence.term);
  const pupils = visiblePupils(
    db.prepare('SELECT id, student_id, class_no, full_name, gender, status FROM pupils WHERE class_id = ? ORDER BY class_no, full_name').all(classId),
    new Set(Object.keys(marks).map(Number)),
  );

  return {
    class: { id: cls.id, name: cls.name, code: cls.code, cycle: cycleOf(cls) },
    sequence,
    sequences: grid,
    subjects,
    kinds: ['interro', 'devoir'],
    pupils: pupils.map((p) => {
      const bySubject = marks[p.id] ?? {};
      const row = subjects.map((s) => {
        const kinds = bySubject[s.code]?.[sequence.number] ?? {};
        return { code: s.code, interro: kinds.interro ?? null, devoir: kinds.devoir ?? null, mark: sequenceMark(bySubject[s.code], sequence.number) };
      });
      return { pupilId: p.id, studentId: p.student_id, classNo: p.class_no, name: p.full_name, status: p.status, marks: row };
    }),
    /** How many of the boxes are filled in, so the sheet can say where it stands. */
    entered: pupils.reduce(
      (a, p) => a + subjects.filter((s) => Object.keys(marks[p.id]?.[s.code]?.[sequence.number] ?? {}).length).length,
      0,
    ),
    expected: pupils.length * subjects.length,
  };
}

/** Move a class into the other cycle (Settings → Classes). */
export function setClassCycle(db, classId, cycle) {
  if (!['primary', 'college'].includes(cycle)) throw badRequest('A class is either primary or college');
  const cls = getClass(db, classId);
  if (!cls) throw notFound('Class not found');
  db.prepare('UPDATE classes SET cycle = ? WHERE id = ?').run(cycle, classId);
  if (cycle === 'college') ensureClassSubjects(db, classId);
  return { id: classId, cycle };
}
