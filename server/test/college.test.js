// The college: which classes belong to it, the six-week séquences, and the bulletin —
// checked against the figures printed on the school's own bulletin de notes (6ème,
// trimestre 2: séquences 3 and 4, 312,01 points over 26 coefficients, 12,00/20).
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { closeDatabase, openDatabase } from '../src/db/index.js';
import { cycleForLevel } from '../src/lib/cycles.js';
import { applyYearToCalendar, ensureCurrentYear } from '../src/services/schoolYears.js';
import { loadContext, readClasses } from '../src/services/context.js';
import {
  collegeBulletin,
  collegeSubjects,
  saveCollegeSubjects,
  saveConduct,
  saveSequenceMark,
  sequenceGrid,
  sequenceSheet,
  sequenceMark,
  setClassCycle,
  termMark,
  weightedAverage,
} from '../src/services/college.js';

afterEach(() => {
  try {
    closeDatabase();
  } catch {
    /* already closed */
  }
});

function freshDb() {
  const db = openDatabase(':memory:');
  ensureCurrentYear(db);
  applyYearToCalendar(db, 1);
  return db;
}

const SIXIEME = 7; // 6ème, the class of the bulletin

/** One pupil, with the marks of the bulletin: [subject, séquence 3, séquence 4]. */
const BULLETIN = [
  ['anglais', 7.3, 7.1],
  ['expression-ecrite', 9.55, 10.75],
  ['expression-orale', 10.0, 13.0],
  ['mathematiques', 13.25, 13.2],
  ['science', 8.75, 9.63],
  ['informatique', 18.0, 9.63],
  ['etude-de-texte', 10.7, 9.6],
  ['correction-ortho', 8.45, 8.25],
  ['ecm', 14.5, 15.1],
  ['histoire-geo', 14.5, 12.32],
  ['lcn', 12.0, 12.0],
  ['espagnol', 13.34, 13.34],
  ['religion', 12.0, 15.0],
  ['sport', 16.45, 18.0],
];

/** What the bulletin prints in its Trim. 2 column, subject by subject. */
const PRINTED_TRIM = {
  anglais: 7.2,
  'expression-ecrite': 10.15,
  'expression-orale': 11.5,
  mathematiques: 13.23,
  science: 9.19,
  informatique: 13.81,
  'etude-de-texte': 10.15,
  ecm: 14.8,
  'histoire-geo': 13.41,
  lcn: 12.0,
  espagnol: 13.34,
  religion: 13.5,
  sport: 17.23,
};

function pupilWithBulletinMarks(db) {
  const pupil = db
    .prepare("INSERT INTO pupils (student_id, class_id, class_no, full_name, gender, status) VALUES ('6EME-01', ?, 1, 'AMHYR EDEN BEKAME', 'M', 'Active')")
    .run(SIXIEME).lastInsertRowid;
  for (const [subject, s3, s4] of BULLETIN) {
    saveSequenceMark(db, { pupilId: pupil, term: 2, sequence: 3, subject, kind: 'devoir', value: s3 });
    saveSequenceMark(db, { pupilId: pupil, term: 2, sequence: 4, subject, kind: 'devoir', value: s4 });
  }
  return pupil;
}

// ---- The two cycles -------------------------------------------------------------

