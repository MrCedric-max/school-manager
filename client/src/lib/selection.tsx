import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sessionStore } from './storage';
import type { Meta } from './types';

export interface Selection {
  classId: number;
  week: number;
  month: string;
  term: number;
  uaMonth: string;
  date: string;
}

interface SelectionContextValue {
  sel: Selection;
  update: (patch: Partial<Selection>) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);
const STORAGE_KEY = 'sm.selection';

function sanitize(meta: Meta, candidate: Partial<Selection>): Selection {
  const base: Selection = { classId: meta.classes[0]?.id ?? 0, ...meta.selections };
  const out = { ...base };
  if (candidate.classId && meta.classes.some((c) => c.id === candidate.classId)) out.classId = candidate.classId;
  if (candidate.week && meta.calendar.weeks.some((w) => w.number === candidate.week)) out.week = candidate.week;
  if (candidate.month && meta.calendar.months.some((m) => m.key === candidate.month)) out.month = candidate.month;
  if (candidate.term && meta.calendar.terms.some((t) => t.number === candidate.term)) out.term = candidate.term;
  if (candidate.uaMonth && meta.calendar.months.some((m) => m.key === candidate.uaMonth && m.uaTerm)) out.uaMonth = candidate.uaMonth;
  if (candidate.date && meta.calendar.schoolDays.includes(candidate.date)) out.date = candidate.date;
  return out;
}

/** The class / week / month / term chosen by the user, shared by every page. */
export function SelectionProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  const [sel, setSel] = useState<Selection>(() => {
    let stored: Partial<Selection> = {};
    try {
      stored = JSON.parse(sessionStore.get(STORAGE_KEY) || '{}');
    } catch {
      stored = {};
    }
    return sanitize(meta, stored);
  });

  useEffect(() => {
    setSel((s) => sanitize(meta, s));
  }, [meta]);

  useEffect(() => {
    sessionStore.set(STORAGE_KEY, JSON.stringify(sel));
  }, [sel]);

  const update = useCallback((patch: Partial<Selection>) => setSel((s) => ({ ...s, ...patch })), []);
  const value = useMemo(() => ({ sel, update }), [sel, update]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection outside SelectionProvider');
  return ctx;
}
