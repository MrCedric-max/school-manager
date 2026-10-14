import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { closeDatabase, databaseFile, getDb, openDatabase } from '../db/index.js';
import { migrations } from '../db/migrations.js';
import { badRequest } from '../lib/http.js';

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Write a consistent copy of the live database to a temporary file. */
export async function backupToFile() {
  const target = path.join(os.tmpdir(), `school-manager-backup-${stamp()}-${process.pid}.db`);
  await getDb().backup(target);
  return target;
}

/** Replace the live database with an uploaded backup (after a safety copy). */
export async function restoreFromBuffer(buffer) {
  if (!buffer || buffer.length < 100 || !buffer.subarray(0, 16).equals(SQLITE_HEADER)) {
    throw badRequest('This file is not a School Manager backup (.db)');
  }
  const file = databaseFile();
  if (!file || file === ':memory:') throw badRequest('Restore is not available for in-memory databases');

  const temp = path.join(os.tmpdir(), `school-manager-restore-${stamp()}-${process.pid}.db`);
  fs.writeFileSync(temp, buffer);
  try {
    const probe = new Database(temp, { readonly: true, fileMustExist: true });
    try {
      const version = probe.pragma('user_version', { simple: true });
      const hasPupils = probe.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'pupils'").get();
      if (!hasPupils || version < 1 || version > migrations.length) throw badRequest('This backup does not come from School Manager');
      const integrity = probe.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') throw badRequest('The backup file is damaged');
    } finally {
      probe.close();
    }

    const backupsDir = path.join(path.dirname(file), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const safety = path.join(backupsDir, `before-restore-${stamp()}.db`);
    await getDb().backup(safety);

    closeDatabase();
    try {
      for (const suffix of ['-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
      fs.copyFileSync(temp, file);
      openDatabase(file);
    } catch (err) {
      // Put the previous database back if anything went wrong.
      fs.copyFileSync(safety, file);
      openDatabase(file);
      throw err;
    }
    return { safetyCopy: path.basename(safety) };
  } finally {
    fs.rmSync(temp, { force: true });
  }
}
