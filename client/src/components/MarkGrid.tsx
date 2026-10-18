import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { fmtMark, parseMarkInput } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { PupilRow } from '../lib/types';
import { cx } from './ui';

export interface GridColumn {
  key: string;
  header: ReactNode;
  sub?: ReactNode;
  max: number;
  readOnly?: boolean;
  kind?: 'mark' | 'grade';
  title?: string;
}

export interface ComputedColumn {
  key: string;
  header: ReactNode;
  sub?: ReactNode;
  render: (pupil: PupilRow) => ReactNode;
  className?: string;
}

function focusCell(gridId: string, row: number, col: number) {
  const el = document.querySelector<HTMLElement>(`[data-grid="${gridId}"][data-row="${row}"][data-col="${col}"]`);
  if (el) {
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  }
}

function navigate(e: KeyboardEvent<HTMLElement>, gridId: string, row: number, col: number, before?: () => void) {
  const moves: Record<string, [number, number]> = { Enter: [1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
  const move = moves[e.key];
  if (move) {
    e.preventDefault();
    before?.();
    focusCell(gridId, row + move[0], col + move[1]);
  }
}

function MarkCell({
  value,
  max,
  onCommit,
  gridId,
  row,
  col,
  label,
}: {
  value: number | null | undefined;
  max: number;
  onCommit: (v: number | null) => void;
  gridId: string;
  row: number;
  col: number;
  label: string;
}) {
  const { lang, tr } = useLang();
  const [text, setText] = useState(fmtMark(value, lang));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(fmtMark(value, lang));
      setInvalid(false);
    }
  }, [value, lang]);

  const commit = () => {
    const n = parseMarkInput(text);
    if (n === null) {
      setInvalid(false);
      if (value !== null && value !== undefined) onCommit(null);
      return;
    }
    if (Number.isNaN(n) || n < 0 || n > max) {
      setInvalid(true);
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    setInvalid(false);
    setText(fmtMark(rounded, lang));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <input
      className="grid-input"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? tr(`Enter a mark between 0 and ${max}`, `Note entre 0 et ${max}`) : label}
      data-grid={gridId}
      data-row={row}
      data-col={col}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setText(fmtMark(value, lang));
          setInvalid(false);
          return;
        }
        navigate(e, gridId, row, col, commit);
      }}
    />
  );
}

