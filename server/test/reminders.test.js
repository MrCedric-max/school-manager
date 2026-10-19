import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { closeDatabase, openDatabase } from '../src/db/index.js';
import { buildIcs } from '../src/lib/ics.js';
import { addDays } from '../src/lib/dates.js';
import { mailStatus } from '../src/services/mailer.js';
import {
  addSubscriber,
  buildAgenda,
  dueGroups,
  listAccounts,
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
} from '../src/services/reminders.js';
import { activeYear, applyYearToCalendar, ensureCurrentYear } from '../src/services/schoolYears.js';
import { loadContext } from '../src/services/context.js';
import { dailyTick, prepareNextYear } from '../src/services/scheduler.js';

const savedEnv = { ...process.env };

function freshDb() {
  const db = openDatabase(':memory:');
  ensureCurrentYear(db);
  applyYearToCalendar(db, activeYear(db).id);
  return db;
}

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  try {
    closeDatabase();
  } catch {
    /* already closed */
  }
});

// ---- The invitation -----------------------------------------------------------

test('the invitation is a calendar file people can open', () => {
  const ics = buildIcs({
    items: [
      { date: '2026-09-07', title: 'Rentrée scolaire des élèves / Pupils return', category: 'official' },
      { date: '2026-12-18', endDate: '2027-01-04', title: 'Christmas holiday / Congés de Noël', category: 'break' },
    ],
    schoolName: 'École AZOBE',
    organizer: 'secretary@azobe.cm',
    attendee: 'teacher@azobe.cm',
    reminderMinutes: [1440, 60],
  });
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(ics.includes('METHOD:REQUEST'));
  assert.ok(ics.includes('ORGANIZER;CN=École AZOBE:mailto:secretary@azobe.cm'));
  assert.ok(ics.includes('ATTENDEE;CN=teacher@azobe.cm;RSVP=FALSE:mailto:teacher@azobe.cm'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260907'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260908')); // all-day events end the day after
  assert.ok(ics.includes('DTEND;VALUE=DATE:20270105')); // a range runs through its last day
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 4);
  assert.ok(ics.includes('TRIGGER:-P1D'));
  assert.ok(ics.includes('TRIGGER:-PT60M'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  // RFC 5545: no content line longer than 75 octets, continuations start with a space
  for (const line of lines) assert.ok(Buffer.from(line, 'utf8').length <= 75, `line too long: ${line}`);
  assert.ok(!/[^\\][,;]/.test(ics.split('\r\n').find((l) => l.startsWith('SUMMARY')) ?? ''), 'commas are escaped');
});

test('a folded line is folded without breaking an accented character', () => {
  const long = 'Réunion des parents d’élèves du primaire et du collège — '.repeat(4);
  const ics = buildIcs({ items: [{ date: '2026-10-26', title: long }], schoolName: 'École AZOBE' });
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(long.replace(/,/g, '\\,').replace(/;/g, '\\;')));
  assert.ok(!ics.includes('Ã'), 'no split inside a multi-byte character');
});

// ---- Who receives them --------------------------------------------------------

