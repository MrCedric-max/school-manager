import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { HttpError, badRequest } from '../lib/http.js';
import { backupToFile, restoreFromBuffer } from '../services/backup.js';
import { loadContext } from '../services/context.js';
import { generateDemoData } from '../services/demo.js';
import { commitImport, parseWorkbook, summarize } from '../services/importer.js';

export const adminRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
});

// Parsed workbooks waiting for confirmation (kept 30 minutes in memory).
const pendingImports = new Map();
function cleanupImports() {
  const limit = Date.now() - 30 * 60_000;
  for (const [id, entry] of pendingImports) if (entry.createdAt < limit) pendingImports.delete(id);
}

adminRouter.post('/import/preview', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose the School_Manager .xlsx file to import');
  if (!/\.xlsx$/i.test(req.file.originalname)) throw badRequest('Only .xlsx workbooks can be imported');
  let parsed;
  try {
    parsed = await parseWorkbook(req.file.buffer, getDb());
  } catch (e) {
    console.error('[import] parse failed', e);
    throw badRequest(
      `This file could not be read as an Excel workbook (${String(e?.message ?? e).slice(0, 160)}). ` +
        'Open it in Excel or Google Sheets and save/download it again as .xlsx, then retry.',
    );
  }
  cleanupImports();
  const id = crypto.randomUUID();
  pendingImports.set(id, { parsed, createdAt: Date.now(), fileName: req.file.originalname });
  const demoMode = getDb().prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get()?.value === '1';
  const existingPupils = getDb().prepare('SELECT COUNT(*) AS n FROM pupils').get().n;
  res.json({ importId: id, fileName: req.file.originalname, summary: summarize(parsed), demoMode, existingPupils });
});

adminRouter.post('/import/commit', (req, res) => {
  const entry = pendingImports.get(String(req.body?.importId ?? ''));
  if (!entry) throw new HttpError(410, 'This import has expired — please upload the file again');
  const db = getDb();
  const demoMode = db.prepare("SELECT value FROM settings WHERE key = 'demo_mode'").get()?.value === '1';
  // Never merge real pupils into demo data.
  const mode = demoMode ? 'replace' : req.body?.mode === 'merge' ? 'merge' : 'replace';
  const result = commitImport(db, entry.parsed, { mode });
  pendingImports.delete(String(req.body.importId));
  res.json({ mode, result });
});

adminRouter.get('/backup', async (req, res) => {
  const file = await backupToFile();
  const name = `school-manager-backup-${new Date().toISOString().slice(0, 10)}.db`;
  res.download(file, name, () => fs.rm(file, { force: true }, () => {}));
});

adminRouter.post('/restore', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose a backup file (.db)');
  const result = await restoreFromBuffer(req.file.buffer);
  res.json({ ok: true, ...result });
});

adminRouter.post('/demo', (req, res) => {
  const db = getDb();
  try {
    res.json(generateDemoData(db, loadContext(db)));
  } catch (e) {
    throw new HttpError(409, e.message);
  }
});

/** Delete every pupil and all their records (calendar, classes and settings are kept). */
adminRouter.post('/data/reset', (req, res) => {
  if (req.body?.confirm !== 'DELETE') throw badRequest('Type DELETE to confirm');
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM pupils').run();
    db.prepare("UPDATE settings SET value = '0' WHERE key = 'demo_mode'").run();
  })();
  res.json({ ok: true });
});
