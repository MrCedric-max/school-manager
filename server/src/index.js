import { createApp } from './app.js';
import { config, databasePath, demoLoginConfig } from './config.js';
import { closeDatabase, getDb, openDatabase } from './db/index.js';
import { userCount } from './routes/auth.js';
import { syncDemoAccount } from './services/demo-login.js';
import { startScheduler } from './services/scheduler.js';

const file = databasePath();
openDatabase(file);
const demo = syncDemoAccount(getDb());
const app = createApp();

// Background jobs: the daily reminders, and preparing next year's calendar from this one.
const scheduler = process.env.SCHEDULER_OFF === '1' ? null : startScheduler({ db: getDb() });

const server = app.listen(config.port, config.host, () => {
  console.log(`School Manager is running on http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`Database: ${file}`);
  if (demo) console.log(`Demo sign-in is ON (shown on the sign-in page): ${demo.username} / ${demo.password}`);
  else if (demoLoginConfig()) console.log('Demo sign-in stays off: this database does not hold demo data (real data is never exposed).');
  if (!userCount(getDb())) console.log('No administrator yet — open the app in your browser to create one.');
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  scheduler?.stop();
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
