// Database schema. Each entry upgrades the schema by one version
// (tracked with SQLite's PRAGMA user_version).

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

export const migrations = [
  // v1 — initial schema mirroring the School_Manager workbook.
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT ${NOW},
    updated_at    TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    expires_at TEXT NOT NULL
  );

  -- Lists sheet: classes and their internal codes (used in student IDs, e.g. 6EME-04)
  CREATE TABLE classes (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    code       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Registration sheet
  CREATE TABLE pupils (
    id             INTEGER PRIMARY KEY,
    student_id     TEXT NOT NULL UNIQUE COLLATE NOCASE,
    class_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    class_no       INTEGER NOT NULL DEFAULT 0,
    full_name      TEXT NOT NULL,
    gender         TEXT CHECK (gender IN ('M', 'F')),
    date_of_birth  TEXT,
    place_of_birth TEXT,
    guardian       TEXT,
    phone          TEXT,
    address        TEXT,
    status         TEXT NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active', 'Transferred', 'Suspended', 'Expelled', 'Graduated')),
    created_at     TEXT NOT NULL DEFAULT ${NOW},
    updated_at     TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_pupils_class ON pupils(class_id, class_no);

  -- Calendar sheet: terms (with their UA months) and public holidays
  CREATE TABLE terms (
    number     INTEGER PRIMARY KEY CHECK (number >= 1),
    name       TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    ua_months  TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE holidays (
    date TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  -- Competence framework (Lists sheet / official report card)
  CREATE TABLE competences (
    number   INTEGER PRIMARY KEY,
    title_fr TEXT NOT NULL,
    title_en TEXT NOT NULL,
    short_fr TEXT NOT NULL,
    short_en TEXT NOT NULL
  );

  CREATE TABLE disciplines (
    code            TEXT PRIMARY KEY,
    competence      INTEGER NOT NULL REFERENCES competences(number),
    label           TEXT NOT NULL,
    short_fr        TEXT NOT NULL,
    short_en        TEXT NOT NULL,
    max             REAL NOT NULL CHECK (max > 0),
    criteria        TEXT NOT NULL DEFAULT '',
    on_monthly_card INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE attitudes (
    code       TEXT PRIMARY KEY,
    label_fr   TEXT NOT NULL,
    label_en   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE control_subjects (
    code       TEXT PRIMARY KEY,
    label_fr   TEXT NOT NULL,
    label_en   TEXT NOT NULL,
    short_fr   TEXT NOT NULL,
    short_en   TEXT NOT NULL,
    max        REAL NOT NULL DEFAULT 20,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE performance_areas (
    code       TEXT PRIMARY KEY,
    label_fr   TEXT NOT NULL,
    label_en   TEXT NOT NULL,
    max        REAL NOT NULL DEFAULT 10,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Roll_Call sheet: one mark per pupil per school day
  CREATE TABLE attendance (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    mark       TEXT NOT NULL CHECK (mark IN ('P', 'A', 'L', 'E')),
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, date)
  ) WITHOUT ROWID;
  CREATE INDEX idx_attendance_date ON attendance(date);

  -- Weekly_Controls sheet: one mark /20 per pupil, week and subject
  CREATE TABLE control_marks (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    week       INTEGER NOT NULL,
    subject    TEXT NOT NULL,
    value      REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, week, subject)
  ) WITHOUT ROWID;
  CREATE INDEX idx_control_marks_week ON control_marks(week);

  -- Daily_Performance sheet: one mark /10 per pupil, school day and area
  CREATE TABLE performance_marks (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    area       TEXT NOT NULL,
    value      REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, date, area)
  ) WITHOUT ROWID;
  CREATE INDEX idx_performance_marks_date ON performance_marks(date);

  -- Month_Card_Entry + Term_Card_Entry sheets: one mark per pupil, month and discipline
  CREATE TABLE discipline_marks (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    month      TEXT NOT NULL,
    discipline TEXT NOT NULL,
    value      REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, month, discipline)
  ) WITHOUT ROWID;
  CREATE INDEX idx_discipline_marks_month ON discipline_marks(month);

  -- Term_Card_Entry attitude grades (A+ to C), one per pupil, month and attitude
  CREATE TABLE attitude_grades (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    month      TEXT NOT NULL,
    attitude   TEXT NOT NULL,
    grade      TEXT NOT NULL CHECK (grade IN ('A+', 'A', 'B', 'C')),
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, month, attitude)
  ) WITHOUT ROWID;

  -- Class council remarks printed on report cards (period = 'M:2026-10' or 'T:1')
  CREATE TABLE remarks (
    pupil_id   INTEGER NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
    period     TEXT NOT NULL,
    text       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (pupil_id, period)
  ) WITHOUT ROWID;
  `,
];

export function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < migrations.length; v += 1) {
    db.transaction(() => {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return migrations.length;
}
