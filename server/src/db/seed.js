import {
  DEFAULT_ATTITUDES,
  DEFAULT_CLASSES,
  DEFAULT_COMPETENCES,
  DEFAULT_CONTROL_SUBJECTS,
  DEFAULT_DISCIPLINES,
  DEFAULT_HOLIDAYS,
  DEFAULT_PERFORMANCE_AREAS,
  DEFAULT_SETTINGS,
  DEFAULT_TERMS,
} from './defaults.js';

const isEmpty = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;

/**
 * Fill reference tables with the workbook's defaults. Idempotent: only empty
 * tables / missing settings are filled, so user changes are never overwritten.
 */
export function seedDefaults(db) {
  db.transaction(() => {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);

    if (isEmpty(db, 'classes')) {
      const stmt = db.prepare('INSERT INTO classes (name, code, sort_order) VALUES (?, ?, ?)');
      DEFAULT_CLASSES.forEach(([name, code], i) => stmt.run(name, code, i + 1));
    }

    if (isEmpty(db, 'terms')) {
      const stmt = db.prepare(
        'INSERT INTO terms (number, name, start_date, end_date, ua_months) VALUES (?, ?, ?, ?, ?)',
      );
      for (const t of DEFAULT_TERMS) {
        stmt.run(t.number, t.name, t.start_date, t.end_date, JSON.stringify(t.ua_months));
      }
    }

    if (isEmpty(db, 'holidays')) {
      const stmt = db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)');
      for (const [date, name] of DEFAULT_HOLIDAYS) stmt.run(date, name);
    }

    if (isEmpty(db, 'competences')) {
      const stmt = db.prepare(
        'INSERT INTO competences (number, title_fr, title_en, short_fr, short_en) VALUES (@number, @title_fr, @title_en, @short_fr, @short_en)',
      );
      for (const c of DEFAULT_COMPETENCES) stmt.run(c);
    }

    if (isEmpty(db, 'disciplines')) {
      const stmt = db.prepare(
        `INSERT INTO disciplines (code, competence, label, short_fr, short_en, max, criteria, on_monthly_card, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      DEFAULT_DISCIPLINES.forEach((d, i) => stmt.run(...d, i + 1));
    }

    if (isEmpty(db, 'attitudes')) {
      const stmt = db.prepare('INSERT INTO attitudes (code, label_fr, label_en, sort_order) VALUES (?, ?, ?, ?)');
      DEFAULT_ATTITUDES.forEach((a, i) => stmt.run(...a, i + 1));
    }

    if (isEmpty(db, 'control_subjects')) {
      const stmt = db.prepare(
        'INSERT INTO control_subjects (code, label_fr, label_en, short_fr, short_en, max, competence, sort_order) VALUES (?, ?, ?, ?, ?, 20, ?, ?)',
      );
      DEFAULT_CONTROL_SUBJECTS.forEach(([code, labelFr, labelEn, shortFr, shortEn, competence], i) =>
        stmt.run(code, labelFr, labelEn, shortFr, shortEn, competence, i + 1),
      );
    }

    if (isEmpty(db, 'performance_areas')) {
      const stmt = db.prepare(
        'INSERT INTO performance_areas (code, label_fr, label_en, max, sort_order) VALUES (?, ?, ?, 10, ?)',
      );
      DEFAULT_PERFORMANCE_AREAS.forEach((a, i) => stmt.run(...a, i + 1));
    }
  })();
}
