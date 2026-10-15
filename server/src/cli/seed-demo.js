// Fill an empty database with generated demo pupils and marks.
// Usage: npm run seed:demo [-- --until=2026-10-14]
import { databasePath } from '../config.js';
import { closeDatabase, openDatabase } from '../db/index.js';
import { loadContext } from '../services/context.js';
import { generateDemoData } from '../services/demo.js';
import { syncDemoAccount } from '../services/demo-login.js';

const untilArg = process.argv.find((a) => a.startsWith('--until='))?.slice(8);

try {
  const db = openDatabase(databasePath());
  const ctx = loadContext(db);
  const result = generateDemoData(db, ctx, { until: untilArg || undefined });
  console.log(`Demo data created: ${result.pupils} pupils with roll call, controls, performance and marks up to ${untilArg || ctx.today.date}.`);
  const demo = syncDemoAccount(db);
  if (demo) console.log(`Demo sign-in account: ${demo.username} / ${demo.password}`);
  closeDatabase();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
