import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Runtime configuration, read once from environment variables. */
export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  /** Folder holding the SQLite database file (never committed). */
  dataDir: process.env.DATA_DIR || path.resolve(here, '../data'),
  dbFile: process.env.DB_FILE || '',
  /** Built React app served in production. */
  clientDist: process.env.CLIENT_DIST || path.resolve(here, '../../client/dist'),
  isProduction: process.env.NODE_ENV === 'production',
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  /** Express "trust proxy" setting — needed behind Render/Fly/Nginx for secure cookies. */
  trustProxy: process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
};

export function databasePath() {
  return config.dbFile || path.join(config.dataDir, 'school.db');
}