test('reminders go to the accounts that have an address and to the mailing list', () => {
  const db = freshDb();
  db.prepare("INSERT INTO users (username, password_hash, email) VALUES ('secretary', 'x', 'Secretary@azobe.cm')").run();
  db.prepare("INSERT INTO users (username, password_hash) VALUES ('teacher', 'x')").run();
  addSubscriber(db, { email: ' teacher2@azobe.cm ', name: 'M. Nkodo' });
  addSubscriber(db, { email: 'Secretary@azobe.cm', name: 'again' }); // already covered by the account
  addSubscriber(db, { email: ' bursar@azobe.cm ', name: 'Mme Ella' });

  const people = recipients(db);
  assert.deepEqual(people.map((p) => p.email).sort(), ['bursar@azobe.cm', 'secretary@azobe.cm', 'teacher2@azobe.cm']);
  assert.equal(people.find((p) => p.email === 'secretary@azobe.cm').source, 'user');

  updateSubscriber(db, db.prepare("SELECT id FROM reminder_subscribers WHERE email = 'bursar@azobe.cm'").get().id, { active: false });
  assert.equal(recipients(db).length, 2);
  removeSubscriber(db, db.prepare("SELECT id FROM reminder_subscribers WHERE email = 'teacher2@azobe.cm'").get().id);
  assert.deepEqual(recipients(db).map((p) => p.email), ['secretary@azobe.cm']);

  assert.equal(setUserEmail(db, db.prepare("SELECT id FROM users WHERE username = 'teacher'").get().id, 'teacher@azobe.cm').email, 'teacher@azobe.cm');
  assert.equal(recipients(db).length, 2);
  assert.throws(() => addSubscriber(db, { email: 'not-an-address' }), /not an e-mail address/);
  assert.ok(listAccounts(db).some((a) => a.username === 'teacher' && a.email === 'teacher@azobe.cm'));
});

// ---- What is reminded about ---------------------------------------------------

test('the agenda holds the events, the public holidays and the first and last day of term', () => {
  const db = freshDb();
  const ctx = loadContext(db);
  db.prepare(
    "INSERT INTO events (date, title, category, source) VALUES ('2027-02-15', 'Kermesse', 'event', 'manual')",
  ).run();
  const agenda = buildAgenda(db);

  assert.ok(agenda.some((i) => i.key.startsWith('event:') && i.title === 'Kermesse'));
  assert.ok(agenda.some((i) => i.key.startsWith('holiday:') && i.date === '2027-05-20'));
  const term1End = agenda.find((i) => i.key === 'term:1:end');
  assert.equal(term1End.date, '2026-11-27');
  assert.match(term1End.title, /Term 1 ends/);
  // on the first day of school the official "rentrée" says it already, so the term's own
  // line is left out; the first item of the year is still dated to the first school day
  assert.ok(agenda.some((i) => i.date === '2026-09-07' && i.category === 'official' && !i.key.startsWith('term:')));

  // the school's planner and the national calendar both write the rentrée: only once
  db.prepare(
    "INSERT INTO events (date, title, category, source) VALUES ('2026-09-07', 'Rentrée scolaire des élèves · Début de l’Unité d’Apprentissage n°1', 'event', 'import')",
  ).run();
  const sameDay = buildAgenda(db).filter((i) => i.date === '2026-09-07');
  // the official date and the school's own note; "term 1 begins" says nothing new
  assert.equal(sameDay.length, 2); // the official rentrée and the school's own note
  assert.ok(sameDay.some((i) => i.source === 'national'));
  assert.ok(sameDay.some((i) => i.source === 'import'));
  assert.ok(sameDay.every((i) => !i.key.startsWith('term:')));
  assert.equal(ctx.settings.academicYear, '2026-2027');
});

test('a reminder is due the set number of days before the date', () => {
  const db = freshDb();
  db.prepare("INSERT INTO events (date, title, category, source) VALUES ('2026-10-05', 'Conseil de classe', 'deadline', 'manual')").run();
  const groups = dueGroups(db, { today: '2026-10-04', leadDays: [7, 1], categories: ['deadline'], horizon: 40 });
  assert.deepEqual(groups.map((g) => [g.date, g.lead, g.sendOn]), [
    ['2026-10-05', 7, '2026-09-28'], // overdue: the pass sends it rather than dropping it
    ['2026-10-05', 1, '2026-10-04'],
  ]);

  const early = dueGroups(db, { today: '2026-09-28', leadDays: [7, 1], categories: ['deadline'], horizon: 40 });
  assert.deepEqual(early.map((g) => [g.lead, g.sendOn]), [[7, '2026-09-28']]);
});

// ---- Sending ------------------------------------------------------------------

function withMail(today) {
  process.env.MAIL_DRY_RUN = '1';
  delete process.env.MAIL_HOST;
  return { today };
}

