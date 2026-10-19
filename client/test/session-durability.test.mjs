// A sign-in has to survive a reload of the embedded page too — and a preview panel can take away
// everything the app normally keeps it in (this tab's storage, cookies). The token then has to be
// somewhere the next load can still read it.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installFetch, installWindow, startPreviewProxy } from './helpers.mjs';

const TOKEN = 'D'.repeat(43);
let app;

before(async () => {
  app = await startPreviewProxy({ drop: ['cookie'] });
  installFetch(app.url);
});

after(() => app.server.close());

test('embedded with no storage: the app keeps the sign-in in a cookie of its own', async () => {
  const { document, location } = installWindow({ embedded: true, storageBlocked: true });
  const api = await import('../src/lib/api.ts');

  await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  api.setSessionToken(TOKEN);
  assert.match(document.cookie, /(^|; )sm_token=D{43}/, 'a partitioned cookie the page can read back');
  assert.equal(location.search, '', 'while a cookie comes back, the address stays clean');

  // Reload: a fresh copy of the module, same browser (storage, cookie jar and address are kept).
  const reloaded = await import('../src/lib/api.ts?reload=cookie');
  assert.equal(reloaded.hasSessionToken(), true);
  assert.equal((await reloaded.api.get('/auth/status')).user.username, 'demo');
});

test('embedded with no storage and no cookie: the token stays in the address', async () => {
  const { location } = installWindow({ embedded: true, storageBlocked: true, cookiesWork: false });
  const api = await import('../src/lib/api.ts?noStorage');

  await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  api.setSessionToken(TOKEN);
  assert.equal(location.search, `?sm_session=${TOKEN}`, 'the address is the only channel left');

  const reloaded = await import('../src/lib/api.ts?reload=address');
  assert.equal(reloaded.hasSessionToken(), true);
  assert.equal((await reloaded.api.get('/auth/status')).user.username, 'demo');

  // Signing out clears every copy.
  reloaded.setSessionToken(null);
  assert.equal(location.search, '');
  assert.equal((await import('../src/lib/api.ts?reload=signed-out')).hasSessionToken(), false);
});

test('a plain browser tab keeps the token in its own tab storage only', async () => {
  const { document, location } = installWindow({ embedded: false });
  const api = await import('../src/lib/api.ts?tab');

  await api.api.post('/auth/login', { username: 'demo', password: 'demo2026' });
  api.setSessionToken(TOKEN);
  assert.equal(document.cookie, '', 'no cookie of our own in a normal tab (the server sets an httpOnly one)');
  assert.equal(location.search, '', 'and never a token in the address');

  const reloaded = await import('../src/lib/api.ts?reload=tab');
  assert.equal(reloaded.hasSessionToken(), true, 'the tab storage is enough here');
});
