import { createApp } from './app.js';
import { config, databasePath } from './config.js';
import { closeDatabase, getDb, openDatabase } from './db/index.js';

const file = databasePath();
openDatabase(file);
const app = createApp();

const server = app.listen(config.port, config.host, () => {
  const users = getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
  console.log(`School Manager is running on http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`Database: ${file}`);
  if (!users) console.log('No administrator yet — open the app in your browser to create one.');
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
