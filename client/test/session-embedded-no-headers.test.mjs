// Worst case: the proxy in front of the embedded app drops every header we can set. The probe then
// says so and the session token travels in the address of each API call — the one channel such a
// proxy still forwards.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installFetch, installWindow, lastRequest, startPreviewProxy } from './helpers.mjs';

let app;
let api;

before(async () => {
  installWindow({ embedded: true });
  app = await startPreviewProxy({ drop: ['authorization', 'cookie', 'x-session-token'] });
  installFetch(app.url);
  api = await import('../src/lib/api.ts');
});

after(() => app.server.close());

test('embedded with every session header dropped: the token travels in the address', async () => {
  assert.equal(await api.ensureSessionTransport(), 'query');
  assert.equal(api.sessionTransport(), 'query');

  await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  api.setSessionToken('Q'.repeat(43));

  const status = await api.api.get('/auth/status');
  assert.equal(status.user.username, 'demo');
  assert.equal(status.session.via, 'query');

  const request = lastRequest(app);
  assert.equal(request.search, `?sm_session=${'Q'.repeat(43)}`);
  assert.equal(request.headers['x-requested-with'], undefined, 'the proxy drops that too — GETs still work');
  assert.equal(request.headers['x-session-token'], undefined);
});
