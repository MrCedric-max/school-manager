import crypto from 'node:crypto';
import { HttpError } from './http.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'sm_session';
/** Cookie the app sets itself (a partitioned one, in an embedded page) when the browser refuses the httpOnly cookie. */
export const SESSION_COOKIE_CLIENT = 'sm_token';
export const CSRF_HEADER = 'x-requested-with';
/** Header and query parameter the app uses to carry the session token where cookies are refused. */
export const SESSION_HEADER = 'x-session-token';
export const SESSION_QUERY = 'sm_session';
/** A session token: 32 random bytes as base64url (43 characters). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

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
 * cookies when the app is shown inside another site (e.g. a preview panel); a header always works —
 * but only when the proxy in front of the app passes it through, which is why the app also has
 * `x-session-token` and, as a last resort, the `?sm_session=` query parameter (see readSessionToken).
 */
export function readBearer(req) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(req.headers.authorization ?? '');
  return match ? match[1] : null;
}

/** Session token in the app's own header — no proxy gives `Authorization` a special meaning. */
export function readSessionHeader(req) {
  const value = req.headers[SESSION_HEADER];
  return typeof value === 'string' && TOKEN_PATTERN.test(value) ? value : null;
}

/** Session token in the query string — the only channel left when a proxy drops our headers. */
export function readSessionQuery(req) {
  const value = req.query?.[SESSION_QUERY];
  return typeof value === 'string' && TOKEN_PATTERN.test(value) ? value : null;
}

/**
 * Where a request carries its session token, in order of preference:
 *
 * 1. `x-session-token` header — the app's own header;
 * 2. `authorization: Bearer …` — kept for older clients;
 * 3. `?sm_session=…` — used while the app cannot prove that a header arrives (some proxies strip
 *    `Authorization`; the app checks with GET /api/auth/transport);
 * 4. the `sm_session` cookie — the normal case in a browser tab;
 * 5. the `sm_token` cookie — the partitioned cookie the page sets itself in an embedded page, so a
 *    proxy that mangles headers and addresses still cannot end the sign-in.
 *
 * Returns `{ token, via }`, `via` being the channel that supplied the token (null when there is none).
 */
export function readSessionToken(req) {
  const header = readSessionHeader(req);
  if (header) return { token: header, via: 'x-session-token' };
  const bearer = readBearer(req);
  if (bearer) return { token: bearer, via: 'authorization' };
  const query = readSessionQuery(req);
  if (query) return { token: query, via: 'query' };
  const cookie = readCookie(req, SESSION_COOKIE) ?? readCookie(req, SESSION_COOKIE_CLIENT);
  return cookie ? { token: cookie, via: 'cookie' } : { token: null, via: null };
}

/** Which credential channels the request carried (used for the app's diagnostics). */
export function sessionChannels(req) {
  const channels = [];
  if (readSessionHeader(req)) channels.push('x-session-token');
  if (readBearer(req)) channels.push('authorization');
  if (readSessionQuery(req)) channels.push('query');
  if (readCookie(req, SESSION_COOKIE) || readCookie(req, SESSION_COOKIE_CLIENT)) channels.push('cookie');
  return channels;
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
 * True when the app is shown inside another site — the browser blocks its cookies there.
 * The app says so itself (`x-sm-embedded`, or `?embedded=1` where a proxy drops headers);
 * operators can also force it either way with COOKIE_SAMESITE.
 */
export function isEmbeddedRequest(req) {
  const forced = (process.env.COOKIE_SAMESITE ?? '').trim().toLowerCase();
  if (forced === 'none') return true;
  if (forced === 'lax' || forced === 'strict') return false;
  return req.get('x-sm-embedded') === '1' || req.query?.embedded === '1';
}

/**
 * Cookie options. A plain `SameSite=none` cookie is refused by browsers that block third-party
 * cookies (Chrome 120+, and all of Chrome 155); a **partitioned** one (CHIPS) is kept, which is why
 * the embedded cookie is `sameSite: none; secure; partitioned`. `Secure` is required by both — the
 * preview is served over HTTPS, so it works; over plain HTTP the browser drops the cookie and the
 * app falls back to sending the session token in a header.
 */
function cookieOptions(req) {
  return isEmbeddedRequest(req)
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
