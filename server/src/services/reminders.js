// Reminders: the school calendar, sent to everybody's own mail box — with an invitation
// attached, so the date lands in their calendar and stays there.
//
// One message a day at most, per person, listing everything that is due that day: a busy
// week should not fill an inbox.
import { getDb } from '../db/index.js';
import { DAY_NAMES, MONTH_NAMES, addDays } from '../lib/dates.js';
import { buildIcs } from '../lib/ics.js';
import { loadContext } from './context.js';
import { deliver, mailStatus } from './mailer.js';
import { readEvents } from './schoolYears.js';

export const REMINDER_DEFAULTS = {
  enabled: false,
  leadDays: [7, 1],
  categories: ['official', 'break', 'holiday', 'exam', 'deadline', 'event'],
  hour: 7,
  autoPrepare: true,
  prepareDays: 120,
};

const CATEGORY_LABEL = {
  official: 'Official date / Date officielle',
  break: 'Holiday period / Vacances',
  holiday: 'Public holiday / Jour férié',
  exam: 'Examinations / Examens',
  deadline: 'Deadline / Échéance',
  event: 'School event / Événement',
};

// ---- Settings -----------------------------------------------------------------

export function reminderSettings(db = getDb()) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const leadDays = (s.reminder_lead_days ?? '')
    .split(/[,\s]+/)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 60);
  const categories = (s.reminder_categories ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  return {
    enabled: (s.reminder_enabled ?? '0') === '1',
    leadDays: leadDays.length ? [...new Set(leadDays)].sort((a, b) => b - a) : [...REMINDER_DEFAULTS.leadDays],
    categories: categories.length ? categories : [...REMINDER_DEFAULTS.categories],
    hour: clampHour(Number(s.reminder_hour ?? REMINDER_DEFAULTS.hour)),
    autoPrepare: (s.reminder_auto_prepare ?? '1') === '1',
    prepareDays: Number(s.reminder_prepare_days ?? REMINDER_DEFAULTS.prepareDays) || 120,
    lastRun: s.reminder_last_run ?? '',
  };
}

function clampHour(n) {
  if (!Number.isFinite(n)) return REMINDER_DEFAULTS.hour;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function saveReminderSettings(db, patch = {}) {
  const set = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const updates = {};
  if (patch.enabled !== undefined) updates.reminder_enabled = patch.enabled ? '1' : '0';
  if (patch.autoPrepare !== undefined) updates.reminder_auto_prepare = patch.autoPrepare ? '1' : '0';
  if (patch.leadDays !== undefined) {
    const lead = [...new Set([...patch.leadDays].map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60))];
    if (!lead.length) throw new Error('Give at least one lead time');
    if (lead.length > 6) throw new Error('At most six lead times');
    updates.reminder_lead_days = lead.sort((a, b) => b - a).join(',');
  }
  if (patch.categories !== undefined) {
    const cats = [...patch.categories].filter((c) => Object.keys(CATEGORY_LABEL).includes(c));
    if (!cats.length) throw new Error('Choose at least one kind of date to remind about');
    updates.reminder_categories = cats.join(',');
  }
  if (patch.hour !== undefined) updates.reminder_hour = String(clampHour(Number(patch.hour)));
  if (patch.prepareDays !== undefined) {
    const n = Number(patch.prepareDays);
    if (!Number.isFinite(n) || n < 1 || n > 365) throw new Error('Lead time for the next year must be 1–365 days');
    updates.reminder_prepare_days = String(Math.round(n));
  }
  db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) set.run(k, v);
  })();
  return reminderSettings(db);
}

function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

// ---- Who receives them --------------------------------------------------------

/**
 * Everybody a reminder goes to: the accounts that have an e-mail address, plus the staff
 * on the mailing list who never sign in.
 */
export function recipients(db = getDb()) {
  const out = [];
  const seen = new Set();
  const push = (email, name, source) => {
    const key = email.trim().toLowerCase();
    if (!key || !key.includes('@') || seen.has(key)) return;
    seen.add(key);
    out.push({ email: key, name: name?.trim() || '', source });
  };
  for (const u of db.prepare('SELECT username, email FROM users').all()) push(u.email ?? '', u.username, 'user');
  for (const s of db.prepare('SELECT email, name FROM reminder_subscribers WHERE active = 1 ORDER BY name, email').all()) {
    push(s.email, s.name, 'subscriber');
  }
  return out;
}

