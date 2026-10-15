/**
 * Where the session token is kept between page loads.
 *
 * In a browser tab the token lives in `sessionStorage` (this tab only, gone when the browser closes).
 * Inside another site (a preview panel, a portal) browsers partition or block that storage, and they
 * refuse the app's httpOnly cookie, so the token is mirrored where it can still be read on the next
 * load — a partitioned cookie the page sets itself (`sm_token`; Chrome keeps a *partitioned* cookie
 * even where it drops third-party ones) and, when even that does not stick, the address of the page
 * (`?sm_session=…`, rewritten without adding a history entry). Nothing is mirrored in a plain tab.
 *
 * The token is the same secret the app already sends in a header or in the address of its API calls:
 * this only decides how it survives a reload.
 */
import { sessionStore } from './storage';

const STORAGE_KEY = 'sm.session';
const COOKIE_NAME = 'sm_token';
const QUERY_NAME = 'sm_session';
/** A session token: 32 random bytes as base64url (43 characters). */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

/** True when the app is displayed inside another page (preview panel, iframe on another site). */
export function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent: we cannot look, so assume the app is embedded
  }
}

function readCookie(name: string): string | null {
  try {
    for (const part of document.cookie.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
  } catch {
    // Cookies blocked: nothing to read.
  }
  return null;
}

/**
 * Write (or delete) a cookie this page can read back. `Partitioned` is what keeps it alive in an
 * iframe on another site; where the browser refuses it, the caller falls back to the address.
 */
function writeCookie(name: string, value: string | null) {
  try {
    const base = `${name}=${value ?? ''}; path=/; SameSite=None; Secure; Partitioned`;
    document.cookie = value === null ? `${base}; Max-Age=0` : base;
  } catch {
    return false;
  }
  return readCookie(name) === value;
}

function addressToken(): string | null {
  try {
    const value = new URLSearchParams(location.search).get(QUERY_NAME);
    return value && TOKEN_SHAPE.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Put the token in (or take it out of) the address without adding a history entry. */
function rewriteAddress(token: string | null) {
  try {
    const url = new URL(location.href);
    if (token) url.searchParams.set(QUERY_NAME, token);
    else url.searchParams.delete(QUERY_NAME);
    history.replaceState(history.state, '', url);
  } catch {
    // Sandboxed frame without history access: nothing else to do.
  }
}

/** The token this page starts with: this tab's storage, the page's own cookie, or the address. */
export function readStoredToken(): string | null {
  const stored = sessionStore.get(STORAGE_KEY);
  if (stored && TOKEN_SHAPE.test(stored)) return stored;
  const cookie = readCookie(COOKIE_NAME);
  if (cookie && TOKEN_SHAPE.test(cookie)) return cookie;
  return addressToken();
}

/**
 * Remember a freshly issued token. In an embedded page, mirrors it until one of the copies is
 * guaranteed to come back on the next load; when none is, the token stays in the address — the one
 * thing a reload, a proxy and a partitioned iframe all keep.
 */
export function storeToken(token: string) {
  sessionStore.set(STORAGE_KEY, token);
  if (!isEmbedded()) return;

  const inCookie = writeCookie(COOKIE_NAME, token);
  const inStorage = sessionStore.get(STORAGE_KEY) === token;
  if (inCookie || inStorage) rewriteAddress(null);
  else rewriteAddress(token);
}

export function clearStoredToken() {
  sessionStore.remove(STORAGE_KEY);
  writeCookie(COOKIE_NAME, null);
  rewriteAddress(null);
}
