import { Router } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_CLIENT,
  clearSessionCookie,
  createRateLimiter,
  createSession,
  deleteSession,
  hashPassword,
  isEmbeddedRequest,
  readBearer,
  readCookie,
  readSessionHeader,
  readSessionToken,
  sessionChannels,
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

/**
 * Attach req.user from the session token: the app's own header first, then `Authorization: Bearer`,
 * the query parameter and finally the cookie (see readSessionToken).
 */
export function sessionMiddleware(req, _res, next) {
  const db = getDb();
  const session = readSessionToken(req);
  req.session = session;
  req.user = sessionUser(db, session.token);
  if (process.env.DEBUG_SESSIONS) {
    // Handy in an embedded preview: shows which channels actually reached the server.
    console.log(
      `[session] ${req.method} ${req.path} channels=[${sessionChannels(req).join(', ') || 'none'}] via=${session.via ?? 'none'} user=${req.user?.username ?? 'anonymous'}`,
    );
  }
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
    // How this request proved who it is — the app shows it and uses it to pick a transport that works.
    session: {
      via: req.session?.via ?? null,
      channels: sessionChannels(req),
      cookie: Boolean(readCookie(req, SESSION_COOKIE) || readCookie(req, SESSION_COOKIE_CLIENT)),
      embedded: isEmbeddedRequest(req),
    },
  });
});

/**
 * Capability probe for embedded pages (preview panels, iframes on another site). The app sends the
 * same random value in every channel it can use; the answer says which of them arrived here, so the
 * app can carry the session token in a way the proxy in front of it does not drop.
 * No session data is read or returned — it is only an echo of the probe.
 */
authRouter.get('/transport', (req, res) => {
  const probe = typeof req.query?.probe === 'string' && /^[A-Za-z0-9_-]{20,200}$/.test(req.query.probe) ? req.query.probe : null;
  res.json({
    probe: Boolean(probe),
    channels: probe
      ? {
          sessionHeader: readSessionHeader(req) === probe,
          authorization: readBearer(req) === probe,
          // The probe itself arrived in the address, so the app can always fall back to carrying the
          // token there — that is the one channel a proxy does not normally strip.
          query: true,
        }
      : null,
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
  // The token may arrive in any channel (header, query parameter or cookie): end it wherever it is.
  deleteSession(db, req.session?.token);
  deleteSession(db, readBearer(req));
  deleteSession(db, readCookie(req, SESSION_COOKIE));
  deleteSession(db, readCookie(req, SESSION_COOKIE_CLIENT));
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
