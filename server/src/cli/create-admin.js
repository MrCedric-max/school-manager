// Create the administrator account, or reset its password.
// Usage: npm run create-admin -- <username> <password>
import { databasePath } from '../config.js';
import { closeDatabase, openDatabase } from '../db/index.js';
import { hashPassword, validatePassword, validateUsername } from '../lib/auth.js';

const [usernameArg, password] = process.argv.slice(2);
if (!usernameArg || !password) {
  console.error('Usage: npm run create-admin -- <username> <password>');
  process.exit(1);
}

try {
  const username = validateUsername(usernameArg);
  validatePassword(password);
  const db = openDatabase(databasePath());
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
      hashPassword(password),
      existing.id,
    );
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    console.log(`Password updated for "${username}".`);
  } else {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashPassword(password));
    console.log(`Administrator "${username}" created.`);
  }
  closeDatabase();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
