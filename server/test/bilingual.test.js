import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from '../src/db/index.js';
import { migrate } from '../src/db/migrations.js';

// The report cards go home to parents in a bilingual school: every line of them is
// printed in French and in English, from the headings down to the assessment criteria.

// The texts the app shipped before the cards carried both languages: French for the
// first discipline, English for the second.
const WAS_1A = {
  label: 'Communiquer en Français (40 points)',
  criteria: '1: Orale 10 pts ; 2: Écrite 15 pts (15 pts pour le savoir-être)',
};
const WAS_1B = {
  label: 'Communicate in English (40 marks)',
  criteria: '1: Oral 20 marks ; 2: Written 15 marks (5 marks for attitudes)',
};

test('every discipline the card prints carries both languages', () => {
  const db = openDatabase(':memory:');
  const rows = db.prepare('SELECT code, label, criteria FROM disciplines ORDER BY code').all();
  assert.equal(rows.length, 11);
  for (const r of rows) {
    assert.match(r.label, / \/ /, `${r.code} — ${r.label}`);
    assert.match(r.criteria, / \/ /, `${r.code} — ${r.criteria}`);
  }
  const a = rows.find((r) => r.code === '1A');
  assert.equal(a.label, 'Communiquer en français / Communicate in French (40 points)');
  assert.equal(a.criteria, '1: Orale / Oral 10 pts ; 2: Écrite / Written 15 pts (15 pts pour le savoir-être / for attitudes)');
  closeDatabase();
});

test('a college subject carries a French and an English name', () => {
  const db = openDatabase(':memory:');
  const rows = db.prepare('SELECT code, label_fr, label_en FROM college_subjects ORDER BY code').all();
  assert.ok(rows.length >= 14);
  for (const r of rows) {
    assert.ok(r.label_fr, `${r.code} has no French name`);
    assert.ok(r.label_en, `${r.code} has no English name`);
  }
  const english = rows.find((r) => r.code === 'anglais');
  assert.equal(english.label_fr, 'Anglais');
  assert.equal(english.label_en, 'English');
  closeDatabase();
});

test('a database from before the cards carried both languages is brought up to date', () => {
  const db = openDatabase(':memory:');
  db.prepare('UPDATE disciplines SET label = ?, criteria = ? WHERE code = ?').run(WAS_1A.label, WAS_1A.criteria, '1A');
  db.prepare('UPDATE disciplines SET label = ?, criteria = ? WHERE code = ?').run(WAS_1B.label, WAS_1B.criteria, '1B');
  // A text the school wrote itself is not one the app shipped: it is left alone.
  db.prepare('UPDATE disciplines SET label = ?, criteria = ? WHERE code = ?').run('Dessin / Drawing', '1: Croquis / Sketch 20 pts', '6B');

  db.pragma('user_version = 6');
  migrate(db);
  assert.equal(db.pragma('user_version', { simple: true }), 7);

  const byCode = new Map(db.prepare('SELECT code, label, criteria FROM disciplines').all().map((r) => [r.code, r]));
  assert.match(byCode.get('1A').label, /Communiquer en français \/ Communicate in French/);
  assert.match(byCode.get('1A').criteria, /Orale \/ Oral/);
  assert.match(byCode.get('1B').label, /Communiquer en anglais \/ Communicate in English/);
  assert.match(byCode.get('1B').criteria, /Orale \/ Oral/);
  assert.equal(byCode.get('6B').label, 'Dessin / Drawing');
  assert.equal(byCode.get('6B').criteria, '1: Croquis / Sketch 20 pts');
  closeDatabase();
});

test('running the upgrade twice changes nothing', () => {
  const db = openDatabase(':memory:');
  db.prepare('UPDATE disciplines SET label = ?, criteria = ? WHERE code = ?').run(WAS_1A.label, WAS_1A.criteria, '1A');
  db.pragma('user_version = 6');
  migrate(db);
  const once = db.prepare("SELECT label, criteria FROM disciplines WHERE code = '1A'").get();
  db.pragma('user_version = 6');
  migrate(db);
  const twice = db.prepare("SELECT label, criteria FROM disciplines WHERE code = '1A'").get();
  assert.deepEqual(twice, once);
  closeDatabase();
});