test('a class is placed in a cycle by its level, and can be moved over', () => {
  const db = freshDb();
  const byCode = Object.fromEntries(readClasses(db).map((c) => [c.code, c.cycle]));
  for (const code of ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']) assert.equal(byCode[code], 'primary', code);
  for (const code of ['6EME', '5EME', '4EME', '3EME', '2ND']) assert.equal(byCode[code], 'college', code);

  // a college class starts with the subjects of the bulletin; a primary one has none
  assert.equal(collegeSubjects(db, SIXIEME).length, 14);
  assert.equal(collegeSubjects(db, 1).length, 0); // SIL

  // the coefficient printed at the foot of the bulletin: 26
  assert.equal(collegeSubjects(db, SIXIEME).reduce((a, s) => a + s.coefficient, 0), 26);

  // moving a class over gives it the college subjects, and does not take them back
  const primary = db.prepare("SELECT id FROM classes WHERE code = 'CM2'").get().id;
  assert.equal(setClassCycle(db, primary, 'college').cycle, 'college');
  assert.equal(collegeSubjects(db, primary).length, 14);
  assert.equal(setClassCycle(db, primary, 'primary').cycle, 'primary');
  assert.equal(collegeSubjects(db, primary).length, 14, 'its subjects are kept, in case it comes back');
  assert.throws(() => setClassCycle(db, primary, 'sixth-form'), /primary or college/);
});

test('the level decides, even written the French way', () => {
  assert.equal(cycleForLevel('6ème'), 'college');
  assert.equal(cycleForLevel('6 EME'), 'college');
  assert.equal(cycleForLevel('Terminale D'), 'college');
  assert.equal(cycleForLevel('CP'), 'primary');
  assert.equal(cycleForLevel(''), 'primary');
});

// ---- The six-week séquences ------------------------------------------------------

test('each term is cut into two séquences of about six weeks', () => {
  const db = freshDb();
  const grid = sequenceGrid(loadContext(db));
  assert.equal(grid.length, 6);
  assert.deepEqual(grid.map((s) => s.number), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(grid.map((s) => s.term), [1, 1, 2, 2, 3, 3]);

  // the bulletin of trimestre 2 reports séquences 3 and 4
  const term2 = grid.filter((s) => s.term === 2);
  assert.deepEqual(term2.map((s) => s.number), [3, 4]);
  assert.equal(term2[0].start, '2026-11-30'); // the term opens on the Monday after term 1
  assert.ok(term2[1].end <= '2027-03-05');

  // the teaching weeks are shared out, none lost, none counted twice
  const weeks = grid.flatMap((s) => s.weeks);
  assert.equal(new Set(weeks).size, weeks.length);
  for (const s of grid) assert.ok(s.schoolDays > 0);
});

// ---- The arithmetic of the bulletin ------------------------------------------------

test('the mark of a term is the average of its two séquences, weighted by coefficient', () => {
  const db = freshDb();
  const pupilId = pupilWithBulletinMarks(db);
  const bulletin = collegeBulletin(db, loadContext(db), SIXIEME, 2);
  const pupil = bulletin.pupils.find((p) => p.pupilId === pupilId);

  assert.deepEqual(bulletin.sequences, [3, 4]);
  // the bulletin is printed from the labels, so they have to come through
  assert.equal(bulletin.subjects[0].label, 'Anglais');
  assert.ok(bulletin.subjects.every((s) => s.label), 'every subject is named');
  assert.ok(pupil.subjects.every((s) => s.label), 'every line of the bulletin is named');
  assert.deepEqual(pupil.subjects.map((s) => s.label), bulletin.subjects.map((s) => s.label));

  // every subject of the bulletin comes back with the term mark it prints
  for (const [code, expected] of Object.entries(PRINTED_TRIM)) {
    const row = pupil.subjects.find((s) => s.code === code);
    assert.ok(row, code);
    assert.ok(Math.abs(row.trim - expected) <= 0.01, `${code}: ${row.trim} vs ${expected}`);
  }

  // the one line the bulletin fills in by hand (Correct. Ortho. shows 11,50 while its two
  // séquences average 8,35): the app follows the marks, not the printed figure
  assert.equal(pupil.subjects.find((s) => s.code === 'correction-ortho').trim, 8.35);

  // the three groups, with the coefficients printed under each block
  assert.deepEqual(pupil.groups.map((g) => [g.groupNo, g.coefficient]), [[1, 15], [2, 7], [3, 4]]);
  const group1 = pupil.groups.find((g) => g.groupNo === 1);
  assert.equal(group1.seq[3], 11.17);
  assert.equal(group1.seq[4], 10.67);
  assert.equal(group1.trim, 10.92);

  // 312,01 points over 26 coefficients — a 12,00/20
  assert.equal(pupil.coefficient, 26);
  assert.ok(Math.abs(pupil.points - 312.01) <= 0.1, `points ${pupil.points}`);
  assert.ok(Math.abs(pupil.average - 12.0) <= 0.01, `average ${pupil.average}`);
  assert.equal(pupil.mention.fr, 'Assez Bien');

  // the "Rappel" block: the pupil's average in each séquence
  assert.equal(pupil.sequenceAverages[3], 12.11);
  assert.equal(pupil.sequenceAverages[4], 11.89);
});

test('a pupil is ranked against the class, subject by subject and overall', () => {
  const db = freshDb();
  const strong = db.prepare("INSERT INTO pupils (student_id, class_id, class_no, full_name, status) VALUES ('6EME-02', ?, 2, 'B', 'Active')").run(SIXIEME)
    .lastInsertRowid;
  const weak = db.prepare("INSERT INTO pupils (student_id, class_id, class_no, full_name, status) VALUES ('6EME-03', ?, 3, 'C', 'Active')").run(SIXIEME)
    .lastInsertRowid;
  const set = (pupilId, subject, value) => {
    saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject, kind: 'devoir', value });
    saveSequenceMark(db, { pupilId, term: 2, sequence: 4, subject, kind: 'devoir', value });
  };
  for (const [code] of BULLETIN) {
    set(strong, code, 16);
    set(weak, code, 8);
  }
  set(strong, 'anglais', 10); // B is weaker than C in English
  set(weak, 'anglais', 12);

  const bulletin = collegeBulletin(db, loadContext(db), SIXIEME, 2);
  assert.equal(bulletin.pupils.length, 2);
  const row = (id) => bulletin.pupils.find((p) => p.pupilId === id);

  assert.equal(row(weak).subjects.find((s) => s.code === 'anglais').rank, 1);
  assert.equal(row(strong).subjects.find((s) => s.code === 'anglais').rank, 2);
  assert.equal(row(strong).rank, 1, 'the best general average');
  assert.equal(row(weak).rank, 2);

  // the profile of the class printed beside the pupil's own results
  assert.equal(bulletin.classProfile.count, 2);
  assert.equal(bulletin.classProfile.best, row(strong).average);
  assert.equal(bulletin.classProfile.worst, row(weak).average);
  assert.equal(bulletin.classProfile.passing, 1, 'only the 16/20 pupil passes');
  // the "Moy. Gén." column: the average of the class in each subject
  for (const s of bulletin.subjects) {
    const expected = s.code === 'anglais' ? 11 : 12;
    assert.ok(Math.abs(s.classAverage - expected) <= 0.01, `${s.code}: ${s.classAverage}`);
  }
});

