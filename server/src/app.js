import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { CSRF_HEADER } from './lib/auth.js';
import { HttpError, errorHandler } from './lib/http.js';
import { adminRouter } from './routes/admin.js';
import { authRouter, requireAuth, sessionMiddleware } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { entriesRouter } from './routes/entries.js';
import { metaRouter, sendLogo } from './routes/meta.js';
import { pupilsRouter } from './routes/pupils.js';
import { reportsRouter } from './routes/reports.js';

/**
 * Origins allowed to frame the app by default: the school's own pages, plus the sandbox preview
 * hosts used to show the app while it is being worked on (the preview panel embeds it in an iframe,
 * and without this the browser would refuse to display it). Override with FRAME_ANCESTORS.
 */
const PREVIEW_ANCESTORS = 'https://*.e2b.app https://*.arena.ai https://arena.ai';

function securityHeaders(req, res, next) {
  const frameAncestors = process.env.FRAME_ANCESTORS || `'self' ${PREVIEW_ANCESTORS}`;
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-ancestors ${frameAncestors}`,
    ].join('; '),
  });
  next();
}

/**
 * API answers are never cached: a stale `/api/auth/status` (or a proxy cache) would send a signed-in
 * user back to the sign-in page.
 */
function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

/** State-changing API calls must carry a custom header (blocks cross-site form posts). */
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get(CSRF_HEADER) !== 'SchoolManager') return next(new HttpError(403, 'Missing request header'));
  next();
}

export function createApp({ clientDist = config.clientDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders);

  app.use('/api', noStore);
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api', sessionMiddleware);
  app.use('/api', csrfGuard);
  app.use('/api/auth', authRouter);
  // The school logo is not secret (it is printed on every report card) and is loaded by <img> tags.
  app.get('/api/logo', sendLogo);

  app.use('/api', requireAuth);
  app.use('/api', metaRouter);
  app.use('/api/pupils', pupilsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api', entriesRouter);
  app.use('/api', reportsRouter);
  app.use('/api', adminRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use('/assets', express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '365d' }));
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api(\/|$)).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.type('text/plain').send('School Manager API is running. Build the interface with "npm run build" to serve it here.');
    });
  }

  app.use(errorHandler);
  return app;
}
