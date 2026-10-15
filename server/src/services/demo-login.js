// Public demo sign-in (DEMO_LOGIN=1): a ready-made account whose username and password are shown on
// the sign-in page, so anyone can try the app.
//
// Safety rules:
// - it only exists while the database holds generated demo data (settings.demo_mode = '1'): importing
//   a workbook, deleting all data or restoring a real backup removes it (and ends its sessions);
// - it cannot import, download or restore backups, delete all data or change its password
//   (see `refuseDemoAccount`), so it can neither reach other accounts' data nor lock other visitors out;
// - it is not an administrator: a fresh install still offers "create the administrator account".
import { demoLoginConfig } from '../config.js';
import { hashPassword, validatePassword, validateUsername } from '../lib/auth.js';
import { HttpError } from '../lib/http.js';

function holdsDemoData(db) {
  return db.prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get()?.value === '1';
}

/** Credentials to show on the sign-in page, or null when demo sign-in is not available. */
export function demoCredentials(db) {
  const cfg = demoLoginConfig();
  if (!cfg || !holdsDemoData(db)) return null;
  const row = db.prepare('SELECT username FROM users WHERE is_demo = 1').get();
  return row ? { username: row.username, password: cfg.password } : null;
}

/**
 * Create, refresh or delete the demo account so it matches the current state. Call it after anything
 * that changes that state: start-up, loading demo data, importing, deleting all data, restoring.
 * Returns the credentials when demo sign-in is available, otherwise null.
 */
export function syncDemoAccount(db) {
  const cfg = demoLoginConfig();
  if (!cfg || !holdsDemoData(db)) {
    db.prepare('DELETE FROM users WHERE is_demo = 1').run(); // its sessions go too (ON DELETE CASCADE)
    return null;
  }
  const username = validateUsername(cfg.username);
  validatePassword(cfg.password);
  if (db.prepare('SELECT 1 FROM users WHERE username = ? AND is_demo = 0').get(username)) {
    console.warn(`[demo] "${username}" is already a real account — set DEMO_USERNAME to another name. Demo sign-in is off.`);
    db.prepare('DELETE FROM users WHERE is_demo = 1').run();
    return null;
  }
  const hash = hashPassword(cfg.password);
  const existing = db.prepare('SELECT id FROM users WHERE is_demo = 1').get();
  if (existing) {
    db.prepare("UPDATE users SET username = ?, password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
      username,
      hash,
      existing.id,
    );
  } else {
    db.prepare('INSERT INTO users (username, password_hash, is_demo) VALUES (?, ?, 1)').run(username, hash);
  }
  return { username, password: cfg.password };
}

/** Express middleware: block actions that need a real account. */
export function refuseDemoAccount(req, _res, next) {
  if (req.user?.demo) {
    return next(new HttpError(403, 'Not available with the demo account — sign in with your own account'));
  }
  next();
}
