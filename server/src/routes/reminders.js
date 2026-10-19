// Reminders: who receives them, when, and what the last pass would have sent.
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { HttpError, badRequest, notFound } from '../lib/http.js';
import { requireInt, requireString } from '../lib/validate.js';
import { loadContext } from '../services/context.js';
import { refuseDemoAccount } from '../services/demo-login.js';
import { mailStatus, deliver } from '../services/mailer.js';
import {
  addSubscriber,
  buildIcsForGroup,
  renderMessage,
  clearOutbox,
  listAccounts,
  listSubscribers,
  previewReminders,
  readOutbox,
  readReminderLog,
  recipients,
  reminderSettings,
  removeSubscriber,
  runReminderPass,
  saveReminderSettings,
  setUserEmail,
  updateSubscriber,
} from '../services/reminders.js';

export const remindersRouter = Router();

function requireSessionUser(req) {
  if (!req.user?.id) throw new HttpError(401, 'Sign in again');
  return req.user;
}

/** Everything the Reminders page shows, in one call. */
remindersRouter.get('/', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const days = Math.min(120, Math.max(1, Number(req.query.days) || 30));
  res.json({
    settings: reminderSettings(db),
    mail: mailStatus(),
    subscribers: listSubscribers(db),
    accounts: listAccounts(db),
    recipients: recipients(db),
    preview: previewReminders(db, { today: ctx.today.date, horizon: days }),
    outbox: readOutbox(db, 50),
    log: readReminderLog(db, 50),
    today: ctx.today.date,
  });
});

remindersRouter.put('/settings', (req, res) => {
  const b = req.body ?? {};
  const patch = {};
  if (b.enabled !== undefined) patch.enabled = Boolean(b.enabled);
  if (b.autoPrepare !== undefined) patch.autoPrepare = Boolean(b.autoPrepare);
  if (b.leadDays !== undefined) {
    if (!Array.isArray(b.leadDays)) throw badRequest('Lead times must be a list of days');
    patch.leadDays = b.leadDays.map((v) => Number(v));
  }
  if (b.categories !== undefined) {
    if (!Array.isArray(b.categories)) throw badRequest('Kinds of dates must be a list');
    patch.categories = b.categories.map(String);
  }
  if (b.hour !== undefined) patch.hour = Number(b.hour);
  if (b.prepareDays !== undefined) patch.prepareDays = Number(b.prepareDays);
  try {
    res.json(saveReminderSettings(getDb(), patch));
  } catch (e) {
    throw badRequest(e.message);
  }
});

remindersRouter.get('/preview', (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const days = Math.min(120, Math.max(1, Number(req.query.days) || 30));
  res.json(previewReminders(db, { today: ctx.today.date, horizon: days }));
});

// ---- Mailing list -------------------------------------------------------------

remindersRouter.post('/subscribers', refuseDemoAccount, (req, res) => {
  const email = requireString(req.body?.email ?? '', 'e-mail address', { max: 160 });
  const name = String(req.body?.name ?? '').trim().slice(0, 120);
  try {
    const id = addSubscriber(getDb(), { email, name });
    res.status(201).json({ id });
  } catch (e) {
    throw badRequest(e.message);
  }
});

remindersRouter.put('/subscribers/:id', refuseDemoAccount, (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'subscriber');
  const b = req.body ?? {};
  try {
    res.json(
      updateSubscriber(db, id, {
        email: b.email === undefined ? undefined : String(b.email),
        name: b.name === undefined ? undefined : String(b.name),
        active: b.active === undefined ? undefined : Boolean(b.active),
      }),
    );
  } catch (e) {
    throw badRequest(e.message);
  }
});

remindersRouter.delete('/subscribers/:id', refuseDemoAccount, (req, res) => {
  try {
    removeSubscriber(getDb(), requireInt(req.params.id, 'subscriber'));
  } catch (e) {
    throw notFound(e.message);
  }
  res.json({ ok: true });
});

/** The e-mail address of an account (accounts with one receive reminders too). */
remindersRouter.put('/accounts/:id/email', refuseDemoAccount, (req, res) => {
  const db = getDb();
  try {
    res.json(setUserEmail(db, requireInt(req.params.id, 'account'), String(req.body?.email ?? '')));
  } catch (e) {
    throw badRequest(e.message);
  }
});

// ---- Sending ------------------------------------------------------------------

/**
 * Run a pass now. `dryRun` (the default while no mail server is configured) prepares the
 * messages and stores them in the outbox without delivering anything.
 */
remindersRouter.post('/send', refuseDemoAccount, async (req, res) => {
  const db = getDb();
  const ctx = loadContext(db);
  const dryRun = req.body?.dryRun !== false;
  const result = await runReminderPass(db, { today: ctx.today.date, dryRun, force: true });
  const status = result.status === 'ok' ? 200 : 202;
  res.status(status).json(result);
});

/** One message to the signed-in account, to check the wording before anybody else gets it. */
remindersRouter.post('/test', refuseDemoAccount, async (req, res) => {
  const db = getDb();
  const user = requireSessionUser(req);
  const to = String(req.body?.email ?? '').trim().toLowerCase() || db.prepare('SELECT email FROM users WHERE id = ?').get(user.id)?.email;
  if (!to || !to.includes('@')) throw badRequest('Add your e-mail address first (Accounts below)');
  const ctx = loadContext(db);
  const group = {
    date: ctx.today.date,
    lead: 0,
    items: [
      {
        key: 'test',
        date: ctx.today.date,
        endDate: null,
        title: 'Test reminder / Rappel de test',
        category: 'event',
      },
    ],
  };
  const { subject, text } = renderMessage({
    group,
    schoolName: ctx.settings.schoolName || 'School Manager',
    recipient: { name: user.username ?? '', email: to },
    academicYear: ctx.settings.academicYear,
  });
  const ics = buildIcsForGroup({
    group,
    schoolName: ctx.settings.schoolName || 'School Manager',
    attendee: to,
    organizer: (process.env.MAIL_FROM || process.env.MAIL_USER || '').replace(/^.*</, '').replace(/>.*$/, '').trim(),
  });
  const result = await deliver({ to, subject, text, ics });
  db.prepare('INSERT INTO outbox (recipient, subject, body, ics, status, detail) VALUES (?, ?, ?, ?, ?, ?)').run(
    to,
    subject,
    text,
    ics,
    result.status,
    result.detail,
  );
  res.json({ ...result, to, subject, text });
});

// ---- Outbox -------------------------------------------------------------------

remindersRouter.get('/outbox', (req, res) => {
  res.json({ messages: readOutbox(getDb(), Math.min(300, Number(req.query.limit) || 100)) });
});

remindersRouter.delete('/outbox', refuseDemoAccount, (req, res) => {
  clearOutbox(getDb());
  res.json({ ok: true });
});
