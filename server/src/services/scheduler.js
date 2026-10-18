// The daily jobs: sending the reminders that are due, and — as the year draws to a close —
// preparing next year's calendar from this one so it is waiting when the new arrêté comes.
import { getDb } from '../db/index.js';
import { diffDays, todayInTimezone } from '../lib/dates.js';
import { readSettings } from './context.js';
import { reminderSettings, runReminderPass } from './reminders.js';
import { activeYear, rollOverYear } from './schoolYears.js';

const HOUR_MS = 3_600_000;
const TICK_MS = 15 * 60_000;

/** The hour of day where the school is, not where the server is. */
function hourIn(timeZone, now) {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(now));
  } catch {
    return now.getHours();
  }
}

/**
 * Draft the following school year once the current one is nearly over. Nothing is applied:
 * the draft waits to be checked against the new arrêté and activated by hand.
 *
 * @returns {{created:boolean, year:object|null, reason?:string}}
 */
export function prepareNextYear(db, today) {
  const settings = reminderSettings(db);
  if (!settings.autoPrepare) return { created: false, year: null, reason: 'automatic preparation is off' };
  const year = activeYear(db);
  if (!year) return { created: false, year: null, reason: 'no active school year' };
  const left = diffDays(today, year.endDate);
  if (left > settings.prepareDays) return { created: false, year: null, reason: `${left} days left in ${year.label}` };
  const already = db.prepare('SELECT id FROM school_years WHERE label = ?').get(nextLabelOf(year.label) ?? '');
  if (already) {
    const existing = db.prepare('SELECT * FROM school_years WHERE id = ?').get(already.id);
    return { created: false, year: { id: existing.id, label: existing.label, status: existing.status }, reason: 'already prepared' };
  }
  const draft = rollOverYear(db, year.id);
  console.log(`[calendar] prepared a draft of ${draft.label} from ${year.label} (${left} days left)`);
  return { created: true, year: { id: draft.id, label: draft.label, status: draft.status } };
}

function nextLabelOf(label) {
  const m = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(String(label ?? '').trim());
  return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : null;
}

/**
 * One pass of the daily jobs. Safe to call as often as you like: reminders run once a day,
 * after the hour set in Settings, and the next year is drafted only once.
 */
export async function dailyTick(db, { now = new Date(), force = false } = {}) {
  const settings = readSettings(db);
  const today = todayInTimezone(settings.timezone, now);
  const reminder = reminderSettings(db);
  const result = { today, reminders: null, nextYear: null };

  if (reminder.enabled || force) {
    const due = force || (hourIn(settings.timezone, now) >= reminder.hour && reminder.lastRun !== today);
    if (due) {
      try {
        result.reminders = await runReminderPass(db, { today, force });
      } catch (e) {
        console.error('[reminders] pass failed', e);
        result.reminders = { status: 'failed', error: String(e?.message ?? e) };
      }
    }
  }

  try {
    result.nextYear = prepareNextYear(db, today);
  } catch (e) {
    console.error('[calendar] preparing the next year failed', e);
    result.nextYear = { created: false, year: null, reason: String(e?.message ?? e) };
  }

  return result;
}

/**
 * Start the background jobs. The timers are unref'd: they never keep the process alive on
 * their own, so shutting the app down stays immediate.
 */
export function startScheduler({ intervalMs = TICK_MS, firstDelayMs = 20_000, db = null } = {}) {
  const run = () => dailyTick(db ?? getDb()).catch((e) => console.error('[scheduler]', e));
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  const first = setTimeout(run, firstDelayMs);
  first.unref?.();
  return {
    stop() {
      clearInterval(timer);
      clearTimeout(first);
    },
    runNow: run,
  };
}

export { HOUR_MS };
