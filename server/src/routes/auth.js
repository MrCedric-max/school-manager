import { Router } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createRateLimiter,
  createSession,
  deleteSession,
  hashPassword,
  readCookie,
  sessionUser,
  setSessionCookie,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../lib/auth.js';
import { HttpError, badRequest } from '../lib/http.js';

const limiter = createRateLimiter();

export function userCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

/** Attach req.user when a valid session cookie is present. */
export function sessionMiddleware(req, _res, next) {
  req.user = sessionUser(getDb(), readCookie(req, SESSION_COOKIE));
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in'));
  next();
}

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  const db = getDb();
  const setting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
  res.json({
    setupRequired: userCount(db) === 0,
    user: req.user,
    school: { name: setting('school_name'), subtitle: setting('school_subtitle'), academicYear: setting('academic_year') },
  });
});

// First-run setup: create the admin account (only while no account exists).
authRouter.post('/setup', (req, res) => {
  const db = getDb();
  const username = validateUsername(req.body?.username);
  validatePassword(req.body?.password);
  const created = db.transaction(() => {
    if (userCount(db) > 0) return null;
    return db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashPassword(req.body.password));
  })();
  if (!created) throw new HttpError(409, 'An administrator account already exists');
  const { token, expires } = createSession(db, Number(created.lastInsertRowid), config.sessionDays);
  setSessionCookie(req, res, token, expires);
  res.status(201).json({ user: { id: Number(created.lastInsertRowid), username } });
});

authRouter.post('/login', (req, res) => {
  const db = getDb();
  const ip = req.ip || 'unknown';
  if (!limiter.check(ip)) throw new HttpError(429, 'Too many attempts — please wait 15 minutes');
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) throw badRequest('Username and password are required');
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect username or password');
  }
  limiter.reset(ip);
  const { token, expires } = createSession(db, user.id, config.sessionDays);
  setSessionCookie(req, res, token, expires);
  res.json({ user: { id: user.id, username: user.username } });
});

authRouter.post('/logout', (req, res) => {
  deleteSession(getDb(), readCookie(req, SESSION_COOKIE));
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.post('/password', requireAuth, (req, res) => {
  const db = getDb();
  const { currentPassword, newPassword } = req.body ?? {};
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.password_hash)) {
    throw badRequest('Current password is incorrect');
  }
  validatePassword(newPassword);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
      hashPassword(newPassword),
      user.id,
    );
    // Sign out every other session.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  })();
  const { token, expires } = createSession(db, user.id, config.sessionDays);
  setSessionCookie(req, res, token, expires);
  res.json({ ok: true });
});
