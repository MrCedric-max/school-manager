import { Router } from 'express';
import { getDb } from '../db/index.js';
import { optionalInt, requireInt, requireMonth } from '../lib/validate.js';
import { loadContext } from '../services/context.js';
import { dashboard, statistics } from '../services/insights.js';
import { monthlyCards, monthlyReport, termCards, termReport, weeklyReport } from '../services/reports.js';

export const reportsRouter = Router();

reportsRouter.get('/reports/weekly', (req, res) => {
  const db = getDb();
  res.json(weeklyReport(db, loadContext(db), requireInt(req.query.classId, 'class'), requireInt(req.query.week, 'week')));
});

reportsRouter.get('/reports/monthly', (req, res) => {
  const db = getDb();
  res.json(monthlyReport(db, loadContext(db), requireInt(req.query.classId, 'class'), requireMonth(req.query.month)));
});

reportsRouter.get('/reports/term', (req, res) => {
  const db = getDb();
  res.json(termReport(db, loadContext(db), requireInt(req.query.classId, 'class'), requireInt(req.query.term, 'term')));
});

reportsRouter.get('/cards/monthly', (req, res) => {
  const db = getDb();
  res.json(
    monthlyCards(
      db,
      loadContext(db),
      requireInt(req.query.classId, 'class'),
      requireMonth(req.query.month),
      optionalInt(req.query.pupilId, 'pupil'),
    ),
  );
});

reportsRouter.get('/cards/term', (req, res) => {
  const db = getDb();
  res.json(
    termCards(
      db,
      loadContext(db),
      requireInt(req.query.classId, 'class'),
      requireInt(req.query.term, 'term'),
      optionalInt(req.query.pupilId, 'pupil'),
    ),
  );
});

reportsRouter.get('/dashboard', (req, res) => {
  const db = getDb();
  res.json(dashboard(db, loadContext(db)));
});

reportsRouter.get('/statistics', (req, res) => {
  const db = getDb();
  res.json(
    statistics(
      db,
      loadContext(db),
      requireInt(req.query.classId, 'class'),
      requireInt(req.query.week, 'week'),
      requireMonth(req.query.month),
    ),
  );
});
