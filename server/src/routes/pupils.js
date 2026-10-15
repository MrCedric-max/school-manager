import { Router } from 'express';
import { getDb } from '../db/index.js';
import { PUPIL_STATUSES } from '../db/defaults.js';
import { HttpError, badRequest, notFound } from '../lib/http.js';
import { optionalDate, optionalInt, optionalString, requireInt, requireString } from '../lib/validate.js';

export const pupilsRouter = Router();

const SELECT = `SELECT p.id, p.student_id, p.class_id, c.name AS class_name, c.code AS class_code, p.class_no,
                       p.full_name, p.gender, p.date_of_birth, p.place_of_birth, p.guardian, p.phone,
                       p.address, p.status, p.created_at, p.updated_at
                  FROM pupils p JOIN classes c ON c.id = p.class_id`;

export function nextStudentId(db, classId) {
  const cls = db.prepare('SELECT code FROM classes WHERE id = ?').get(classId);
  if (!cls) throw notFound('Class not found');
  let n = db.prepare('SELECT COALESCE(MAX(class_no), 0) + 1 AS n FROM pupils WHERE class_id = ?').get(classId).n;
  const exists = db.prepare('SELECT 1 FROM pupils WHERE student_id = ?');
  let id = `${cls.code}-${String(n).padStart(2, '0')}`;
  while (exists.get(id)) {
    n += 1;
    id = `${cls.code}-${String(n).padStart(2, '0')}`;
  }
  return { studentId: id, classNo: n };
}

function pupilPayload(body) {
  const status = body?.status ?? 'Active';
  if (!PUPIL_STATUSES.includes(status)) throw badRequest('Invalid status');
  const gender = body?.gender || null;
  if (gender !== null && gender !== 'M' && gender !== 'F') throw badRequest('Gender must be M or F');
  return {
    classId: requireInt(body?.classId, 'class'),
    fullName: requireString(body?.fullName, 'name', { max: 150 }).replace(/\s+/g, ' '),
    gender,
    dateOfBirth: optionalDate(body?.dateOfBirth, 'date of birth'),
    placeOfBirth: optionalString(body?.placeOfBirth, { max: 120 }),
    guardian: optionalString(body?.guardian, { max: 150 }),
    phone: optionalString(body?.phone, { max: 60 }),
    address: optionalString(body?.address, { max: 200 }),
    status,
    studentId: optionalString(body?.studentId, { max: 30 }),
    classNo: optionalInt(body?.classNo, 'class number', { min: 0, max: 9999 }),
  };
}

pupilsRouter.get('/', (req, res) => {
  const db = getDb();
  const where = [];
  const params = [];
  if (req.query.classId) {
    where.push('p.class_id = ?');
    params.push(requireInt(req.query.classId, 'class'));
  }
  if (req.query.status) {
    where.push('p.status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.q) {
    where.push('(p.full_name LIKE ? OR p.student_id LIKE ? OR p.guardian LIKE ?)');
    const q = `%${String(req.query.q).trim()}%`;
    params.push(q, q, q);
  }
  const rows = db
    .prepare(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.sort_order, p.class_no, p.full_name`)
    .all(...params);
  res.json({ pupils: rows });
});

pupilsRouter.get('/next-id', (req, res) => {
  res.json(nextStudentId(getDb(), requireInt(req.query.classId, 'class')));
});

pupilsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const pupil = db.prepare(`${SELECT} WHERE p.id = ?`).get(requireInt(req.params.id, 'pupil'));
  if (!pupil) throw notFound('Pupil not found');
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM attendance WHERE pupil_id = @id) AS attendance,
              (SELECT COUNT(*) FROM control_marks WHERE pupil_id = @id) AS controls,
              (SELECT COUNT(*) FROM performance_marks WHERE pupil_id = @id) AS performance,
              (SELECT COUNT(*) FROM discipline_marks WHERE pupil_id = @id) AS marks`,
    )
    .get({ id: pupil.id });
  res.json({ pupil, records: counts });
});

function uniqueViolation(e) {
  if (String(e?.message).includes('UNIQUE')) throw new HttpError(409, 'This student ID is already used');
  throw e;
}

pupilsRouter.post('/', (req, res) => {
  const db = getDb();
  const p = pupilPayload(req.body);
  const created = db.transaction(() => {
    const auto = nextStudentId(db, p.classId);
    const studentId = p.studentId ?? auto.studentId;
    const classNo = p.classNo ?? (p.studentId ? Number(p.studentId.match(/(\d+)\s*$/)?.[1] ?? auto.classNo) : auto.classNo);
    try {
      return db
        .prepare(
          `INSERT INTO pupils (student_id, class_id, class_no, full_name, gender, date_of_birth, place_of_birth,
                               guardian, phone, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(studentId, p.classId, classNo, p.fullName, p.gender, p.dateOfBirth, p.placeOfBirth, p.guardian, p.phone, p.address, p.status);
    } catch (e) {
      return uniqueViolation(e);
    }
  })();
  res.status(201).json({ pupil: db.prepare(`${SELECT} WHERE p.id = ?`).get(Number(created.lastInsertRowid)) });
});

pupilsRouter.put('/:id', (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'pupil');
  const existing = db.prepare('SELECT * FROM pupils WHERE id = ?').get(id);
  if (!existing) throw notFound('Pupil not found');
  const p = pupilPayload(req.body);
  try {
    db.prepare(
      `UPDATE pupils SET student_id = ?, class_id = ?, class_no = ?, full_name = ?, gender = ?, date_of_birth = ?,
              place_of_birth = ?, guardian = ?, phone = ?, address = ?, status = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
    ).run(
      p.studentId ?? existing.student_id,
      p.classId,
      p.classNo ?? existing.class_no,
      p.fullName,
      p.gender,
      p.dateOfBirth,
      p.placeOfBirth,
      p.guardian,
      p.phone,
      p.address,
      p.status,
      id,
    );
  } catch (e) {
    uniqueViolation(e);
  }
  res.json({ pupil: db.prepare(`${SELECT} WHERE p.id = ?`).get(id) });
});

pupilsRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const id = requireInt(req.params.id, 'pupil');
  const records = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM attendance WHERE pupil_id = @id) + (SELECT COUNT(*) FROM control_marks WHERE pupil_id = @id)
            + (SELECT COUNT(*) FROM performance_marks WHERE pupil_id = @id) + (SELECT COUNT(*) FROM discipline_marks WHERE pupil_id = @id) AS n`,
    )
    .get({ id }).n;
  if (records > 0 && req.query.force !== 'true') {
    throw new HttpError(409, `This pupil has ${records} recorded marks. Change the status instead, or confirm deletion.`, { records });
  }
  const r = db.prepare('DELETE FROM pupils WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Pupil not found');
  res.json({ ok: true });
});