test('the mention follows the mark, as the bulletin words it', () => {
  const db = freshDb();
  const bulletin = collegeBulletin(db, loadContext(db), SIXIEME, 2);
  assert.equal(bulletin.pupils.length, 0, 'a class with no marks yet is empty, not broken');
  assert.equal(bulletin.groups.length, 3);
  assert.equal(bulletin.classProfile.average, null);
});

// ---- Entering the marks ------------------------------------------------------------

test('a séquence sheet holds two kinds of test, and the average of them is the mark', () => {
  const db = freshDb();
  const pupilId = db.prepare("INSERT INTO pupils (student_id, class_id, class_no, full_name, status) VALUES ('6EME-01', ?, 1, 'A', 'Active')").run(SIXIEME)
    .lastInsertRowid;
  saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject: 'anglais', kind: 'interro', value: 12 });
  saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject: 'anglais', kind: 'devoir', value: 14 });

  const sheet = sequenceSheet(db, loadContext(db), SIXIEME, 3);
  const anglais = sheet.pupils[0].marks.find((m) => m.code === 'anglais');
  assert.equal(anglais.interro, 12);
  assert.equal(anglais.devoir, 14);
  assert.equal(anglais.mark, 13);

  // a mark out of range or of an unknown kind is refused
  assert.throws(() => saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject: 'anglais', kind: 'devoir', value: 25 }), /between 0 and 20/);
  assert.throws(() => saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject: 'anglais', kind: 'composition', value: 12 }), /interrogation or a devoir/);

  // clearing a box takes the mark away
  saveSequenceMark(db, { pupilId, term: 2, sequence: 3, subject: 'anglais', kind: 'devoir', value: null });
  assert.equal(sequenceSheet(db, loadContext(db), SIXIEME, 3).pupils[0].marks.find((m) => m.code === 'anglais').mark, 12);

  assert.throws(() => sequenceSheet(db, loadContext(db), SIXIEME, 9), /Séquence not found/);
});

