import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations.js';
import { seedDefaults } from './seed.js';

let db = null;
let currentFile = null;

/** Open (or create) the SQLite database, run migrations and seed defaults. */
export function openDatabase(file) {
  if (db) db.close();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  currentFile = file;
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  seedDefaults(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database is not open');
  return db;
}

export function databaseFile() {
  return currentFile;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/** Run `fn` inside a transaction (all-or-nothing). */
export function transaction(fn) {
  return getDb().transaction(fn)();
}
