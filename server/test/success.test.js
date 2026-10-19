// Monthly success rates (charts 6–9 of the Statistics sheet): the share of pupils who reached the
// pass mark, per competence and per subject, with or without the weekly controls.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getDb, openDatabase } from '../src/db/index.js';
import { passCote, passMark } from '../src/lib/grading.js';
import { loadContext } from '../src/services/context.js';
import { CONTROL_WEIGHT, monthlySuccess } from '../src/services/insights.js';

let db;
let ctx;
let classId;
const ids = {};

before(() => {
  db = openDatabase(':memory:');
  classId = db.prepare("SELECT id FROM classes WHERE code = 'CE2'").get().id;
  const add = db.prepare('INSERT INTO pupils (student_id, class_id, class_no, full_name) VALUES (?, ?, ?, ?)');
  for (const [name, pupil] of Object.entries({
    top: 'PUPIL TOP',
    edge: 'PUPIL EDGE',
    below: 'PUPIL BELOW',
    partial: 'PUPIL PARTIAL',
  })) {
    ids[name] = Number(add.run(`CE2-${name}`, classId, Object.keys(ids).length + 1, pupil).lastInsertRowid);
  }

  const mark = db.prepare('INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?)');
  const marks = (pupil, values) => {
    for (const [code, value] of Object.entries(values)) mark.run(pupil, '2026-10', code, value);
  };
  // Competence 1 = 1A + 1B (/80), competence 2 = 2A + 2B (/60), competence 4 = 4A (/20),
  // competence 5 = 5A (/20). Values are chosen so each pupil sits exactly on a threshold.
  marks(ids.top, { '1A': 40, '1B': 40, '2A': 30, '2B': 30, '4A': 20, '5A': 20 }); // 100% everywhere
  marks(ids.edge, { '1A': 20, '1B': 20, '2A': 15, '2B': 15, '4A': 10, '5A': 10 }); // exactly 50%
  marks(ids.below, { '1A': 19, '1B': 20, '2A': 14, '2B': 15, '4A': 9, '5A': 10 }); // just below
  marks(ids.partial, { '1A': 40 }); // competence 1 incomplete (1B missing) → not judged

  const ctrl = db.prepare('INSERT INTO control_marks (pupil_id, week, subject, value) VALUES (?, ?, ?, ?)');
  // October spans weeks 4–8. Controls here are worth 0% and 100% of /20.
  for (const subject of ['english', 'french', 'maths', 'scitech']) {
    ctrl.run(ids.top, 5, subject, 0);
    ctrl.run(ids.below, 5, subject, 20);
  }
  ctx = loadContext(getDb(), { today: '2026-10-14' });
});

const row = (rows, key) => rows.find((r) => r.key === key);

test('the pass mark follows the school’s own marking scale', () => {
  assert.equal(passMark(ctx.settings.cotes), 0.5);
  assert.equal(passCote(ctx.settings.cotes), 'ECA/B');
  // Editing the scale moves the pass mark with it.
  assert.equal(passMark([{ code: 'A', min: 0.8 }, { code: 'NA', min: 0 }]), 0.8);
  assert.equal(passMark([]), 0.5);
});

test('rates count the pupils who reached the pass mark, out of those judged', () => {
  const s = monthlySuccess(db, ctx, classId, '2026-10');
  assert.equal(s.passMark, 0.5);
  assert.equal(s.controlWeight, CONTROL_WEIGHT);

  const c1 = row(s.class.competences, 'C1');
  assert.equal(c1.max, 80);
  assert.equal(c1.evaluated, 3, 'the pupil with only 1A entered is not judged on a competence');
  assert.equal(c1.skipped, 1);
  assert.equal(c1.passed, 2, 'exactly 50% passes, just below does not');
  assert.equal(c1.rate, 2 / 3);

  const c2 = row(s.class.competences, 'C2');
  assert.equal(c2.max, 60);
  assert.equal(c2.passed, 2);

  // A subject is judged on its own single mark, so the partial pupil counts here.
  const s1a = row(s.class.subjects, '1A');
  assert.equal(s1a.evaluated, 4);
  assert.equal(s1a.passed, 3);
  assert.equal(s1a.rate, 0.75);

  // Competences with no subject on the monthly card never get a rate.
  assert.deepEqual(s.notEvaluated, [3, 6]);
  assert.equal(row(s.class.competences, 'C3').rate, null);
  assert.equal(row(s.class.competences, 'C3').max, 0);
});

test('weekly controls are folded in at 30%, on top of 70% for the monthly card', () => {
  const s = monthlySuccess(db, ctx, classId, '2026-10');
  const c1 = row(s.class.competencesWithControls, 'C1');
  // The pupil below the pass mark scored 100% on every control:
  // 0.7 × 39/80 (0.4875) + 0.3 × 1 = 0.64125 → now passes.
  const below = 0.7 * (39 / 80) + 0.3 * 1;
  assert.ok(below > 0.5);
  assert.equal(c1.passed, 3, 'the controls lift the borderline pupil over the pass mark');
  assert.equal(c1.controlsIncluded, 2, 'only the two pupils with controls had them folded in');
  assert.equal(c1.evaluated, 3);

  // The top pupil scored 0 on every control: 0.7 × 1 + 0.3 × 0 = 0.7 → still passes.
  const top = 0.7 * 1 + 0.3 * 0;
  assert.ok(top >= 0.5);

  // A competence with no control subject keeps the monthly card as it is.
  const c4 = row(s.class.competencesWithControls, 'C4');
  assert.equal(c4.controlsIncluded, 0);
  assert.equal(c4.rate, row(s.class.competences, 'C4').rate);
});

test('the whole school covers every class, while the class scope stays on one', () => {
  const s = monthlySuccess(db, ctx, classId, '2026-10');
  const other = db.prepare("SELECT id FROM classes WHERE code = 'CM1'").get().id;
  const other1a = row(monthlySuccess(db, ctx, other, '2026-10').class.subjects, '1A');
  assert.equal(other1a.evaluated, 0, 'no marks were entered in CM1');

  const school1a = row(s.school.subjects, '1A');
  const class1a = row(s.class.subjects, '1A');
  assert.equal(school1a.evaluated, class1a.evaluated, 'the school adds nothing while only CE2 has marks');

  // Add one passing pupil elsewhere and the school, not the class, picks it up.
  const pupil = db
    .prepare('INSERT INTO pupils (student_id, class_id, class_no, full_name) VALUES (?, ?, ?, ?)')
    .run('CM1-01', other, 1, 'PUPIL ELSEWHERE').lastInsertRowid;
  db.prepare('INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?)').run(
    Number(pupil),
    '2026-10',
    '1A',
    40,
  );
  const ctx2 = loadContext(getDb(), { today: '2026-10-14' });
  const after = monthlySuccess(db, ctx2, classId, '2026-10');
  assert.equal(row(after.school.subjects, '1A').evaluated, 5);
  assert.equal(row(after.class.subjects, '1A').evaluated, 4, 'the class scope is untouched');
  assert.equal(row(after.school.subjects, '1A').passed, 4);
});

test('an unknown month is reported, and a month with nothing in it has no rates', () => {
  assert.throws(() => monthlySuccess(db, ctx, classId, '2026-13'), /Month not found/);
  const empty = monthlySuccess(db, ctx, classId, '2027-06');
  assert.equal(row(empty.class.subjects, '1A').rate, null);
  assert.equal(row(empty.class.subjects, '1A').evaluated, 0);
});
