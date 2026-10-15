// Test harness for the client's session transport: a stub of the app seen through a preview proxy.
import http from 'node:http';

/**
 * sessionStorage / localStorage stand-ins, plus the iframe check, the cookie jar and the address the
 * app can rewrite — everything a browser gives the app, with the parts a preview panel can take away.
 */
export function installWindow({ embedded = false, storageBlocked = false, cookiesWork = true } = {}) {
  const storage = () => {
    const map = new Map();
    if (storageBlocked) {
      const blocked = () => {
        throw new Error('storage is blocked in this frame');
      };
      return { getItem: blocked, setItem: blocked, removeItem: blocked };
    }
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => void map.set(key, String(value)),
      removeItem: (key) => void map.delete(key),
    };
  };

  // A minimal cookie jar: `document.cookie = 'name=value; …'` stores (unless the browser refuses the
  // cookie), `Max-Age=0` deletes, and reading gives back what was kept.
  const jar = new Map();
  const document = {
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(input) {
      const [pair, ...attributes] = String(input).split(';').map((part) => part.trim());
      const eq = pair.indexOf('=');
      if (eq === -1) return;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const refused = !cookiesWork || attributes.some((a) => /^Partitioned$/i.test(a) && !cookiesWork);
      if (/max-age=0/i.test(attributes.join(';'))) jar.delete(name);
      else if (!refused) jar.set(name, value);
    },
  };

  const location = { href: 'http://app/', search: '' };
  const history = {
    state: null,
    replaceState(_state, _title, url) {
      const parsed = new URL(String(url), location.href);
      location.href = parsed.href;
      location.search = parsed.search;
    },
  };

  const self = { name: 'school-manager' };
  globalThis.window = { self, top: embedded ? { name: 'preview panel' } : self, sessionStorage: storage(), localStorage: storage() };
  globalThis.document = document;
  globalThis.location = location;
  globalThis.history = history;
  return { document, location };
}

/** `fetch` with relative URLs resolved against the stub server, like a browser resolves them. */
export function installFetch(base) {
  const real = globalThis.fetch;
  globalThis.fetch = (input, init) => real(new URL(String(input), base), init);
}

/**
 * Stub of the app behind the preview proxy. `drop` lists the headers the proxy removes on the way in
 * (a real proxy keeps the address and the CSRF header, but may rewrite or drop the rest).
 */
export function startPreviewProxy({ drop = [], failProbe = false } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://app');
    const headers = { ...req.headers };
    for (const name of drop) delete headers[name];
    requests.push({ path: url.pathname, search: url.search, headers });
    if (failProbe && url.pathname === '/api/auth/transport') {
      req.destroy(); // the probe never gets an answer: the app must not depend on it
      return;
    }
    const send = (body) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/auth/transport') {
      const probe = url.searchParams.get('probe');
      send({
        probe: Boolean(probe),
        channels: probe
          ? {
              sessionHeader: headers['x-session-token'] === probe,
              authorization: headers.authorization === `Bearer ${probe}`,
              query: true,
            }
          : null,
      });
      return;
    }

    if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/setup') {
      send({ user: { id: 1, username: 'demo' }, token: 'T'.repeat(43) });
      return;
    }

    const bearer = (headers.authorization ?? '').replace(/^Bearer /, '');
    const token = headers['x-session-token'] || bearer || url.searchParams.get('sm_session') || null;
    const channels = [];
    if (headers['x-session-token']) channels.push('x-session-token');
    if (headers.authorization) channels.push('authorization');
    if (url.searchParams.get('sm_session')) channels.push('query');
    if (headers.cookie) channels.push('cookie');
    send({
      user: token ? { id: 1, username: 'demo', demo: true } : null,
      session: { via: token ? channels[0] ?? null : null, channels, cookie: Boolean(headers.cookie), embedded: headers['x-sm-embedded'] === '1' },
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, requests }));
  });
}

/** The last request the proxy saw. */
export const lastRequest = (app) => app.requests[app.requests.length - 1];
