import crypto from 'node:crypto';
import { HttpError } from './http.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'sm_session';
export const CSRF_HEADER = 'x-requested-with';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(key, expected);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters long');
  }
  if (password.length > 200) throw new HttpError(400, 'Password is too long');
}

export function validateUsername(username) {
  if (typeof username !== 'string' || !/^[\p{L}\p{N}._@-]{3,50}$/u.test(username.trim())) {
    throw new HttpError(400, 'Username must be 3–50 letters, digits or . _ @ -');
  }
  return username.trim();
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function createSession(db, userId, days) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return { token, expires };
}

export function sessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.is_demo FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), new Date().toISOString());
  return row ? { id: row.id, username: row.username, demo: row.is_demo === 1 } : null;
}

export function deleteSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

/**
 * Session token sent by the app in an `Authorization: Bearer …` header. Browsers often refuse
 * cookies when the app is shown inside another site (e.g. a preview panel); the header always works.
 */
export function readBearer(req) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization ?? '');
  return match ? match[1] : null;
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/**
 * Cookie options. COOKIE_SAMESITE=none is only needed when the app is shown
 * inside an iframe on another site (e.g. a preview panel); it forces Secure.
 */
function cookieOptions(req) {
  const embedded = process.env.COOKIE_SAMESITE === 'none';
  return embedded
    ? { httpOnly: true, sameSite: 'none', secure: true, partitioned: true, path: '/' }
    : { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' };
}

export function setSessionCookie(req, res, token, expires) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), expires: new Date(expires) });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

/** Simple in-memory limiter for login attempts (per IP). */
export function createRateLimiter({ windowMs = 15 * 60_000, max = 10 } = {}) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < now) {
        hits.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
