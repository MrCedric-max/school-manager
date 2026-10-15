import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { InfoNote, NoPupils } from '../components/Common';
import { PupilName } from '../components/MarkGrid';
import { ClassSelect, WeekSelect } from '../components/Selectors';
import { Card, ErrorBox, LoadingBlock, PageHeader, SaveIndicator, Toolbar, cx } from '../components/ui';
import { api, qs } from '../lib/api';
import { MARK_STYLES, dayMonth, fmtPct, weekdayShort } from '../lib/format';
import { patchNested } from '../lib/grid';
import { useBatchSaver, useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { AttendanceSummary, ClassInfo, DayType, PupilRow, RollMark, WeekInfo } from '../lib/types';

interface AttendanceData {
  class: ClassInfo;
  week: WeekInfo;
  days: Array<{ date: string; dow: number; type: DayType; holiday: string | null; term: number | null }>;
  pupils: PupilRow[];
  marks: Record<string, Record<string, RollMark>>;
  weekTotals: Record<string, AttendanceSummary>;
  yearToDate: Record<string, AttendanceSummary>;
}

interface Change {
  pupilId: number;
  date: string;
  mark: RollMark | null;
}

const keyOf = (c: Change) => `${c.pupilId}|${c.date}`;
const CYCLE: Array<RollMark | null> = [null, 'P', 'A', 'L', 'E'];

function countMarks(marks: Array<RollMark | undefined>) {
  const c = { P: 0, A: 0, L: 0, E: 0 };
  for (const m of marks) if (m) c[m] += 1;
  return c;
}

const rate = (c: { P: number; A: number; L: number; E: number }) => {
  const total = c.P + c.A + c.L + c.E;
  return total ? (c.P + c.L) / total : null;
};

export default function RollCall() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const qc = useQueryClient();
  const gridId = useId();
  const queryKey = ['attendance', sel.classId, sel.week];
  const q = useQuery({
    queryKey,
    queryFn: () => api.get<AttendanceData>(`/attendance?${qs({ classId: sel.classId, week: sel.week })}`),
  });
  const saver = useBatchSaver((changes: Change[]) => api.put('/attendance', { changes }), keyOf);

  const data = q.data;
  const pupils = data?.pupils ?? [];
  const days = data?.days ?? [];
  const schoolCols = days.map((d) => d.type === 'school');

  const setMark = (pupilId: number, date: string, mark: RollMark | null) => {
    qc.setQueryData<AttendanceData>(queryKey, (old) => old && patchNested(old, 'marks', pupilId, date, mark));
    saver.queue({ pupilId, date, mark });
  };

  const markAllPresent = (date: string) => {
    for (const p of pupils) if (!data?.marks[p.id]?.[date]) setMark(p.id, date, 'P');
  };

  const focusCell = (row: number, col: number) => {
    document.querySelector<HTMLElement>(`[data-grid="${gridId}"][data-row="${row}"][data-col="${col}"]`)?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, pupilId: number, date: string, row: number, col: number) => {
    const k = e.key.toUpperCase();
    if (['P', 'A', 'L', 'E'].includes(k)) {
      e.preventDefault();
      setMark(pupilId, date, k as RollMark);
      focusCell(row + 1, col);
    } else if (k === 'DELETE' || k === 'BACKSPACE') {
      e.preventDefault();
      setMark(pupilId, date, null);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      focusCell(row + 1, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(row - 1, col);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusCell(row, col + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusCell(row, col - 1);
    }
  };

  const typeLabel = (t: DayType, holiday: string | null) =>
    holiday ?? { school: '', weekend: tr('Weekend', 'Week-end'), holiday: tr('Holiday', 'Férié'), break: tr('Holidays', 'Vacances'), outside: '—' }[t];

  const legend: Array<[RollMark, string]> = [
    ['P', tr('Present', 'Présent')],
    ['A', tr('Absent', 'Absent')],
    ['L', tr('Late', 'Retard')],
    ['E', tr('Excused', 'Excusé')],
  ];

  return (
    <>
      <PageHeader
        title={tr('Roll call', 'Appel')}
        subtitle={tr('Daily register: click a cell or type P, A, L or E.', 'Registre quotidien : cliquez sur une case ou tapez P, A, L ou E.')}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <ClassSelect />
        <WeekSelect />
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {legend.map(([m, label]) => (
            <span key={m} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold', MARK_STYLES[m])}>{m}</span>
              {label}
            </span>
          ))}
        </div>
      </Toolbar>
      {data && !schoolCols.some(Boolean) && (
        <InfoNote tone="amber">{tr('No school days this week.', 'Aucun jour de classe cette semaine.')}</InfoNote>
      )}
      <Card>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
        ) : pupils.length === 0 ? (
          <NoPupils />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-sticky w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="sticky-col border-b border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold">
                    <div className="flex gap-3">
                      <span className="w-6 text-right">N°</span>
                      <span className="w-16">{tr('ID', 'Matricule')}</span>
                      <span>{tr('Pupil', 'Élève')}</span>
                    </div>
                  </th>
                  {days.map((d) => (
                    <th key={d.date} className={cx('border-b border-slate-200 px-1 py-2 text-center font-semibold', d.type === 'school' ? 'bg-slate-50' : 'bg-slate-100')}>
                      <div className="capitalize text-slate-700">{weekdayShort(d.date, lang)}</div>
                      <div className="text-[11px] font-normal">{dayMonth(d.date, lang)}</div>
                      {d.type === 'school' ? (
                        <button
                          type="button"
                          onClick={() => markAllPresent(d.date)}
                          className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          title={tr('Mark everyone not yet marked as present', 'Marquer présents tous les élèves non encore marqués')}
                        >
                          <CheckCheck className="h-3 w-3" /> {tr('All P', 'Tous P')}
                        </button>
                      ) : (
                        <div className={cx('mt-1 truncate text-[10px] font-semibold', d.type === 'holiday' ? 'text-orange-700' : 'text-slate-400')} title={typeLabel(d.type, d.holiday)}>
                          {typeLabel(d.type, d.holiday)}
                        </div>
                      )}
                    </th>
                  ))}
                  {(['P', 'A', 'L', 'E'] as const).map((m) => (
                    <th key={m} className="border-b border-slate-200 bg-emerald-50 px-2 py-2 text-center font-semibold text-emerald-900">
                      {m}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-emerald-50 px-2 py-2 text-center font-semibold text-emerald-900">
                    {tr('Week', 'Sem.')}
                  </th>
                  <th className="border-b border-slate-200 bg-emerald-50 px-2 py-2 text-center font-semibold text-emerald-900" title={tr('Attendance since the start of the year', 'Présence depuis la rentrée')}>
                    {tr('Year', 'Année')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((p, r) => {
                  const marks = data?.marks[p.id] ?? {};
                  const week = countMarks(days.filter((d) => d.type === 'school').map((d) => marks[d.date]));
                  const serverWeek = data?.weekTotals[p.id] ?? { P: 0, A: 0, L: 0, E: 0 };
                  const ytdServer = data?.yearToDate[p.id] ?? { P: 0, A: 0, L: 0, E: 0 };
                  const ytd = {
                    P: ytdServer.P - serverWeek.P + week.P,
                    A: ytdServer.A - serverWeek.A + week.A,
                    L: ytdServer.L - serverWeek.L + week.L,
                    E: ytdServer.E - serverWeek.E + week.E,
                  };
                  return (
                    <tr key={p.id} className="group">
                      <td className="sticky-col border-b border-slate-100 bg-white px-2 py-1 group-hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-right text-xs tabular-nums text-slate-400">{r + 1}</span>
                          <span className="w-16 text-xs font-medium tabular-nums text-slate-500">{p.studentId}</span>
                          <PupilName pupil={p} />
                        </div>
                      </td>
                      {days.map((d, c) => {
                        const m = marks[d.date];
                        if (d.type !== 'school') return <td key={d.date} className="border-b border-slate-100 bg-slate-100/80" />;
                        return (
                          <td key={d.date} className="border-b border-slate-100 px-1 py-1 text-center group-hover:bg-slate-50">
                            <button
                              type="button"
                              data-grid={gridId}
                              data-row={r}
                              data-col={c}
                              aria-label={`${p.name} — ${d.date}: ${m ?? tr('not marked', 'non marqué')}`}
                              onClick={() => setMark(p.id, d.date, CYCLE[(CYCLE.indexOf(m ?? null) + 1) % CYCLE.length])}
                              onKeyDown={(e) => onKey(e, p.id, d.date, r, c)}
                              className={cx(
                                'h-8 w-10 rounded-md border text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600',
                                m ? MARK_STYLES[m] : 'border-dashed border-slate-300 bg-white text-slate-300 hover:border-slate-400',
                              )}
                            >
                              {m ?? '·'}
                            </button>
                          </td>
                        );
                      })}
                      {(['P', 'A', 'L', 'E'] as const).map((k) => (
                        <td key={k} className="border-b border-slate-100 bg-emerald-50/40 px-2 text-center text-xs tabular-nums">
                          {week[k] || ''}
                        </td>
                      ))}
                      <td className="border-b border-slate-100 bg-emerald-50/40 px-2 text-center text-xs font-semibold tabular-nums">{fmtPct(rate(week), lang)}</td>
                      <td className="border-b border-slate-100 bg-emerald-50/40 px-2 text-center text-xs tabular-nums text-slate-600">{fmtPct(rate(ytd), lang)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <td className="sticky-col border-t border-slate-200 bg-slate-50 px-2 py-2">{tr('Present today (P + L)', 'Présents du jour (P + R)')}</td>
                  {days.map((d) => {
                    if (d.type !== 'school') return <td key={d.date} className="border-t border-slate-200 bg-slate-100/80" />;
                    const marks = pupils.map((p) => data?.marks[p.id]?.[d.date]);
                    const present = marks.filter((m) => m === 'P' || m === 'L').length;
                    const marked = marks.filter(Boolean).length;
                    return (
                      <td key={d.date} className="border-t border-slate-200 px-1 py-2 text-center tabular-nums" title={tr(`${marked} of ${pupils.length} marked`, `${marked} sur ${pupils.length} marqués`)}>
                        {present}/{pupils.length}
                        {marked < pupils.length && <div className="text-[10px] font-normal text-amber-600">{pupils.length - marked} {tr('to mark', 'à marquer')}</div>}
                      </td>
                    );
                  })}
                  <td colSpan={6} className="border-t border-slate-200" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        {tr('Attendance rate = (Present + Late) ÷ days marked.', 'Taux de présence = (Présent + Retard) ÷ jours marqués.')} {meta.settings.schoolName}
      </p>
    </>
  );
}
