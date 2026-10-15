import { sessionStore } from './storage';

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

const TOKEN_KEY = 'sm.session';

/**
 * Session token handed out at sign-in. The server also sets a cookie, but browsers often refuse
 * cookies when the app is shown inside another site (e.g. a preview panel), so every request also
 * carries the token in a header. Kept for this tab only, or in memory when storage is blocked.
 */
let sessionToken: string | null = sessionStore.get(TOKEN_KEY);

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (token) sessionStore.set(TOKEN_KEY, token);
  else sessionStore.remove(TOKEN_KEY);
}

async function readJson(res: Response) {
  return res.headers.get('content-type')?.includes('application/json') ? res.json().catch(() => null) : null;
}

async function send(path: string, { method = 'GET', body, form }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (method !== 'GET') headers['X-Requested-With'] = 'SchoolManager';
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
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

/** Download a file from the API (with the session header) under the name chosen by the server. */
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
