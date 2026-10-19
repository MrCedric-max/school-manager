// The transport check is an optimisation, never a requirement: when the probe cannot get through (or
// is blocked by the proxy), the app must still keep the session token in the address — the channel a
// proxy cannot drop — instead of quietly falling back to a header that may never arrive.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installFetch, installWindow, lastRequest, startPreviewProxy } from './helpers.mjs';

let app;
let api;

before(async () => {
  installWindow({ embedded: true });
  // Worst case: the headers are dropped and the transport check gets no answer either.
  app = await startPreviewProxy({ drop: ['authorization', 'cookie', 'x-session-token'], failProbe: true });
  installFetch(app.url);
  api = await import('../src/lib/api.ts');
});

after(() => app.server.close());

test('embedded: a probe that never gets through leaves the token in the address', async () => {
  assert.equal(await api.ensureSessionTransport(), 'query');
  assert.equal(api.sessionTransport(), 'query');

  await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  api.setSessionToken('P'.repeat(43));

  const status = await api.api.get('/auth/status');
  assert.equal(status.user.username, 'demo', 'signing in must not depend on the probe');
  assert.equal(status.session.via, 'query');
  assert.equal(lastRequest(app).search, `?sm_session=${'P'.repeat(43)}`);
});
