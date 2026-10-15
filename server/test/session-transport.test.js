// Sign-in when the browser refuses the session cookie: inside a preview panel the app is shown in an
// iframe on another site (so Chrome drops third-party cookies) and behind a proxy that may rewrite or
// drop the headers it does not need. These tests cover every channel the session token can travel in,
// and simulate a preview proxy to make sure signing in still works there.
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { getDb, openDatabase } from '../src/db/index.js';
import { syncDemoAccount } from '../src/services/demo-login.js';

process.env.SCHOOL_TODAY = '2026-10-14';
process.env.DEMO_LOGIN = '1';

const DEMO = { username: 'demo', password: 'demo2026' };

let server;
let base;

async function call(path, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };
  if (method !== 'GET') init.headers['x-requested-with'] = 'SchoolManager';
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data, res };
}

before(async () => {
  openDatabase(':memory:');
  getDb().prepare("UPDATE settings SET value = '1' WHERE key = 'demo_mode'").run();
  syncDemoAccount(getDb());
  const app = createApp({ clientDist: '/nonexistent' });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  delete process.env.DEMO_LOGIN;
});

/**
 * Stand-in for the preview proxy the app is served through: it forwards the request to the app but
 * drops the headers such a proxy is likely to keep for itself or to strip.
 */
function startStrippingProxy({ drop }) {
  const target = new URL(base);
  const proxy = http.createServer((req, res) => {
    const headers = { ...req.headers };
    for (const name of drop) delete headers[name];
    const upstream = http.request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers }, (answer) => {
      res.writeHead(answer.statusCode, answer.headers);
      answer.pipe(res);
    });
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  });
  return new Promise((resolve) => {
    proxy.listen(0, '127.0.0.1', () => resolve({ proxy, url: `http://127.0.0.1:${proxy.address().port}` }));
  });
}

async function through(url, path, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };
  if (method !== 'GET') init.headers['x-requested-with'] = 'SchoolManager';
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url + path, init);
  return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() : null, res };
}

const signIn = async (options) => {
  const r = await (options?.url ? through(options.url, '/api/auth/login', { method: 'POST', body: DEMO }) : call('/api/auth/login', { method: 'POST', body: DEMO }));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
};

