// The school runs two cycles under one roof: the primary (MINEDUB, evaluated by
// discipline) and the college (MINESEC, evaluated by subject, coefficient and séquence).
// They share the school year, the roll call and the calendar; everything about marks and
// report cards differs.
import { COLLEGE_MENTIONS } from '../db/defaults.js';

export const CYCLE_PRIMARY = 'primary';
export const CYCLE_COLLEGE = 'college';

/**
 * Which cycle a level belongs to. Secondary levels are the ones that carry a form number
 * (6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale) — everything else (SIL, CP, CE1, CE2,
 * CM1, CM2) is primary.
 */
export function cycleForLevel(code) {
  const c = String(code ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // 6ème → 6eme, ê → e
    .replace(/[^A-Z0-9]/g, '');
  if (!c) return CYCLE_PRIMARY;
  if (/^(TLE|TERMINALE|TERM)/.test(c)) return CYCLE_COLLEGE; // Terminale carries no number
  if (/^(PREMIER|PREMIERE|SECONDE|SIXIEME|CINQUIEME|QUATRIEME|TROISIEME)/.test(c)) return CYCLE_COLLEGE;
  const form = /^([0-9])/.exec(c);
  if (form && Number(form[1]) >= 1 && Number(form[1]) <= 6) return CYCLE_COLLEGE; // 6ème → 1ère
  return CYCLE_PRIMARY;
}

/** The cycle of a class row: what the school chose, or what its level implies. */
export function cycleOf(cls) {
  return cls?.cycle || cycleForLevel(cls?.code);
}

export const isCollege = (cls) => cycleOf(cls) === CYCLE_COLLEGE;

/** The mention printed for a mark out of twenty (Insuffisant, Passable, Assez Bien…). */
export function mentionFor(average) {
  if (!Number.isFinite(average)) return null;
  const m = COLLEGE_MENTIONS.find((x) => average >= x.min);
  return m ? { code: m.code, fr: m.fr, en: m.en } : null;
}