function GradeCell({
  value,
  grades,
  onCommit,
  gridId,
  row,
  col,
  label,
}: {
  value: string | null | undefined;
  grades: string[];
  onCommit: (v: string | null) => void;
  gridId: string;
  row: number;
  col: number;
  label: string;
}) {
  const tone =
    value === 'A+' ? 'text-school-700 font-bold' : value === 'A' ? 'text-school-700' : value === 'B' ? 'text-amber-700' : value === 'C' ? 'text-red-700' : 'text-slate-400';
  return (
    <select
      aria-label={label}
      title={label}
      className={cx('grid-input cursor-pointer appearance-none', tone)}
      value={value ?? ''}
      data-grid={gridId}
      data-row={row}
      data-col={col}
      onChange={(e) => onCommit(e.target.value || null)}
      onKeyDown={(e) => {
        const key = e.key.toUpperCase();
        if (key === 'DELETE' || key === 'BACKSPACE') {
          e.preventDefault();
          onCommit(null);
        } else if (e.key === 'Enter') navigate(e, gridId, row, col);
      }}
    >
      <option value="">·</option>
      {grades.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

export function PupilName({ pupil }: { pupil: PupilRow }) {
  const { tr } = useLang();
  const inactive = pupil.status !== 'Active';
  return (
    <div className={cx('flex min-w-44 max-w-72 items-center gap-2', inactive && 'text-slate-400')}>
      <span className="truncate" title={pupil.name}>
        {pupil.name}
      </span>
      {inactive && (
        <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-semibold uppercase text-slate-500">
          {pupil.status === 'Suspended' ? tr('Suspended', 'Suspendu') : pupil.status === 'Transferred' ? tr('Transferred', 'Transféré') : pupil.status}
        </span>
      )}
    </div>
  );
}

/**
 * Spreadsheet-like entry table: one row per pupil, one input per column.
 * Enter / ↓ moves down, ↑ moves up, Tab moves right, Esc cancels.
 */
export function MarkGrid({
  pupils,
  columns,
  computed = [],
  getValue,
  getGrade,
  grades = [],
  onChange,
  onGrade,
  footer,
  groupHeader,
}: {
  pupils: PupilRow[];
  columns: GridColumn[];
  computed?: ComputedColumn[];
  getValue: (pupilId: number, key: string) => number | null | undefined;
  getGrade?: (pupilId: number, key: string) => string | null | undefined;
  grades?: string[];
  onChange: (pupilId: number, key: string, value: number | null) => void;
  onGrade?: (pupilId: number, key: string, value: string | null) => void;
  footer?: ReactNode;
  groupHeader?: ReactNode;
}) {
  const gridId = useId();
  const { lang, tr } = useLang();
  return (
    <div className="overflow-x-auto">
      <table className="table-sticky w-full border-separate border-spacing-0 text-sm">
        <thead>
          {groupHeader}
          <tr className="text-xs text-slate-500">
            <th className="sticky-col border-b border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold">
              <div className="flex gap-3">
                <span className="w-6 text-right">N°</span>
                <span className="w-16">{tr('ID', 'Matricule')}</span>
                <span>{tr('Pupil', 'Élève')}</span>
              </div>
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                className={cx('border-b border-slate-200 px-1 py-2 text-center font-semibold', c.readOnly ? 'bg-slate-100' : 'bg-slate-50')}
              >
                <div className="leading-tight text-slate-700">{c.header}</div>
                {c.sub && <div className="text-[10px] font-normal text-slate-400">{c.sub}</div>}
              </th>
            ))}
            {computed.map((c) => (
              <th key={c.key} className="border-b border-slate-200 bg-school-50 px-1.5 py-2 text-center font-semibold text-school-900">
                <div className="leading-tight">{c.header}</div>
                {c.sub && <div className="text-[10px] font-normal text-school-700/70">{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pupils.map((p, r) => (
            <tr key={p.id} className="group">
              <td className="sticky-col border-b border-slate-100 bg-white px-2 py-1 group-hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right text-xs tabular-nums text-slate-400">{r + 1}</span>
                  <span className="w-16 text-xs font-medium tabular-nums text-slate-500">{p.studentId}</span>
                  <PupilName pupil={p} />
                </div>
              </td>
              {columns.map((c, ci) => (
                <td key={c.key} className={cx('border-b border-slate-100 px-0.5 py-0.5', c.readOnly ? 'bg-slate-100/70' : 'group-hover:bg-slate-50')}>
                  {c.readOnly ? (
                    <div className="h-8 px-1.5 text-center text-sm leading-8 tabular-nums text-slate-500">{fmtMark(getValue(p.id, c.key), lang) || '·'}</div>
                  ) : c.kind === 'grade' ? (
                    <GradeCell
                      value={getGrade?.(p.id, c.key)}
                      grades={grades}
                      gridId={gridId}
                      row={r}
                      col={ci}
                      label={`${p.name} — ${typeof c.header === 'string' ? c.header : c.key}`}
                      onCommit={(v) => onGrade?.(p.id, c.key, v)}
                    />
                  ) : (
                    <MarkCell
                      value={getValue(p.id, c.key)}
                      max={c.max}
                      gridId={gridId}
                      row={r}
                      col={ci}
                      label={`${p.name} — ${typeof c.header === 'string' ? c.header : c.key} /${c.max}`}
                      onCommit={(v) => onChange(p.id, c.key, v)}
                    />
                  )}
                </td>
              ))}
              {computed.map((c) => (
                <td key={c.key} className={cx('whitespace-nowrap border-b border-slate-100 bg-school-50/40 px-1.5 py-1 text-center tabular-nums', c.className)}>
                  {c.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}