test('the session token is accepted from every channel the app can use', async () => {
  const token = await signIn();

  const withHeader = await call('/api/auth/status', { headers: { 'x-session-token': token } });
  assert.equal(withHeader.data.user?.username, 'demo');
  assert.equal(withHeader.data.session.via, 'x-session-token');

  const withBearer = await call('/api/auth/status', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(withBearer.data.user?.username, 'demo');
  assert.equal(withBearer.data.session.via, 'authorization');

  const withQuery = await call(`/api/auth/status?sm_session=${token}`);
  assert.equal(withQuery.data.user?.username, 'demo');
  assert.equal(withQuery.data.session.via, 'query');

  const withCookie = await call('/api/auth/status', { headers: { cookie: `sm_session=${token}` } });
  assert.equal(withCookie.data.user?.username, 'demo');
  assert.equal(withCookie.data.session.via, 'cookie');

  // The app's own header wins over the others (a stale cookie must not override a fresh token).
  const mixed = await call(`/api/auth/status?sm_session=${'x'.repeat(43)}`, {
    headers: { 'x-session-token': token, cookie: `sm_session=${'y'.repeat(43)}` },
  });
  assert.equal(mixed.data.user?.username, 'demo');
});

test('a token that is not a real session is refused in every channel', async () => {
  const fake = 'z'.repeat(43);
  for (const headers of [{ 'x-session-token': fake }, { authorization: `Bearer ${fake}` }, { cookie: `sm_session=${fake}` }]) {
    const r = await call('/api/meta', { headers });
    assert.equal(r.status, 401);
  }
  assert.equal((await call(`/api/meta?sm_session=${fake}`)).status, 401);
  // A token of the wrong shape is ignored rather than looked up.
  assert.equal((await call('/api/meta?sm_session=short')).status, 401);
  assert.equal((await call('/api/meta', { headers: { 'x-session-token': 'not a token' } })).status, 401);
});

test('signing out ends the session whichever channel carried it', async () => {
  const token = await signIn();
  const out = await call(`/api/auth/logout?sm_session=${token}`, { method: 'POST' });
  assert.equal(out.status, 200);
  assert.equal((await call(`/api/auth/status?sm_session=${token}`)).data.user, null);
});

test('the app can ask which channels reach the server', async () => {
  const probe = randomUUID();
  const r = await call(`/api/auth/transport?probe=${probe}`, {
    headers: { 'x-session-token': probe, authorization: `Bearer ${probe}` },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.channels, { sessionHeader: true, authorization: true, query: true });

  // Only what really arrived is reported.
  const headerOnly = await call(`/api/auth/transport?probe=${probe}`, { headers: { 'x-session-token': probe } });
  assert.deepEqual(headerOnly.data.channels, { sessionHeader: true, authorization: false, query: true });

  // Without a probe there is nothing to report (and nothing to guess).
  assert.equal((await call('/api/auth/transport')).data.channels, null);
  assert.equal((await call('/api/auth/transport?probe=short')).data.channels, null);
});

test('the embedded app asks for a partitioned cookie (kept where third-party cookies are blocked)', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'SchoolManager', 'x-sm-embedded': '1' },
    body: JSON.stringify(DEMO),
  });
  const cookie = res.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^sm_session=/);
  assert.match(cookie, /SameSite=None/i);
  assert.match(cookie, /Partitioned/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /HttpOnly/i);
  await res.text();

  // In a normal browser tab the cookie stays SameSite=Lax (no Secure over plain HTTP).
  const plain = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'SchoolManager' },
    body: JSON.stringify(DEMO),
  });
  assert.match(plain.headers.get('set-cookie') ?? '', /SameSite=Lax/i);
  await plain.text();

  // The query parameter `embedded=1` says the same thing where headers do not arrive.
  const byQuery = await fetch(`${base}/api/auth/login?embedded=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'SchoolManager' },
    body: JSON.stringify(DEMO),
  });
  assert.match(byQuery.headers.get('set-cookie') ?? '', /Partitioned/i);
  await byQuery.text();
});

test('API answers are never cached (a stale status would bounce a signed-in user)', async () => {
  assert.equal((await call('/api/auth/status')).res.headers.get('cache-control'), 'no-store');
});

// The reported bug: the preview panel is an iframe on another site (the browser drops the cookie) and
// the proxy in front of the app drops `Authorization`, so the token never reached the server.
test('preview proxy that drops Authorization: the old header-only client fails, the app signs in anyway', async () => {
  const { proxy, url } = await startStrippingProxy({ drop: ['authorization'] });
  try {
    const token = await signIn({ url });

    // What the app used to do: send the token in Authorization and hope for the best.
    const before = await through(url, '/api/auth/status', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(before.data.user, null, 'Authorization does not reach the app behind such a proxy');
    assert.deepEqual(before.data.session.channels, []);

    // What the app does now: ask first, then use a channel that arrives.
    const probe = randomUUID();
    const probeAnswer = await through(url, `/api/auth/transport?probe=${probe}`, {
      headers: { 'x-session-token': probe, authorization: `Bearer ${probe}` },
    });
    assert.deepEqual(probeAnswer.data.channels, { sessionHeader: true, authorization: false, query: true });

    const after = await through(url, '/api/auth/status', { headers: { 'x-session-token': token } });
    assert.equal(after.data.user.username, 'demo');
    assert.equal(after.data.session.via, 'x-session-token');
    assert.equal(after.data.session.cookie, false, 'the proxy drops cookies too, the token is the session');

    // The token also works for a state-changing call, so the app is fully usable behind the proxy.
    const write = await through(url, '/api/settings', {
      method: 'PUT',
      headers: { 'x-session-token': token },
      body: { schoolName: 'PREVIEW TEST' },
    });
    assert.equal(write.status, 200, JSON.stringify(write.data));
    assert.equal((await through(url, '/api/meta', { headers: { 'x-session-token': token } })).data.settings.schoolName, 'PREVIEW TEST');
    // Without the token the same call is refused.
    assert.equal((await through(url, '/api/settings', { method: 'PUT', body: { schoolName: 'NO' } })).status, 401);
  } finally {
    proxy.close();
  }
});

test('preview proxy that drops every header: the token travels in the address', async () => {
  const { proxy, url } = await startStrippingProxy({ drop: ['authorization', 'cookie', 'x-session-token'] });
  try {
    const token = await signIn({ url });

    // The probe tells the app that no header arrives — only the query string does.
    const probe = randomUUID();
    const probeAnswer = await through(url, `/api/auth/transport?probe=${probe}`, {
      headers: { 'x-session-token': probe, authorization: `Bearer ${probe}` },
    });
    assert.deepEqual(probeAnswer.data.channels, { sessionHeader: false, authorization: false, query: true });

    const status = await through(url, `/api/auth/status?sm_session=${token}`);
    assert.equal(status.data.user.username, 'demo');
    assert.equal(status.data.session.via, 'query');
  } finally {
    proxy.close();
  }
});