test('a pass prepares one message a day per person, and never the same one twice', async () => {
  const db = freshDb();
  withMail();
  db.prepare("INSERT INTO users (username, password_hash, email) VALUES ('a', 'x', 'a@azobe.cm')").run();
  addSubscriber(db, { email: 'b@azobe.cm' });
  db.prepare("INSERT INTO events (date, title, category, source) VALUES ('2026-10-05', 'Conseil de classe', 'deadline', 'manual')").run();
  saveReminderSettings(db, { enabled: true, leadDays: [7, 1], categories: ['deadline'] });

  const first = await runReminderPass(db, { today: '2026-10-04', force: true });
  assert.equal(first.dryRun, true);
  assert.equal(first.sent, 2); // one for each person
  assert.equal(readOutbox(db).length, 2);
  const message = readOutbox(db)[0];
  assert.match(message.subject, /Conseil de classe/);
  assert.match(message.body, /invite\.ics/);
  assert.ok(message.ics.startsWith('BEGIN:VCALENDAR'));
  assert.equal(message.status, 'dry-run');

  const second = await runReminderPass(db, { today: '2026-10-04', force: true });
  assert.equal(second.sent, 0);
  assert.equal(second.skipped, 2);
  assert.equal(readOutbox(db).length, 2, 'nothing was sent again');

  // a new date added later still goes out
  db.prepare("INSERT INTO events (date, title, category, source) VALUES ('2026-10-06', 'Réunion', 'event', 'manual')").run();
  saveReminderSettings(db, { categories: ['deadline', 'event'] });
  const third = await runReminderPass(db, { today: '2026-10-05', force: true });
  assert.equal(third.sent, 2);
  assert.ok(readReminderLog(db).length >= 2);
});