export function listSubscribers(db = getDb()) {
  return db.prepare('SELECT id, email, name, active, created_at FROM reminder_subscribers ORDER BY name, email').all().map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    active: Boolean(s.active),
    createdAt: s.created_at,
  }));
}

export function addSubscriber(db, { email, name = '' }) {
  const value = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('That is not an e-mail address');
  const info = db
    .prepare('INSERT INTO reminder_subscribers (email, name, active) VALUES (?, ?, 1) ON CONFLICT(email) DO UPDATE SET name = excluded.name, active = 1')
    .run(value, String(name ?? '').trim().slice(0, 120));
  return Number(info.lastInsertRowid);
}

export function updateSubscriber(db, id, { email, name, active }) {
  const current = db.prepare('SELECT id, email, name, active FROM reminder_subscribers WHERE id = ?').get(id);
  if (!current) throw new Error('Subscriber not found');
  const next = {
    email: email === undefined ? current.email : String(email).trim().toLowerCase(),
    name: name === undefined ? current.name : String(name).trim().slice(0, 120),
    active: active === undefined ? current.active : active ? 1 : 0,
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new Error('That is not an e-mail address');
  db.prepare('UPDATE reminder_subscribers SET email = ?, name = ?, active = ? WHERE id = ?').run(next.email, next.name, next.active, id);
  return { id, ...next, active: Boolean(next.active) };
}

export function removeSubscriber(db, id) {
  const r = db.prepare('DELETE FROM reminder_subscribers WHERE id = ?').run(id);
  if (!r.changes) throw new Error('Subscriber not found');
  return true;
}

/** Set the e-mail address of the account that is signed in (and of any account by id). */
export function setUserEmail(db, userId, email) {
  const value = String(email ?? '').trim().toLowerCase();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('That is not an e-mail address');
  const r = db.prepare('UPDATE users SET email = ?, updated_at = (strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')) WHERE id = ?').run(value || null, userId);
  if (!r.changes) throw new Error('Account not found');
  return db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId);
}

export function listAccounts(db = getDb()) {
  return db.prepare('SELECT id, username, email, is_demo FROM users ORDER BY username').all().map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email ?? '',
    demo: Boolean(u.is_demo),
  }));
}

// ---- What is reminded about ---------------------------------------------------

