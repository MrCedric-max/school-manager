import { clearStoredToken, isEmbedded, readStoredToken, storeToken } from './session';

export { isEmbedded } from './session';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
}

/** Our own header: proxies give `Authorization` a meaning of their own, this one they pass through. */
const TOKEN_HEADER = 'X-Session-Token';
/** Last resort, used only when the probe below shows that headers do not reach the server. */
const TOKEN_QUERY = 'sm_session';

export type SessionTransport = 'header' | 'query';

/**
 * Session token handed out at sign-in. The server also sets a cookie, but browsers refuse third-party
 * cookies when the app is shown inside another site (e.g. a preview panel), so every request also
 * carries the token in the query string — and in a header once the transport check proves one arrives
 * (see ensureSessionTransport). Where it is kept between loads: lib/session.ts.
 */
let sessionToken: string | null = readStoredToken();
/** True only once the probe below has *proved* that one of our headers reaches the server. */
let headerProven = false;
let transportChecked = false;
let transportCheck: Promise<SessionTransport> | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (token) storeToken(token);
  else clearStoredToken();
}

export function hasSessionToken() {
  return sessionToken !== null;
}

/**
 * Where the session token travels right now — shown in Settings next to the other diagnostics.
 *
 * In a plain tab: the cookie plus our headers, never the address. Embedded in another site (where
 * browsers drop the cookie) the address is the safe default — a proxy forwards it whatever it does
 * with headers — and the app moves to the header as soon as the probe below proves it arrives.
 */
export function sessionTransport(): SessionTransport {
  return isEmbedded() && !headerProven ? 'query' : 'header';
}

/** Give up on the header channel (the server did not recognise the token we sent in it). */
export function preferQueryTransport() {
  headerProven = false;
}

/**
 * Find the channel that actually reaches the server, and remember it for this page.
 *
 * A preview panel serves the app through a proxy, and such a proxy may rewrite or drop the headers
 * we set (a common one is `Authorization`, which proxies like to use for themselves). So the app asks
 * the server: it sends the same random value in the `X-Session-Token` header, in `Authorization` and
 * in the query string, and the server answers which of them arrived. Any answer but "a header
 * arrived" — including no answer at all — leaves the session token in the address, so a sign-in can
 * never depend on this check succeeding. Inside a normal tab nothing is sent.
 */
export function ensureSessionTransport(): Promise<SessionTransport> {
  if (transportChecked) return Promise.resolve(sessionTransport());
  transportCheck ??= (async () => {
    try {
      if (isEmbedded()) {
        const probe = crypto.randomUUID();
        const res = await fetch(`/api/auth/transport?probe=${probe}`, {
          headers: { [TOKEN_HEADER]: probe, Authorization: `Bearer ${probe}` },
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await readJson(res)) as {
          channels?: { sessionHeader?: boolean; authorization?: boolean } | null;
        } | null;
        headerProven = Boolean(data?.channels?.sessionHeader || data?.channels?.authorization);
      }
    } catch {
      headerProven = false; // no answer: keep carrying the token in the address
    }
    transportChecked = true;
    return sessionTransport();
  })();
  return transportCheck;
}

async function readJson(res: Response) {
  return res.headers.get('content-type')?.includes('application/json') ? res.json().catch(() => null) : null;
}

/** URL of an API call: the session token is added to the query only where headers do not arrive. */
function apiUrl(path: string) {
  const url = `/api${path}`;
  if (!sessionToken || sessionTransport() !== 'query') return url;
  return `${url}${url.includes('?') ? '&' : '?'}${TOKEN_QUERY}=${encodeURIComponent(sessionToken)}`;
}

async function send(path: string, { method = 'GET', body, form }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (method !== 'GET') headers['X-Requested-With'] = 'SchoolManager';
  // Tells the server we are embedded, so it sets a partitioned cookie (kept by Chrome where plain
  // third-party cookies are dropped).
  if (isEmbedded()) headers['X-Sm-Embedded'] = '1';
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
    headers[TOKEN_HEADER] = sessionToken;
  }
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { method, headers, body: payload, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Cannot reach the server — check your connection');
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setSessionToken(null);
    window.dispatchEvent(new Event('sm:unauthorized'));
  }
  if (!res.ok) {
    const data = await readJson(res);
    throw new ApiError(res.status, data?.error ?? res.statusText, data?.details);
  }
  return res;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  const data = await readJson(res);
  // Account creation, sign-in and password change hand out a new session token.
  if (path.startsWith('/auth/') && typeof data?.token === 'string') setSessionToken(data.token);
  return data as T;
}

/** Download a file from the API (with the session credentials) under the name chosen by the server. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await send(path);
  const blob = await res.blob();
  const name = /filename="?([^";]+)"?/i.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};

export function qs(params: Record<string, string | number | null | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
  return s.toString();
}
