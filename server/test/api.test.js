import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/index.js';
import { buildFixtureWorkbook } from './fixtures/build-workbook.js';

let server;
let base;
let cookie = '';

process.env.SCHOOL_TODAY = '2026-10-14';

async function api(path, { method = 'GET', body, headers = {}, raw = false, csrf = true } = {}) {
  const init = { method, headers: { ...headers } };
  if (cookie) init.headers.cookie = cookie;
  if (csrf && method !== 'GET') init.headers['x-requested-with'] = 'SchoolManager';
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (raw) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

before(async () => {
  openDatabase(':memory:');
  const app = createApp({ clientDist: '/nonexistent' });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('first run: setup creates the admin and signs in', async () => {
  let r = await api('/api/auth/status');
  assert.equal(r.data.setupRequired, true);
  r = await api('/api/meta');
  assert.equal(r.status, 401);
  r = await api('/api/auth/setup', { method: 'POST', body: { username: 'admin', password: 'short' } });
  assert.equal(r.status, 400);
  r = await api('/api/auth/setup', { method: 'POST', body: { username: 'admin', password: 'azobe-2026!' } });
  assert.equal(r.status, 201);
  assert.match(cookie, /^sm_session=/);
  r = await api('/api/auth/setup', { method: 'POST', body: { username: 'other', password: 'something-long' } });
  assert.equal(r.status, 409);
});

test('state-changing requests need the CSRF header', async () => {
  const r = await api('/api/pupils', { method: 'POST', body: { classId: 1, fullName: 'X' }, csrf: false });
  assert.equal(r.status, 403);
});

test('meta describes the school year', async () => {
  const r = await api('/api/meta');
  assert.equal(r.status, 200);
  assert.equal(r.data.classes.length, 11);
  assert.equal(r.data.calendar.summary.schoolDays, 180);
  assert.deepEqual(r.data.selections, { week: 6, month: '2026-10', term: 1, uaMonth: '2026-10', date: '2026-10-14' });
  assert.equal(r.data.framework.totalMax, 280);
});

test('pupils: automatic IDs, validation and update', async () => {
  const ce2 = (await api('/api/meta')).data.classes.find((c) => c.code === 'CE2');
  let r = await api('/api/pupils', { method: 'POST', body: { classId: ce2.id, fullName: '  NEW   PUPIL ONE ', gender: 'F' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.pupil.student_id, 'CE2-01');
  assert.equal(r.data.pupil.full_name, 'NEW PUPIL ONE');
  r = await api('/api/pupils', { method: 'POST', body: { classId: ce2.id, fullName: 'NEW PUPIL TWO' } });
  assert.equal(r.data.pupil.student_id, 'CE2-02');
  r = await api(`/api/pupils/next-id?classId=${ce2.id}`);
  assert.equal(r.data.studentId, 'CE2-03');
  r = await api('/api/pupils', { method: 'POST', body: { classId: ce2.id, fullName: 'X', gender: 'Z' } });
  assert.equal(r.status, 400);
  r = await api('/api/pupils', { method: 'POST', body: { classId: ce2.id, fullName: 'DUP', studentId: 'CE2-01' } });
  assert.equal(r.status, 409);
});

test('roll call, controls and marks round-trip into the reports', async () => {
  const meta = (await api('/api/meta')).data;
  const ce2 = meta.classes.find((c) => c.code === 'CE2');
  const pupils = (await api(`/api/pupils?classId=${ce2.id}`)).data.pupils;
  const p1 = pupils[0].id;

  let r = await api('/api/attendance', { method: 'PUT', body: { changes: [{ pupilId: p1, date: '2026-10-12', mark: 'p' }] } });
  assert.equal(r.status, 200);
  r = await api('/api/attendance', { method: 'PUT', body: { changes: [{ pupilId: p1, date: '2026-10-11', mark: 'P' }] } });
  assert.equal(r.status, 400); // Sunday
  r = await api(`/api/attendance?classId=${ce2.id}&week=6`);
  assert.equal(r.data.marks[p1]['2026-10-12'], 'P');
  assert.equal(r.data.days.length, 5);

  r = await api('/api/controls', { method: 'PUT', body: { changes: [{ pupilId: p1, week: 6, subject: 'maths', value: '14,5' }] } });
  assert.equal(r.status, 200);
  r = await api('/api/controls', { method: 'PUT', body: { changes: [{ pupilId: p1, week: 6, subject: 'maths', value: 21 }] } });
  assert.equal(r.status, 400);

  r = await api('/api/marks', {
    method: 'PUT',
    body: {
      marks: [
        { pupilId: p1, month: '2026-10', discipline: '1A', value: 36 },
        { pupilId: p1, month: '2026-10', discipline: '1B', value: 30 },
      ],
      attitudes: [{ pupilId: p1, month: '2026-10', attitude: 'religion', grade: 'A' }],
    },
  });
  assert.equal(r.status, 200);
  r = await api('/api/marks', { method: 'PUT', body: { marks: [{ pupilId: p1, month: '2026-10', discipline: '1A', value: 41 }] } });
  assert.equal(r.status, 400);

  r = await api(`/api/reports/weekly?classId=${ce2.id}&week=6`);
  const row = r.data.rows.find((x) => x.pupilId === p1);
  assert.equal(row.controls.maths, 14.5);
  assert.equal(row.attendance.P, 1);

  r = await api(`/api/reports/monthly?classId=${ce2.id}&month=2026-10`);
  assert.equal(r.data.rows.find((x) => x.pupilId === p1).competences[1], 66);

  r = await api(`/api/cards/term?classId=${ce2.id}&term=1&pupilId=${p1}`);
  assert.equal(r.data.cards.length, 1);
  assert.equal(r.data.cards[0].attitudes[0].ua[0], 'A');

  r = await api('/api/remarks', { method: 'PUT', body: { pupilId: p1, period: 'M:2026-10', text: 'Très bien' } });
  assert.equal(r.status, 200);
  r = await api(`/api/cards/monthly?classId=${ce2.id}&month=2026-10&pupilId=${p1}`);
  assert.equal(r.data.cards[0].remarks, 'Très bien');

  r = await api('/api/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.data.perClass.find((c) => c.code === 'CE2').rollToday, 0);
});

test('workbook import: preview then commit', async () => {
  const form = new FormData();
  form.append('file', new Blob([await buildFixtureWorkbook()]), 'School_Manager.xlsx');
  let r = await api('/api/import/preview', { method: 'POST', body: form });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.summary.counts.pupils, 5);
  assert.equal(r.data.existingPupils, 2);
  r = await api('/api/import/commit', { method: 'POST', body: { importId: r.data.importId, mode: 'replace' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.result.pupils, 5);
  r = await api('/api/meta');
  assert.equal(r.data.settings.schoolName, 'ÉCOLE TEST');
  assert.deepEqual(r.data.classes.map((c) => c.code), ['SIL', 'CP', '6EME']);
  r = await api('/api/import/commit', { method: 'POST', body: { importId: 'expired' } });
  assert.equal(r.status, 410);
});

test('backup download is a SQLite file', async () => {
  const res = await api('/api/backup', { raw: true });
  assert.equal(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');
});

test('password change and logout', async () => {
  let r = await api('/api/auth/password', { method: 'POST', body: { currentPassword: 'wrong-password', newPassword: 'new-password-1' } });
  assert.equal(r.status, 400);
  r = await api('/api/auth/password', { method: 'POST', body: { currentPassword: 'azobe-2026!', newPassword: 'new-password-1' } });
  assert.equal(r.status, 200);
  r = await api('/api/auth/logout', { method: 'POST' });
  assert.equal(r.status, 200);
  cookie = '';
  r = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'azobe-2026!' } });
  assert.equal(r.status, 401);
  r = await api('/api/auth/login', { method: 'POST', body: { username: 'ADMIN', password: 'new-password-1' } });
  assert.equal(r.status, 200);
});

// Inside a preview panel (another site), browsers often refuse the session cookie.
// The app then sends the token returned at sign-in in an Authorization header instead.
test('sign-in also works without cookies (Authorization header)', async () => {
  const call = async (path, { token, method = 'GET', body } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (method !== 'GET') headers['x-requested-with'] = 'SchoolManager';
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data, res };
  };

  let r = await call('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'new-password-1' } });
  assert.equal(r.status, 200);
  const token = r.data.token;
  assert.match(token, /^[\w-]{40,}$/);
  assert.equal((await call('/api/auth/status', { token })).data.user.username, 'admin');
  assert.equal((await call('/api/meta', { token })).status, 200);
  assert.equal((await call('/api/meta')).status, 401);
  assert.equal((await call('/api/meta', { token: 'x'.repeat(43) })).status, 401);

  // The logo is public: <img> tags cannot send the header.
  assert.equal((await call('/api/logo')).status, 404);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  r = await call('/api/settings/logo', { token, method: 'PUT', body: { dataUrl: `data:image/png;base64,${png}` } });
  assert.equal(r.status, 200);
  r = await call('/api/logo');
  assert.equal(r.status, 200);
  assert.equal(r.res.headers.get('content-type'), 'image/png');
  assert.equal((await call('/api/settings/logo', { method: 'DELETE' })).status, 401, 'changing the logo still needs a session');

  // Password change returns a fresh token and ends the old sessions.
  r = await call('/api/auth/password', { token, method: 'POST', body: { currentPassword: 'new-password-1', newPassword: 'new-password-2' } });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/meta', { token })).status, 401);
  const fresh = r.data.token;
  assert.equal((await call('/api/meta', { token: fresh })).status, 200);

  // Sign-out ends the header session.
  assert.equal((await call('/api/auth/logout', { token: fresh, method: 'POST' })).status, 200);
  assert.equal((await call('/api/meta', { token: fresh })).status, 401);
});