function normTitle(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Everything worth a reminder, in date order: the events (national and the school's own),
 * the public holidays, and the first and last day of each term.
 */
export function buildAgenda(db = getDb(), { from, to } = {}) {
  const ctx = loadContext(db);
  const items = [];

  for (const e of readEvents(db, { from, to })) {
    if (!e.remind) continue;
    items.push({
      key: `event:${e.id}`,
      eventId: e.id,
      date: e.date,
      endDate: e.endDate,
      title: e.title,
      category: e.category,
      source: e.source,
    });
  }

  for (const h of ctx.holidays) {
    if (from && h.date < from) continue;
    if (to && h.date > to) continue;
    items.push({
      key: `holiday:${h.date}`,
      eventId: null,
      date: h.date,
      endDate: null,
      title: h.name,
      category: 'holiday',
      source: 'national',
    });
  }

  for (const term of ctx.calendar.terms) {
    const days = ctx.calendar.days.filter((d) => d.type === 'school' && d.date >= term.start && d.date <= term.end);
    if (!days.length) continue;
    for (const [when, day] of [['start', days[0]], ['end', days.at(-1)]]) {
      if (from && day.date < from) continue;
      if (to && day.date > to) continue;
      items.push({
        key: `term:${term.number}:${when}`,
        eventId: null,
        date: day.date,
        endDate: null,
        title:
          when === 'start'
            ? `${term.name} begins · first day of classes / Début du ${term.name}`
            : `${term.name} ends · last day of classes / Fin du ${term.name}`,
        category: 'official',
        source: 'national',
      });
    }
  }

  return orderSameDay(items);
}

/** Lower number = said first when several things happen on the same day. */
function itemPriority(item) {
  if (item.key.startsWith('term:')) return 3;
  if (item.category === 'official' && item.source === 'national') return 0;
  if (item.category === 'holiday') return 1;
  return 2;
}

/** Words long enough to mean something when two titles are compared. */
function titleWords(title) {
  return normTitle(title)
    .split(' ')
    .filter((w) => w.length >= 2)
    .filter((w) => !['de', 'des', 'du', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'un', 'une', 'the', 'of', 'and'].includes(w));
}

/** Do two titles share a run of words? ("Rentrée scolaire des élèves" twice, say.) */
function sharesWording(a, b, run = 4) {
  const wordsA = titleWords(a);
  const wordsB = titleWords(b);
  for (let i = 0; i + run <= wordsA.length; i += 1) {
    const chunk = wordsA.slice(i, i + run).join(' ');
    if (wordsB.join(' ').includes(chunk)) return true;
  }
  return false;
}

/**
 * Several things can fall on the same date — the school's planner and the national
 * calendar both write "rentrée", and a term always starts the day school does — so the
 * day is tidied into what is worth saying once: the official date first, the school's
 * note next, and "term N begins" only when nothing else already says it.
 */
function orderSameDay(items) {
  const byDate = new Map();
  for (const item of items) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }
  const out = [];
  for (const [date, group] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const ordered = [...group].sort(
      (a, b) => itemPriority(a) - itemPriority(b) || a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
    );
    const kept = [];
    for (const item of ordered) {
      if (item.key.startsWith('term:') && kept.some((k) => k.category === 'official')) continue;
      if (kept.some((k) => k.category === item.category && sharesWording(k.title, item.title))) continue;
      if (kept.some((k) => normTitle(k.title) === normTitle(item.title))) continue;
      kept.push(item);
    }
    out.push(...kept);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || itemPriority(a) - itemPriority(b) || a.title.localeCompare(b.title));
}

/**
 * Group the agenda into "what is due on that day", for each lead time:
 * a reminder `lead` days ahead of a date is sent on that date minus `lead`.
 */
export function dueGroups(db, { today, leadDays, categories, horizon = 45 } = {}) {
  const agenda = buildAgenda(db, { from: today, to: addDays(today, horizon) });
  const groups = [];
  for (const lead of [...new Set(leadDays)].sort((a, b) => b - a)) {
    for (const item of agenda) {
      const sendOn = addDays(item.date, -lead);
      if (sendOn > today) continue; // not yet (only matters for the preview)
      let group = groups.find((g) => g.date === item.date && g.lead === lead);
      if (!group) {
        group = { date: item.date, lead, sendOn, items: [] };
        groups.push(group);
      }
      if (!categories.includes(item.category)) continue;
      group.items.push(item);
    }
  }
  return groups
    .filter((g) => g.items.length)
    .sort((a, b) => a.date.localeCompare(b.date) || b.lead - a.lead);
}

// ---- The messages -------------------------------------------------------------

// "samedi 24 octobre 2026 / Saturday 24 October 2026" — the school reads French first.
const DAY_NAMES_FULL = {
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const fr = `${DAY_NAMES_FULL.fr[dow]} ${d} ${MONTH_NAMES.fr[m - 1].toLowerCase()} ${y}`;
  const en = `${DAY_NAMES.en[dow]} ${MONTH_NAMES.en[m - 1]} ${d}, ${y}`;
  return `${fr} / ${en}`;
}

const whenLabel = (lead) => (lead === 0 ? "today / aujourd'hui" : lead === 1 ? 'tomorrow / demain' : `in ${lead} days / dans ${lead} jours`);

export function renderMessage({ group, schoolName, recipient, academicYear }) {
  const date = prettyDate(group.date);
  const headline = group.items[0]?.title ?? 'School date';
  const subject = group.items.length > 1
    ? `${schoolName} · ${group.items.length} dates on ${date.split(' / ')[1]} (${whenLabel(group.lead)})`
    : `${schoolName} · ${headline} — ${date.split(' / ')[1]} (${whenLabel(group.lead)})`;

  const lines = [
    `Bonjour ${recipient.name || ''}`.trim() + ',',
    '',
    `Rappel · ${schoolName} — calendrier scolaire ${academicYear}.`,
    `Reminder · ${schoolName} — school calendar ${academicYear}.`,
    '',
    `${date}  (${whenLabel(group.lead)})`,
  ];
  for (const item of group.items) {
    const range = item.endDate && item.endDate > item.date ? ` → ${prettyDate(item.endDate).split(' / ')[0]}` : '';
    lines.push(`  • ${item.title}${range}  [${CATEGORY_LABEL[item.category] ?? item.category}]`);
  }
  lines.push(
    '',
    'The attached invitation (invite.ics) opens in Google Calendar, Outlook or Apple Calendar:',
    'accepted once, the date stays in your calendar.',
    '',
    `— ${schoolName} · School Manager`,
  );
  return { subject: subject.replace(/\s+/g, ' ').trim(), text: lines.join('\n') };
}

export function buildIcsForGroup({ group, schoolName, attendee, organizer, now }) {
  return buildIcs({
    items: group.items,
    schoolName,
    organizer,
    attendee,
    reminderMinutes: [60 * 24, 60],
    now,
    uidSalt: `sm-${group.date}`,
  });
}

// ---- Running a pass -----------------------------------------------------------

const MAX_MESSAGES_PER_PASS = 300;

/**
 * Send (or, in dry run, prepare) everything that is due today.
 *
 * @returns {Promise<{status:string, dryRun:boolean, groups:number, sent:number, skipped:number, failed:number, messages:Array}>}
 */
export async function runReminderPass(db, { today, dryRun = false, force = false, limit = MAX_MESSAGES_PER_PASS } = {}) {
  const settings = reminderSettings(db);
  if (!settings.enabled && !force) return { status: 'disabled', dryRun: false, groups: 0, sent: 0, skipped: 0, failed: 0, messages: [] };

  const ctx = loadContext(db);
  const people = recipients(db);
  if (!people.length) return { status: 'no-recipients', dryRun, groups: 0, sent: 0, skipped: 0, failed: 0, messages: [] };

  // Anything already due is sent, not only what falls due today: if the server was off, the
  // reminder goes out late rather than never. When several lead times are overdue for the
  // same date, only the nearest one is worth sending.
  const due = dueGroups(db, {
    today,
    leadDays: settings.leadDays,
    categories: settings.categories,
    horizon: Math.max(...settings.leadDays, 0) + 1,
  }).filter((g) => g.sendOn <= today);
  const nearest = new Map();
  for (const g of due) if (!nearest.has(g.date) || g.lead < nearest.get(g.date).lead) nearest.set(g.date, g);
  const groups = [...nearest.values()].sort((a, b) => a.date.localeCompare(b.date));
  const superseded = due.filter((g) => nearest.get(g.date) !== g);

  const mail = mailStatus();
  const willDryRun = dryRun || mail.dryRun;
  const already = db.prepare('SELECT status FROM reminder_log WHERE key = ? AND date = ? AND lead_days = ? AND recipient = ?');
  const forget = db.prepare('DELETE FROM reminder_log WHERE key = ? AND date = ? AND lead_days = ? AND recipient = ?');
  const log = db.prepare(
    `INSERT INTO reminder_log (key, event_id, date, lead_days, recipient, status, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  const outbox = db.prepare(
    'INSERT INTO outbox (recipient, subject, body, ics, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
  );

  const messages = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // The lead times we are not sending are put on record: otherwise the next pass would
  // find them still due and send a second mail about the same date.
  db.transaction(() => {
    for (const group of superseded) {
      for (const person of people) {
        for (const item of group.items) {
          if (!willDryRun) log.run(item.key, item.eventId, group.date, group.lead, person.email, 'superseded', 'a nearer reminder for the same date went out instead');
        }
      }
    }
  })();

  for (const group of groups) {
    for (const person of people) {
      if (messages.length >= limit) break;
      // A dry run only writes a provisional line: once a mail server is set up, the same
      // reminder goes out for real instead of being treated as already sent.
      const fresh = group.items.filter((i) => {
        const row = already.get(i.key, group.date, group.lead, person.email);
        if (!row) return true;
        if (willDryRun || row.status !== 'dry-run') return false;
        forget.run(i.key, group.date, group.lead, person.email);
        return true;
      });
      if (!fresh.length) {
        skipped += 1;
        continue;
      }
      const { subject, text } = renderMessage({
        group: { ...group, items: fresh },
        schoolName: ctx.settings.schoolName || 'School Manager',
        recipient: person,
        academicYear: ctx.settings.academicYear,
      });
      const ics = buildIcsForGroup({
        group: { ...group, items: fresh },
        schoolName: ctx.settings.schoolName || 'School Manager',
        attendee: person.email,
        organizer: (process.env.MAIL_FROM || process.env.MAIL_USER || '').replace(/^.*</, '').replace(/>.*$/, '').trim(),
        now: new Date(),
      });

      const result = willDryRun
        ? { status: 'dry-run', detail: `Prepared for ${person.email}${mail.host ? ` (would go through ${mail.host})` : ''}`, message: '' }
        : await deliver({ to: person.email, subject, text, ics });

      const message = {
        to: person.email,
        name: person.name,
        source: person.source,
        date: group.date,
        lead: group.lead,
        subject,
        text,
        items: fresh.map((i) => ({ key: i.key, title: i.title, category: i.category })),
        status: result.status,
        detail: result.detail,
      };
      messages.push(message);
      db.transaction(() => {
        outbox.run(person.email, subject, text, ics, result.status, result.detail);
        if (result.status !== 'failed') {
          for (const item of fresh) forget.run(item.key, group.date, group.lead, person.email);
          for (const item of fresh) log.run(item.key, item.eventId, group.date, group.lead, person.email, result.status, result.detail);
        }
      })();

      if (result.status === 'failed') failed += 1;
      else sent += 1;
    }
  }

  // Remember the day even when nothing could be delivered: the pass has run, and running
  // it again the same day would only prepare the same messages twice.
  if (!dryRun) setSetting(db, 'reminder_last_run', today);
  return { status: 'ok', dryRun: willDryRun, groups: groups.length, sent, skipped, failed, messages };
}

/**
 * What the next days would send, without sending anything and without logging it —
 * the school checks this before switching reminders on.
 */
export function previewReminders(db, { today, horizon = 30 } = {}) {
  const settings = reminderSettings(db);
  const ctx = loadContext(db);
  const people = recipients(db);
  const groups = dueGroups(db, { today, leadDays: settings.leadDays, categories: settings.categories, horizon });
  return {
    today,
    horizon,
    enabled: settings.enabled,
    leadDays: settings.leadDays,
    categories: settings.categories,
    recipients: people,
    mail: mailStatus(),
    groups: groups.map((g) => {
      const { subject, text } = renderMessage({
        group: g,
        schoolName: ctx.settings.schoolName || 'School Manager',
        recipient: people[0] ?? { name: '', email: '' },
        academicYear: ctx.settings.academicYear,
      });
      return {
        date: g.date,
        lead: g.lead,
        sendOn: g.sendOn,
        due: g.sendOn <= today,
        subject,
        text,
        items: g.items.map((i) => ({ key: i.key, title: i.title, category: i.category, source: i.source, endDate: i.endDate })),
      };
    }),
  };
}

export function readOutbox(db = getDb(), limit = 100) {
  return db
    .prepare('SELECT id, recipient, subject, body, ics, status, detail, created_at FROM outbox ORDER BY id DESC LIMIT ?')
    .all(limit)
    .map((m) => ({
      id: m.id,
      recipient: m.recipient,
      subject: m.subject,
      body: m.body,
      ics: m.ics,
      status: m.status,
      detail: m.detail,
      createdAt: m.created_at,
    }));
}

export function clearOutbox(db = getDb()) {
  db.prepare('DELETE FROM outbox').run();
  return true;
}

export function readReminderLog(db = getDb(), limit = 100) {
  return db
    .prepare(
      `SELECT l.id, l.key, l.date, l.lead_days AS lead, l.recipient, l.status, l.detail, l.sent_at,
              COALESCE(e.title, '') AS event_title
         FROM reminder_log l LEFT JOIN events e ON e.id = l.event_id
        ORDER BY l.id DESC LIMIT ?`,
    )
    .all(limit)
    .map((r) => ({
      id: r.id,
      key: r.key,
      date: r.date,
      lead: r.lead,
      recipient: r.recipient,
      status: r.status,
      detail: r.detail,
      sentAt: r.sent_at,
      eventTitle: r.event_title,
    }));
}
