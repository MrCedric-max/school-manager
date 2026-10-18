// The college: its subjects, the six-week séquences, their marks, and the bulletin.
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireInt, requireString } from '../lib/validate.js';
import { loadContext } from '../services/context.js';
import {
  collegeBulletin,
  collegeSubjects,
  saveCollegeSubjects,
  saveConduct,
  saveSequenceMark,
  sequenceGrid,
  sequenceSheet,
  setClassCycle,
} from '../services/college.js';

export const collegeRouter = Router();

/** The subjects of a college class, with their group and coefficient. */
collegeRouter.get('/college/subjects', (req, res) => {
  res.json({ subjects: collegeSubjects(getDb(), requireInt(req.query.classId, 'class')) });
});

collegeRouter.put('/college/subjects', (req, res) => {
  const db = getDb();
  const classId = requireInt(req.body?.classId, 'class');
  res.json({ subjects: saveCollegeSubjects(db, classId, req.body?.subjects) });
});

/** The six séquences of the year, cut from the teaching weeks of each term. */
collegeRouter.get('/college/sequences', (req, res) => {
  res.json({ sequences: sequenceGrid(loadContext(getDb())) });
});

/** The marks sheet of one séquence: pupils × subjects, interrogation and devoir. */
collegeRouter.get('/college/marks', (req, res) => {
  const db = getDb();
  res.json(sequenceSheet(db, loadContext(db), requireInt(req.query.classId, 'class'), requireInt(req.query.sequence, 'séquence')));
});

collegeRouter.put('/college/marks', (req, res) => {
  const db = getDb();
  const b = req.body ?? {};
  const term = requireInt(b.term, 'term');
  const sequence = requireInt(b.sequence, 'séquence');
  if (![1, 2, 3, 4, 5, 6].includes(sequence)) throw new Error('A séquence is numbered 1 to 6');
  const value = saveSequenceMark(db, {
    pupilId: requireInt(b.pupilId, 'pupil'),
    term,
    sequence,
    subject: requireString(b.subject, 'subject', { max: 40 }),
    kind: requireString(b.kind, 'kind of test', { max: 20 }),
    value: b.value,
  });
  res.json({ value });
});

/** A whole batch of marks at once — the sheet saves what has been typed, not one by one. */
collegeRouter.put('/college/marks/bulk', (req, res) => {
  const db = getDb();
  const marks = Array.isArray(req.body?.marks) ? req.body.marks : [];
  if (marks.length > 2000) throw new Error('Too many marks in one go');
  db.transaction(() => {
    for (const m of marks) {
      saveSequenceMark(db, {
        pupilId: requireInt(m?.pupilId, 'pupil'),
        term: requireInt(m?.term, 'term'),
        sequence: requireInt(m?.sequence, 'séquence'),
        subject: requireString(m?.subject, 'subject', { max: 40 }),
        kind: requireString(m?.kind, 'kind of test', { max: 20 }),
        value: m?.value,
      });
    }
  })();
  res.json({ saved: marks.length });
});

/** Conduite /20 of one pupil for one period ("T:2"). */
collegeRouter.put('/college/conduct', (req, res) => {
  const db = getDb();
  const b = req.body ?? {};
  res.json({
    value: saveConduct(db, requireInt(b.pupilId, 'pupil'), requireString(b.period, 'period', { max: 10 }), b.value),
  });
});

/**
 * The bulletin de notes of one class for one term: every pupil's subjects, sequence and
 * term marks, ranks, points and general average, with the profile of the class.
 */
collegeRouter.get('/college/bulletin', (req, res) => {
  const db = getDb();
  res.json(
    collegeBulletin(db, loadContext(db), requireInt(req.query.classId, 'class'), requireInt(req.query.term, 'term')),
  );
});

/** Move a class into the primary or the college (its cycle decides how it is evaluated). */
collegeRouter.put('/classes/:id/cycle', (req, res) => {
  res.json(setClassCycle(getDb(), requireInt(req.params.id, 'class'), String(req.body?.cycle ?? '')));
});