test('a dry run does not use up the reminder — once a mail server is there it is sent', async () => {
  const db = freshDb();
  withMail();
  addSubscriber(db, { email: 'b@azobe.cm' });
  db.prepare("INSERT INTO events (date, title, category, source) VALUES ('2026-10-05', 'Conseil de classe', 'deadline', 'manual')").run();
  saveReminderSettings(db, { enabled: true, leadDays: [7, 1], categories: ['deadline'] });

  const dry = await runReminderPass(db, { today: '2026-10-04', force: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.sent, 1);
  assert.ok(readReminderLog(db).some((r) => r.status === 'dry-run'));

  // a mail server appears; nothing listens on it, so the delivery fails — but it is tried,
  // which is the point: preparing the message earlier did not mark it as sent
  delete process.env.MAIL_DRY_RUN;
  Object.assign(process.env, { MAIL_HOST: '127.0.0.1', MAIL_PORT: '1', MAIL_USER: 'school@azobe.cm', MAIL_PASS: 'secret' });
  assert.equal(mailStatus().configured, true);
  const real = await runReminderPass(db, { today: '2026-10-04', force: true });
  assert.equal(real.dryRun, false);
  assert.equal(real.skipped, 0, 'the dry run did not count as already sent');
  assert.equal(real.failed, 1);
});

test('nothing is sent when reminders are off, or when nobody has an address', async () => {
  const db = freshDb();
  withMail();
  saveReminderSettings(db, { enabled: false });
  const off = await runReminderPass(db, { today: '2026-10-04' });
  assert.equal(off.status, 'disabled');
  saveReminderSettings(db, { enabled: true });
  const nobody = await runReminderPass(db, { today: '2026-10-04', force: true });
  assert.equal(nobody.status, 'no-recipients');
});

test('the preview shows the mails to come without sending or logging them', () => {
  const db = freshDb();
  withMail();
  addSubscriber(db, { email: 'b@azobe.cm' });
  const before = readOutbox(db).length;
  const preview = previewReminders(db, { today: '2026-09-01', horizon: 30 });
  assert.ok(preview.groups.length > 0);
  const rentrée = preview.groups.find((g) => g.date === '2026-09-07');
  assert.ok(rentrée, 'the first day of school is in the preview');
  assert.equal(rentrée.due, true);
  assert.match(rentrée.subject, /cole AZOBE|School Manager/i);
  assert.match(rentrée.text, /Rappel/);
  assert.equal(readOutbox(db).length, before);
  assert.equal(readReminderLog(db).length, 0);
  assert.equal(preview.mail.dryRun, true);
  assert.ok(preview.mail.missing.includes('MAIL_HOST'));
});

test('settings are checked when they are saved', () => {
  const db = freshDb();
  const defaults = reminderSettings(db);
  assert.deepEqual(defaults.leadDays, [7, 1]);
  assert.equal(defaults.enabled, true); // on from the start: the outbox shows what would go out
  assert.deepEqual(saveReminderSettings(db, { enabled: true, leadDays: [14, 3, 1], hour: 30 }).hour, 23);
  assert.deepEqual(reminderSettings(db).leadDays, [14, 3, 1]);
  assert.throws(() => saveReminderSettings(db, { leadDays: [] }), /at least one lead time/);
  assert.throws(() => saveReminderSettings(db, { categories: ['nonsense'] }), /at least one kind/);
  assert.throws(() => saveReminderSettings(db, { leadDays: [99] }), /at least one lead time/);
  assert.throws(() => saveReminderSettings(db, { prepareDays: 900 }), /1–365/);
});

test('with no mail server configured the app says so instead of pretending', () => {
  delete process.env.MAIL_HOST;
  delete process.env.MAIL_USER;
  delete process.env.MAIL_PASS;
  delete process.env.MAIL_DRY_RUN;
  const status = mailStatus();
  assert.equal(status.configured, false);
  assert.equal(status.dryRun, true);
  assert.match(status.reason, /No mail server configured/);
  process.env.MAIL_HOST = 'smtp.example.org';
  process.env.MAIL_USER = 'school';
  process.env.MAIL_PASS = 'secret';
  assert.equal(mailStatus().configured, true);
  assert.equal(mailStatus().dryRun, false);
  assert.equal(mailStatus().missing.length, 0);
});

// ---- The daily jobs -----------------------------------------------------------

test('the daily job runs the reminders once a day, after the hour set in Settings', async () => {
  const db = freshDb();
  withMail();
  addSubscriber(db, { email: 'b@azobe.cm' });
  saveReminderSettings(db, { enabled: true, hour: 6, leadDays: [7, 1] });

  const tooEarly = await dailyTick(db, { now: new Date('2026-09-01T03:00:00Z') });
  assert.equal(tooEarly.reminders, null, 'before the hour, nothing goes out');

  const onTime = await dailyTick(db, { now: new Date('2026-09-01T08:00:00Z') });
  assert.ok(onTime.reminders.sent > 0);
  assert.equal(reminderSettings(db).lastRun, onTime.today);

  const again = await dailyTick(db, { now: new Date('2026-09-01T09:00:00Z') });
  assert.equal(again.reminders, null, 'once a day is enough');
});

test('next year is drafted on its own once the current one is nearly over', async () => {
  const db = freshDb();
  saveReminderSettings(db, { autoPrepare: true, prepareDays: 120 });
  const year = activeYear(db);

  assert.match(prepareNextYear(db, '2027-01-05').reason, /days left/);
  const ready = prepareNextYear(db, addDays(year.endDate, -30));
  assert.equal(ready.created, true);
  assert.equal(ready.year.label, '2027-2028');
  assert.equal(prepareNextYear(db, addDays(year.endDate, -30)).created, false);

  saveReminderSettings(db, { autoPrepare: false });
  const db2 = freshDb();
  const year2 = activeYear(db2);
  saveReminderSettings(db2, { autoPrepare: false });
  assert.match(prepareNextYear(db2, addDays(year2.endDate, -30)).reason, /off/);
});
