// Public demo sign-in (DEMO_LOGIN=1): shown on the sign-in page, only while the data is invented.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { getDb, openDatabase } from '../src/db/index.js';
import { syncDemoAccount } from '../src/services/demo-login.js';
import { buildFixtureWorkbook } from './fixtures/build-workbook.js';

process.env.SCHOOL_TODAY = '2026-10-14';

let server;
let base;

async function call(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (method !== 'GET') headers['x-requested-with'] = 'SchoolManager';
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
}

const setDemoData = (on) => getDb().prepare("UPDATE settings SET value = ? WHERE key = 'demo_mode'").run(on ? '1' : '0');
const demoAccounts = () => getDb().prepare('SELECT username FROM users WHERE is_demo = 1').all();
const DEMO = { username: 'demo', password: 'demo2026' };

before(async () => {
  openDatabase(':memory:');
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

test('demo sign-in stays off unless DEMO_LOGIN is set and the data is invented', async () => {
  delete process.env.DEMO_LOGIN;
  setDemoData(true);
  assert.equal(syncDemoAccount(getDb()), null);
  process.env.DEMO_LOGIN = '1';
  setDemoData(false);
  assert.equal(syncDemoAccount(getDb()), null);
  assert.deepEqual(demoAccounts(), []);
  assert.equal((await call('/api/auth/status')).data.demo, null);
});

let demoToken;

test('with demo data the account is created, shown on the sign-in page and can sign in', async () => {
  process.env.DEMO_LOGIN = '1';
  setDemoData(true);
  assert.deepEqual(syncDemoAccount(getDb()), DEMO);
  let r = await call('/api/auth/status');
  assert.deepEqual(r.data.demo, DEMO);
  assert.equal(r.data.setupRequired, true, 'the demo account is not an administrator');
  r = await call('/api/auth/login', { method: 'POST', body: DEMO });
  assert.equal(r.status, 200);
  demoToken = r.data.token;
  r = await call('/api/auth/status', { token: demoToken });
  assert.equal(r.data.user.username, 'demo');
  assert.equal(r.data.user.demo, true);
  assert.equal((await call('/api/meta', { token: demoToken })).status, 200);
  assert.equal((await call('/api/pupils', { token: demoToken })).status, 200);
});

test('the demo account cannot reach backups, imports, restore, reset or its password', async () => {
  const file = () => {
    const form = new FormData();
    form.append('file', new Blob(['not a real file']), 'file.db');
    return form;
  };
  const blocked = [
    ['/api/backup', {}],
    ['/api/import/preview', { method: 'POST', body: file() }],
    ['/api/import/commit', { method: 'POST', body: { importId: 'x' } }],
    ['/api/restore', { method: 'POST', body: file() }],
    ['/api/data/reset', { method: 'POST', body: { confirm: 'DELETE' } }],
    ['/api/auth/password', { method: 'POST', body: { currentPassword: DEMO.password, newPassword: 'changed-pass-1' } }],
  ];
  for (const [path, options] of blocked) {
    const r = await call(path, { ...options, token: demoToken });
    assert.equal(r.status, 403, path);
    assert.match(r.data.error, /demo account/);
  }
});

let adminToken;

test('a real administrator can still be created, but not with the demo username', async () => {
  let r = await call('/api/auth/setup', { method: 'POST', body: { username: 'DEMO', password: 'school-2026!' } });
  assert.equal(r.status, 409);
  r = await call('/api/auth/setup', { method: 'POST', body: { username: 'admin', password: 'school-2026!' } });
  assert.equal(r.status, 201);
  adminToken = r.data.token;
  r = await call('/api/auth/status');
  assert.equal(r.data.setupRequired, false);
  assert.deepEqual(r.data.demo, DEMO, 'demo sign-in is still offered next to the real account');
});

test('importing real pupils deletes the demo account and ends its sessions', async () => {
  const form = new FormData();
  form.append('file', new Blob([await buildFixtureWorkbook()]), 'School_Manager.xlsx');
  let r = await call('/api/import/preview', { token: adminToken, method: 'POST', body: form });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('/api/import/commit', { token: adminToken, method: 'POST', body: { importId: r.data.importId } });
  assert.equal(r.status, 200);

  assert.deepEqual(demoAccounts(), []);
  assert.equal((await call('/api/auth/status')).data.demo, null);
  assert.equal((await call('/api/meta', { token: demoToken })).status, 401, 'demo sessions are ended');
  assert.equal((await call('/api/auth/login', { method: 'POST', body: DEMO })).status, 401);
  assert.equal(syncDemoAccount(getDb()), null, 'not re-created at the next start while the data is real');
  assert.equal((await call('/api/meta', { token: adminToken })).status, 200);
});

test('a demo username that belongs to a real account turns demo sign-in off', async () => {
  setDemoData(true);
  process.env.DEMO_USERNAME = 'admin';
  try {
    assert.equal(syncDemoAccount(getDb()), null);
    assert.equal((await call('/api/auth/status')).data.demo, null);
    assert.equal((await call('/api/meta', { token: adminToken })).status, 200, 'the real account is untouched');
  } finally {
    delete process.env.DEMO_USERNAME;
    setDemoData(false);
  }
});
