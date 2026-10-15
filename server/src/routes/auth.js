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
  readBearer,
  readCookie,
  sessionUser,
  setSessionCookie,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../lib/auth.js';
import { HttpError, badRequest } from '../lib/http.js';
import { demoCredentials, refuseDemoAccount } from '../services/demo-login.js';

const limiter = createRateLimiter();

/** Real accounts (the optional public demo account does not count as an administrator). */
export function userCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_demo = 0').get().n;
}

/** Attach req.user from the session token: the Authorization header first, then the cookie. */
export function sessionMiddleware(req, _res, next) {
  const db = getDb();
  req.user = sessionUser(db, readBearer(req)) ?? sessionUser(db, readCookie(req, SESSION_COOKIE));
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
    // Public demo account (DEMO_LOGIN=1 and invented data only), shown on the sign-in page.
    demo: demoCredentials(db),
  });
});

// First-run setup: create the admin account (only while no account exists).
authRouter.post('/setup', (req, res) => {
  const db = getDb();
  const username = validateUsername(req.body?.username);
  validatePassword(req.body?.password);
  const created = db.transaction(() => {
    if (userCount(db) > 0) return null;
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      throw new HttpError(409, 'This username is used by the demo account — choose another one');
    }
    return db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashPassword(req.body.password));
  })();
  if (!created) throw new HttpError(409, 'An administrator account already exists');
  const { token, expires } = createSession(db, Number(created.lastInsertRowid), config.sessionDays);
  setSessionCookie(req, res, token, expires);
  // The token is also returned so the app can send it in a header where cookies are blocked.
  res.status(201).json({ user: { id: Number(created.lastInsertRowid), username }, token });
});

authRouter.post('/login', (req, res) => {
  const db = getDb();
  const ip = req.ip || 'unknown';
  if (!limiter.check(ip)) throw new HttpError(429, 'Too many attempts — please wait 15 minutes');
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) throw badRequest('Username and password are required');
  const user = db.prepare('SELECT id, username, password_hash, is_demo FROM users WHERE username = ?').get(username);
  const demoClosed = user?.is_demo === 1 && !demoCredentials(db);
  if (!user || demoClosed || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect username or password');
  }
  limiter.reset(ip);
  const { token, expires } = createSession(db, user.id, config.sessionDays);
  setSessionCookie(req, res, token, expires);
  res.json({ user: { id: user.id, username: user.username }, token });
});

authRouter.post('/logout', (req, res) => {
  const db = getDb();
  deleteSession(db, readBearer(req));
  deleteSession(db, readCookie(req, SESSION_COOKIE));
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.post('/password', requireAuth, refuseDemoAccount, (req, res) => {
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
  res.json({ ok: true, token });
});
