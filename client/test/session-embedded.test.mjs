// The reported bug: the app runs in an iframe on another site (the browser drops the sm_session
// cookie) behind a proxy that drops `Authorization`, so a session handed out at sign-in never came
// back on the next request. The app now asks which channel arrives and signs in over that one.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installFetch, installWindow, lastRequest, startPreviewProxy } from './helpers.mjs';

let app;
let api;

before(async () => {
  installWindow({ embedded: true });
  app = await startPreviewProxy({ drop: ['authorization', 'cookie'] });
  installFetch(app.url);
  api = await import('../src/lib/api.ts');
});

after(() => app.server.close());

test('embedded: the app probes once and keeps the channel that arrives', async () => {
  assert.equal(api.isEmbedded(), true);
  assert.equal(await api.ensureSessionTransport(), 'header');
  const probe = app.requests[0];
  assert.equal(probe.path, '/api/auth/transport');
  assert.ok(probe.search.startsWith('?probe='), 'the probe carries a random value to be recognised');
  assert.ok(probe.headers['x-session-token'], 'the probe travels in the app’s own header too');

  // Asking again does not send another request.
  assert.equal(await api.ensureSessionTransport(), 'header');
  assert.equal(app.requests.length, 1);
});

test('embedded: signing in and using the app works although Authorization is dropped', async () => {
  const login = await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  assert.equal(login.token, 'T'.repeat(43));
  const loginRequest = lastRequest(app);
  assert.equal(loginRequest.headers['x-sm-embedded'], '1', 'the app tells the server it is embedded');
  assert.equal(loginRequest.headers.authorization, undefined, 'the proxy dropped Authorization on the way in');

  const status = await api.api.get('/auth/status');
  assert.equal(status.user.username, 'demo', 'the sign-in is kept — the old code showed the sign-in page again');
  assert.equal(status.session.via, 'x-session-token');

  const request = lastRequest(app);
  assert.equal(request.headers['x-session-token'], 'T'.repeat(43));
  assert.equal(request.search, '', 'the token stays out of the address while a header arrives');

  // A state-changing call carries the same credentials.
  await api.api.put('/settings', { schoolName: 'PREVIEW' });
  assert.equal(lastRequest(app).headers['x-requested-with'], 'SchoolManager');
  assert.equal(lastRequest(app).headers['x-session-token'], 'T'.repeat(43));
});

test('embedded: signing out clears the token', async () => {
  await api.api.post('/auth/logout');
  api.setSessionToken(null);
  const status = await api.api.get('/auth/status');
  assert.equal(status.user, null);
  assert.equal(lastRequest(app).headers['x-session-token'], undefined);
});
