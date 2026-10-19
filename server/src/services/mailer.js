// Sending mail, and — until the school has filled in its SMTP details — showing exactly
// what would be sent instead.
//
// Credentials are read from the environment (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS,
// MAIL_FROM, MAIL_SECURE) and never written into the database: the database is what the
// school downloads as a backup. Everything else about reminders (who receives them, how
// long before, dry run or not) is a setting, changed from the interface.
import nodemailer from 'nodemailer';

/** @returns {{host:string, port:number, user:string, pass:string, from:string, secure:boolean, dryRun:boolean}} */
export function mailConfig() {
  const host = (process.env.MAIL_HOST ?? '').trim();
  const port = Number(process.env.MAIL_PORT || 587);
  return {
    host,
    port,
    user: (process.env.MAIL_USER ?? '').trim(),
    pass: process.env.MAIL_PASS ?? '',
    from: (process.env.MAIL_FROM ?? '').trim(),
    secure: /^(1|true|yes|ssl|tls)$/i.test((process.env.MAIL_SECURE ?? '').trim()) || port === 465,
    dryRun: /^(1|true|yes|on)$/i.test((process.env.MAIL_DRY_RUN ?? '').trim()),
  };
}

/** What the interface shows about the mail setup — never the password itself. */
export function mailStatus() {
  const cfg = mailConfig();
  const missing = [];
  if (!cfg.host) missing.push('MAIL_HOST');
  if (!cfg.user) missing.push('MAIL_USER');
  if (!cfg.pass) missing.push('MAIL_PASS');
  const configured = missing.length === 0;
  const dryRun = cfg.dryRun || !configured;
  return {
    configured,
    dryRun,
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user,
    from: cfg.from || defaultFrom(cfg),
    missing,
    /** Why nothing can leave the server yet, in plain words. */
    reason: dryRun
      ? cfg.dryRun
        ? 'Dry run is on: messages are prepared and shown, not delivered.'
        : `No mail server configured yet (${missing.join(', ')}). Messages are prepared and shown instead.`
      : '',
  };
}

function defaultFrom(cfg) {
  const address = cfg.user && cfg.user.includes('@') ? cfg.user : `no-reply@${cfg.host || 'school.local'}`;
  return `School Manager <${address}>`;
}

function createTransport(cfg, dryRun) {
  if (dryRun) return nodemailer.createTransport({ jsonTransport: true, newline: 'unix' });
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    // Schools often run on a shared hosting SMTP with a self-signed certificate.
    tls: { rejectUnauthorized: !/^(1|true|yes)$/i.test((process.env.MAIL_REQUIRE_TLS ?? '').trim()) },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

/**
 * Hand one message to the mail service.
 *
 * In dry run nothing leaves the machine: nodemailer renders the whole message — headers,
 * body and the calendar attachment — and that rendering is what gets stored and shown, so
 * the school can read the mail before a single one is delivered.
 *
 * @returns {Promise<{status:'sent'|'dry-run'|'failed', detail:string, message:string}>}
 */
export async function deliver({ to, subject, text, ics = '', replyTo = '' }) {
  const cfg = mailConfig();
  const missing = mailStatus().missing;
  const dryRun = cfg.dryRun || missing.length > 0;
  const transport = createTransport(cfg, dryRun);
  try {
    const info = await transport.sendMail({
      from: cfg.from || defaultFrom(cfg),
      to,
      subject,
      text,
      ...(replyTo ? { replyTo } : {}),
      ...(ics
        ? {
            attachments: [
              {
                filename: 'invite.ics',
                content: ics,
                contentType: 'text/calendar; method=REQUEST; charset=utf-8',
              },
            ],
          }
        : {}),
    });
    return {
      status: dryRun ? 'dry-run' : 'sent',
      detail: dryRun ? `Prepared for ${to}${cfg.host ? ` (would go through ${cfg.host})` : ''}` : `Accepted by ${cfg.host}`,
      message: typeof info?.message === 'string' ? info.message : '',
    };
  } catch (e) {
    return { status: 'failed', detail: String(e?.message ?? e).slice(0, 400), message: '' };
  } finally {
    transport.close?.();
  }
}
