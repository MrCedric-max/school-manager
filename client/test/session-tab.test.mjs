// In a normal browser tab (not embedded) the app keeps the plain browser behaviour: cookies plus its
// headers, and no probing request.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installFetch, installWindow, lastRequest, startPreviewProxy } from './helpers.mjs';

let app;
let api;

before(async () => {
  installWindow({ embedded: false });
  app = await startPreviewProxy();
  installFetch(app.url);
  api = await import('../src/lib/api.ts');
});

after(() => app.server.close());

test('a tab that is not embedded does not probe and keeps using headers', async () => {
  assert.equal(api.isEmbedded(), false);
  assert.equal(await api.ensureSessionTransport(), 'header');
  assert.equal(app.requests.length, 0, 'nothing to check outside an iframe');

  api.setSessionToken('T'.repeat(43));
  const status = await api.api.get('/auth/status');
  assert.equal(status.session.via, 'x-session-token');
  assert.equal(status.session.cookie, false);

  const request = lastRequest(app);
  assert.equal(request.headers['x-session-token'], 'T'.repeat(43));
  assert.equal(request.headers.authorization, `Bearer ${'T'.repeat(43)}`);
  assert.equal(request.headers['x-sm-embedded'], undefined, 'a plain tab keeps the normal SameSite=Lax cookie');
  assert.equal(request.search, '', 'outside an iframe the token never goes into the address');
});
