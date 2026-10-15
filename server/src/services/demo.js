// Demo data so the app can be explored before importing the real workbook.
// All names are generated — they are NOT the school's pupils.
import { readClasses } from './context.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = [
  'ABENA', 'AKONO', 'AMOUGOU', 'ATANGANA', 'AYISSI', 'BELLA', 'BIKELE', 'BILONG', 'DJOMO', 'EBANDA', 'EBOGO', 'EKANI',
  'ELOUNDOU', 'ESSOMBA', 'ETOUNDI', 'FOTSO', 'FOUDA', 'KAMGA', 'KENGNE', 'MANGA', 'MBALLA', 'MBARGA', 'MENDOUGA',
  'MESSI', 'MOUKOKO', 'MVONDO', 'NANA', 'NDJANA', 'NDONGO', 'NGONO', 'NJOYA', 'NKODO', 'NKOLO', 'NOAH', 'ONANA',
  'OWONA', 'SIMO', 'TAGNE', 'TCHAMENI', 'TCHOUPO', 'TSAFACK', 'WAMBA', 'YOUMBI', 'ZANG', 'ZOGO',
];
const BOYS = [
  'ADRIEN', 'ARTHUR', 'BRYAN', 'CHRIS', 'DANIEL', 'DAVID', 'ELIE', 'EMMANUEL', 'ETHAN', 'FRANCK', 'GABRIEL', 'HUGO',
  'ISAAC', 'JEAN', 'JORDAN', 'JOSEPH', 'KEVIN', 'LIAM', 'LUCAS', 'MARC', 'MATHIS', 'NATHAN', 'NOAH', 'OLIVIER',
  'PAUL', 'PIERRE', 'RAPHAEL', 'SAMUEL', 'STEVE', 'YANN',
];
const GIRLS = [
  'ANNE', 'AUDREY', 'BELINDA', 'CAROLE', 'CHRISTELLE', 'DIANE', 'DORIS', 'EMILIE', 'ESTHER', 'FAITH', 'FLORE',
  'GLADYS', 'GRACE', 'HELENE', 'IRENE', 'JOSIANE', 'LAURE', 'LINDA', 'MARIE', 'MERVEILLE', 'NADEGE', 'OCEANE',
  'PEARL', 'PRISCILLE', 'RUTH', 'SANDRINE', 'SARAH', 'TATIANA', 'VANESSA', 'YOLANDE',
];
const QUARTERS = ['Bastos', 'Biyem-Assi', 'Ekounou', 'Emana', 'Essos', 'Etoudi', 'Melen', 'Mendong', 'Mimboman', 'Mvan', 'Mvog-Mbi', 'Nlongkak', 'Odza', 'Omnisport', 'Simbock', 'Tsinga'];
const PLACES = ['Yaoundé', 'Douala', 'Bafoussam', 'Ebolowa', 'Mbalmayo', 'Bertoua', 'Kribi', 'Bamenda', 'Limbé', 'Garoua'];
const CLASS_SIZES = { SIL: 27, CP: 17, CE1: 23, CE2: 27, CM1: 27, CM2: 26, '6EME': 29, '5EME': 22, '4EME': 13, '3EME': 15, '2ND': 18 };

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Create demo pupils and marks for every class, from the start of the year up
 * to `until` (default: today). Refuses to run when pupils already exist.
 */
