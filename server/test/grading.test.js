import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/db/defaults.js';
import {
  attendanceRate,
  columnStats,
  coteFor,
  mean,
  overallScore,
  parseMark,
  rankDescending,
  round,
  sumOrNull,
} from '../src/lib/grading.js';

const cotes = JSON.parse(DEFAULT_SETTINGS.cotes);

test('cote thresholds: A+ ≥ 90% · A ≥ 75% · ECA/B ≥ 50% · NA < 50%', () => {
  assert.equal(coteFor(0.9, cotes), 'A+');
  assert.equal(coteFor(0.8999, cotes), 'A');
  assert.equal(coteFor(0.75, cotes), 'A');
  assert.equal(coteFor(0.7499, cotes), 'ECA/B');
  assert.equal(coteFor(0.5, cotes), 'ECA/B');
  assert.equal(coteFor(0.4999, cotes), 'NA');
  assert.equal(coteFor(0, cotes), 'NA');
  assert.equal(coteFor(null, cotes), null);
  // 162/180 = exactly 90% must not fall to A because of floating point
  assert.equal(coteFor(162 / 180, cotes), 'A+');
});

test('averages ignore blank cells', () => {
  assert.equal(mean([10, null, 20, undefined]), 15);
  assert.equal(mean([]), null);
  assert.equal(sumOrNull([null, null]), null);
  assert.equal(sumOrNull([5, null, 2.5]), 7.5);
});

test('overall score = 70% academic + 30% performance rescaled /20', () => {
  assert.equal(round(overallScore(15, 8)), round(0.7 * 15 + 0.3 * 16));
  assert.equal(overallScore(12, null), 12);
  assert.equal(overallScore(null, 9), null);
});

test('attendance rate counts late pupils as present', () => {
  assert.equal(attendanceRate({ P: 7, A: 1, L: 1, E: 1 }), 0.8);
  assert.equal(attendanceRate({}), null);
});

test('ranking shares ranks on ties (RANK.EQ)', () => {
  const { ranks, count } = rankDescending([
    { key: 'a', value: 15 },
    { key: 'b', value: 17 },
    { key: 'c', value: 15 },
    { key: 'd', value: null },
    { key: 'e', value: 12 },
  ]);
  assert.equal(count, 4);
  assert.equal(ranks.get('b'), 1);
  assert.equal(ranks.get('a'), 2);
  assert.equal(ranks.get('c'), 2);
  assert.equal(ranks.get('e'), 4);
  assert.equal(ranks.has('d'), false);
});

test('column statistics and mark parsing', () => {
  assert.deepEqual(columnStats([10, null, 14]), { avg: 12, max: 14, min: 10, count: 2 });
  assert.equal(parseMark('12,5'), 12.5);
  assert.equal(parseMark(''), null);
  assert.ok(Number.isNaN(parseMark('abc')));
});
