import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from './api';
import { coteFor, sumOrNull } from './format';
import { patchNested } from './grid';
import { useBatchSaver } from './hooks';
import type { ClassInfo, Competence, Cote, Discipline, MonthInfo, PupilRow, Values } from './types';

export interface MarksData {
  class: ClassInfo;
  month: MonthInfo;
  pupils: PupilRow[];
  values: Values;
  attitudes: Record<string, Record<string, string>>;
  performance: Record<string, number | null>;
}

type Change =
  | { type: 'mark'; pupilId: number; month: string; code: string; value: number | null }
  | { type: 'grade'; pupilId: number; month: string; code: string; value: string | null };

const keyOf = (c: Change) => `${c.type}|${c.pupilId}|${c.month}|${c.code}`;

/** Monthly-card and term-card marks share one record per pupil and month. */
export function useMarks(classId: number, month: string) {
  const qc = useQueryClient();
  const queryKey = ['marks', classId, month];
  const query = useQuery({ queryKey, queryFn: () => api.get<MarksData>(`/marks?${qs({ classId, month })}`) });
  const saver = useBatchSaver(
    (changes: Change[]) =>
      api.put('/marks', {
        marks: changes.filter((c) => c.type === 'mark').map((c) => ({ pupilId: c.pupilId, month: c.month, discipline: c.code, value: c.value })),
        attitudes: changes.filter((c) => c.type === 'grade').map((c) => ({ pupilId: c.pupilId, month: c.month, attitude: c.code, grade: c.value })),
      }),
    keyOf,
  );
  const setMark = (pupilId: number, code: string, value: number | null) => {
    qc.setQueryData<MarksData>(queryKey, (old) => old && patchNested(old, 'values', pupilId, code, value));
    saver.queue({ type: 'mark', pupilId, month, code, value });
  };
  const setGrade = (pupilId: number, code: string, value: string | null) => {
    qc.setQueryData<MarksData>(queryKey, (old) => old && patchNested(old, 'attitudes', pupilId, code, value));
    saver.queue({ type: 'grade', pupilId, month, code, value });
  };
  return { query, saver, setMark, setGrade };
}

export interface Evaluation {
  competences: Record<number, number | null>;
  total: number | null;
  average: number | null;
  cote: string | null;
  entered: number;
  complete: boolean;
}

/** Same rules as the server (and the workbook): sums per competence, total, average /20, cote. */
export function evaluate(
  values: Record<string, number> | undefined,
  disciplines: Discipline[],
  competences: Competence[],
  totalMax: number,
  cotes: Cote[],
): Evaluation {
  const note = (code: string) => values?.[code] ?? null;
  const comps: Record<number, number | null> = {};
  for (const c of competences) {
    const ds = disciplines.filter((d) => d.competence === c.number);
    if (ds.length) comps[c.number] = sumOrNull(ds.map((d) => note(d.code)));
  }
  const entered = disciplines.filter((d) => note(d.code) !== null).length;
  const total = sumOrNull(disciplines.map((d) => note(d.code)));
  const average = total === null ? null : (total / totalMax) * 20;
  return {
    competences: comps,
    total,
    average,
    cote: coteFor(total === null ? null : total / totalMax, cotes),
    entered,
    complete: entered === disciplines.length,
  };
}

export function overall(average: number | null, perf: number | null | undefined, academicWeight: number) {
  if (average === null) return null;
  if (perf === null || perf === undefined) return average;
  return academicWeight * average + (1 - academicWeight) * perf * 2;
}