export function generateDemoData(db, ctx, { seed = 2026, until } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM pupils').get().n;
  if (existing > 0) throw new Error('Pupils already exist — demo data can only be loaded into an empty school');
  const rnd = mulberry32(seed);
  const end = until ?? ctx.today.date;
  const noise = (spread) => (rnd() + rnd() + rnd() - 1.5) * spread;
  const { framework, calendar } = ctx;
  const startYear = Number(ctx.settings.yearStart.slice(0, 4));

  const insertPupil = db.prepare(
    `INSERT INTO pupils (student_id, class_id, class_no, full_name, gender, date_of_birth, place_of_birth, guardian, phone, address, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
  );
  const insAtt = db.prepare('INSERT INTO attendance (pupil_id, date, mark) VALUES (?, ?, ?)');
  const insPerf = db.prepare('INSERT INTO performance_marks (pupil_id, date, area, value) VALUES (?, ?, ?, ?)');
  const insCtrl = db.prepare('INSERT INTO control_marks (pupil_id, week, subject, value) VALUES (?, ?, ?, ?)');
  const insMark = db.prepare('INSERT INTO discipline_marks (pupil_id, month, discipline, value) VALUES (?, ?, ?, ?)');
  const insGrade = db.prepare('INSERT INTO attitude_grades (pupil_id, month, attitude, grade) VALUES (?, ?, ?, ?)');

  const schoolDays = calendar.schoolDays.filter((d) => d <= end);
  const weeks = calendar.weeks.filter((w) => w.term && w.friday < end && w.schoolDays > 0);
  const months = calendar.months.filter((m) => m.uaTerm && m.firstDay <= end);

  let count = 0;
  db.transaction(() => {
    readClasses(db).forEach((cls, level) => {
      const size = CLASS_SIZES[cls.code] ?? 20;
      const names = [];
      for (let i = 0; i < size; i += 1) {
        const gender = rnd() < 0.5 ? 'M' : 'F';
        const given = gender === 'M' ? BOYS : GIRLS;
        const s1 = pick(rnd, SURNAMES);
        let s2 = pick(rnd, SURNAMES);
        if (s2 === s1) s2 = pick(rnd, SURNAMES);
        const g1 = pick(rnd, given);
        let g2 = pick(rnd, given);
        while (g2 === g1) g2 = pick(rnd, given);
        names.push({ gender, name: `${s1} ${s2} ${g1} ${g2}` });
      }
      names.sort((a, b) => a.name.localeCompare(b.name));
      names.forEach((p, i) => {
        const birthYear = startYear - 6 - level + (rnd() < 0.2 ? -1 : 0);
        const dob = `${birthYear}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
        const phone = `6${Math.floor(rnd() * 1e8).toString().padStart(8, '0')}`.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4');
        const parentGiven = pick(rnd, rnd() < 0.5 ? BOYS : GIRLS);
        const r = insertPupil.run(
          `${cls.code}-${String(i + 1).padStart(2, '0')}`,
          cls.id,
          i + 1,
          p.name,
          p.gender,
          dob,
          pick(rnd, PLACES),
          `${p.name.split(' ')[0]} ${parentGiven}`,
          phone,
          pick(rnd, QUARTERS),
        );
        const pupilId = Number(r.lastInsertRowid);
        const ability = clamp(0.62 + noise(0.45), 0.3, 0.97);
        count += 1;

        for (const date of schoolDays) {
          const x = rnd();
          const absentRisk = (1 - ability) * 0.12;
          insAtt.run(pupilId, date, x < absentRisk ? 'A' : x < absentRisk + 0.03 ? 'L' : x < absentRisk + 0.045 ? 'E' : 'P');
          for (const a of framework.areas) {
            insPerf.run(pupilId, date, a.code, clamp(Math.round(a.max * (ability + 0.12 + noise(0.25))), 3, a.max));
          }
        }
        for (const w of weeks) {
          for (const s of framework.subjects) {
            insCtrl.run(pupilId, w.number, s.code, clamp(Math.round(s.max * (ability + noise(0.3)) * 2) / 2, 4, s.max));
          }
        }
        for (const m of months) {
          for (const d of framework.disciplines) {
            insMark.run(pupilId, m.key, d.code, clamp(Math.round(d.max * (ability + noise(0.28)) * 2) / 2, Math.round(d.max * 0.2), d.max));
          }
          for (const a of framework.attitudes) {
            const g = ability + noise(0.3);
            insGrade.run(pupilId, m.key, a.code, g > 0.85 ? 'A+' : g > 0.68 ? 'A' : g > 0.5 ? 'B' : 'C');
          }
        }
      });
    });
    db.prepare("INSERT INTO settings (key, value) VALUES ('demo_mode', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  })();
  return { pupils: count };
}