test('the subjects of a class are the school’s to set', () => {
  const db = freshDb();
  const saved = saveCollegeSubjects(db, SIXIEME, [
    { code: 'anglais', labelFr: 'Anglais', groupNo: 1, coefficient: 4, teacher: 'M. Roland' },
    { code: 'maths', labelFr: 'Mathématiques', groupNo: 1, coefficient: 5 },
    { code: 'sport', labelFr: 'Sport', groupNo: 3, coefficient: 1 },
  ]);
  assert.deepEqual(saved.map((s) => [s.code, s.coefficient, s.groupNo]), [['anglais', 4, 1], ['maths', 5, 1], ['sport', 1, 3]]);
  assert.equal(collegeSubjects(db, SIXIEME)[0].teacher, 'M. Roland');

  assert.throws(() => saveCollegeSubjects(db, SIXIEME, [{ labelFr: 'Anglais', coefficient: 0 }]), /coefficient/);
  assert.throws(() => saveCollegeSubjects(db, SIXIEME, [{ labelFr: 'Anglais', groupNo: 4, coefficient: 1 }]), /group 1, 2 or 3/);
  assert.throws(() => saveCollegeSubjects(db, SIXIEME, [{ labelFr: ' ' }]), /needs a name/);
  assert.throws(() => saveCollegeSubjects(db, SIXIEME, []), /at least one subject/);
});

test('conduite is marked out of twenty and kept with the pupil', () => {
  const db = freshDb();
  const pupilId = db.prepare("INSERT INTO pupils (student_id, class_id, class_no, full_name, status) VALUES ('6EME-01', ?, 1, 'A', 'Active')").run(SIXIEME)
    .lastInsertRowid;
  assert.equal(saveConduct(db, pupilId, 'T:2', 19.5), 19.5);
  const bulletin = collegeBulletin(db, loadContext(db), SIXIEME, 2);
  assert.equal(bulletin.pupils.find((p) => p.pupilId === pupilId).conduct, 19.5);
  assert.throws(() => saveConduct(db, pupilId, 'T:2', 25), /out of 20/);
  saveConduct(db, pupilId, 'T:2', null);
  assert.equal(collegeBulletin(db, loadContext(db), SIXIEME, 2).pupils[0].conduct, null);
});

// ---- The helpers ---------------------------------------------------------------------

test('a weighted average ignores what has not been marked yet', () => {
  assert.equal(weightedAverage([{ value: 10, coefficient: 2 }, { value: 16, coefficient: 2 }]), 13);
  assert.equal(weightedAverage([{ value: 10, coefficient: 2 }, { value: null, coefficient: 4 }]), 10);
  assert.equal(weightedAverage([{ value: null, coefficient: 4 }]), null);
  assert.equal(sequenceMark({ 3: { interro: 11 } }, 3), 11);
  assert.equal(termMark({ 3: { interro: 11 }, 4: { interro: 15 } }, [3, 4]), 13);
  assert.equal(termMark({ 3: { interro: 11 } }, [3, 4]), 11, 'one séquence is enough to report a term');
});
