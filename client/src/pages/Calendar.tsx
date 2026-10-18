import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, CardHeader, ErrorBox, Field, Input, LoadingBlock, PageHeader, Select, StatCard, cx, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fmtDate, monthLabel } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { CalendarData, CalendarDay } from '../lib/types';

const TYPE_STYLE: Record<string, string> = {
  school: 'bg-green-100 text-green-900',
  weekend: 'bg-slate-100 text-slate-400',
  holiday: 'bg-orange-200 text-orange-900 font-semibold',
  break: 'bg-yellow-100 text-yellow-800',
  outside: 'bg-white text-slate-300',
};

function MonthGrid({ month, days, today, lang }: { month: CalendarData['months'][number]; days: CalendarDay[]; today: string; lang: 'en' | 'fr' }) {
  const monthDays = days.filter((d) => d.month === month.key);
  if (!monthDays.length) return null;
  const firstDow = (monthDays[0].dow + 6) % 7; // Monday = 0
  const cells: Array<CalendarDay | null> = [...Array(firstDow).fill(null), ...monthDays];
  while (cells.length % 7) cells.push(null);
  const weeks: Array<Array<CalendarDay | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const heads = lang === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{monthLabel(month, lang)}</h3>
        <span className="text-xs text-slate-500">
          {month.schoolDays} {lang === 'fr' ? 'jours' : 'days'}
          {month.uaTerm ? ` · UA${month.uaIndex} T${month.uaTerm}` : ''}
        </span>
      </div>
      <table className="w-full table-fixed text-center text-[11px]">
        <thead>
          <tr className="text-slate-400">
            <th className="w-7 font-normal">W</th>
            {heads.map((h, i) => (
              <th key={i} className="font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              <td className="text-[10px] text-slate-400">{w.find((d) => d)?.week ?? ''}</td>
              {w.map((d, j) => (
                <td key={j} className="p-0.5">
                  {d && (
                    <div
                      title={d.holiday ?? d.type}
                      className={cx('rounded py-1 tabular-nums', TYPE_STYLE[d.type], d.date === today && 'ring-2 ring-school-700')}
                    >
                      {Number(d.date.slice(8))}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function CalendarPage() {
  const { lang, tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['calendar'], queryFn: () => api.get<CalendarData>('/calendar') });
  const data = q.data;

  const [year, setYear] = useState({ yearStart: '', yearEnd: '', week1Start: '' });
  const [terms, setTerms] = useState<Array<{ number: number; name: string; startDate: string; endDate: string; uaMonths: string[] }>>([]);
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setYear(data.year);
    setTerms(data.terms.map((t) => ({ number: t.number, name: t.name, startDate: t.start, endDate: t.end, uaMonths: [...t.uaMonths, '', '', ''].slice(0, 3) })));
  }, [data]);

  const refreshAll = () => qc.invalidateQueries();

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      await refreshAll();
      toast.success(success);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const saveYear = (e: FormEvent) => {
    e.preventDefault();
    void run('year', () => api.put('/calendar/year', year), tr('School year saved', 'Année scolaire enregistrée'));
  };
  const saveTerms = () =>
    run(
      'terms',
      () => api.put('/calendar/terms', { terms: terms.map((t) => ({ ...t, uaMonths: t.uaMonths.filter(Boolean) })) }),
      tr('Terms saved', 'Trimestres enregistrés'),
    );
  const addHoliday = (e: FormEvent) => {
    e.preventDefault();
    void run('holiday', () => api.post('/calendar/holidays', holiday), tr('Holiday added', 'Jour férié ajouté')).then(() => setHoliday({ date: '', name: '' }));
  };
  const removeHoliday = (date: string) => run(`del-${date}`, () => api.del(`/calendar/holidays/${date}`), tr('Holiday removed', 'Jour férié supprimé'));

  if (q.isPending) return <LoadingBlock />;
  if (q.error || !data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  const legend: Array<[string, string]> = [
    ['school', tr('School day', 'Jour de classe')],
    ['weekend', tr('Weekend', 'Week-end')],
    ['holiday', tr('Public holiday', 'Jour férié')],
    ['break', tr('Break', 'Vacances')],
  ];

  return (
    <>
      <PageHeader
        title={tr('School calendar', 'Calendrier scolaire')}
        subtitle={tr(`Weeks are numbered from Monday ${fmtDate(data.year.week1Start, 'en')}.`, `Les semaines sont numérotées à partir du lundi ${fmtDate(data.year.week1Start, 'fr')}.`)}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={tr('School days', 'Jours de classe')} value={data.summary.schoolDays} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label={tr('Public holidays', 'Jours fériés')} value={data.summary.publicHolidays} tone="amber" />
        <StatCard label={tr('Break weekdays', 'Jours de vacances')} value={data.summary.breakWeekdays} tone="sky" />
        <StatCard label={tr('First – last day', 'Premier – dernier jour')} value={<span className="text-base">{fmtDate(data.summary.firstSchoolDay, lang)} – {fmtDate(data.summary.lastSchoolDay, lang)}</span>} tone="slate" />
      </div>

      <Card className="mb-5">
          <CardHeader
            title={tr('Terms & UA months', 'Trimestres & mois d’UA')}
            subtitle={tr('The UA months become UA1–UA3 on the term report card.', 'Les mois d’UA deviennent UA1–UA3 sur le bulletin trimestriel.')}
            actions={
              <Button size="sm" icon={<Save className="h-4 w-4" />} onClick={saveTerms} loading={busy === 'terms'}>
                {tr('Save terms', 'Enregistrer')}
              </Button>
            }
          />
          <div className="overflow-x-auto p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-2 py-1">{tr('Term', 'Trimestre')}</th>
                  <th className="px-2 py-1">{tr('Start', 'Début')}</th>
                  <th className="px-2 py-1">{tr('End', 'Fin')}</th>
                  <th className="px-2 py-1">UA1</th>
                  <th className="px-2 py-1">UA2</th>
                  <th className="px-2 py-1">UA3</th>
                  <th className="px-2 py-1 text-center">{tr('Days', 'Jours')}</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t, i) => (
                  <tr key={t.number}>
                    <td className="px-1 py-1">
                      <Input value={t.name} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="w-28" />
                    </td>
                    <td className="px-1 py-1">
                      <Input type="date" value={t.startDate} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, startDate: e.target.value } : x)))} />
                    </td>
                    <td className="px-1 py-1">
                      <Input type="date" value={t.endDate} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, endDate: e.target.value } : x)))} />
                    </td>
                    {[0, 1, 2].map((k) => (
                      <td key={k} className="px-1 py-1">
                        <Select
                          value={t.uaMonths[k]}
                          onChange={(e) =>
                            setTerms(terms.map((x, j) => (j === i ? { ...x, uaMonths: x.uaMonths.map((m, n) => (n === k ? e.target.value : m)) } : x)))
                          }
                          className="w-40"
                        >
                          <option value="">—</option>
                          {data.months.map((m) => (
                            <option key={m.key} value={m.key}>
                              {monthLabel(m, lang)}
                            </option>
                          ))}
                        </Select>
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center tabular-nums">{data.terms.find((x) => x.number === t.number)?.schoolDays ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-5">
        <Card>
          <CardHeader title={tr('School year', 'Année scolaire')} />
          <form onSubmit={saveYear} className="space-y-3 p-5">
            <Field label={tr('Calendar starts', 'Début du calendrier')}>
              <Input type="date" value={year.yearStart} onChange={(e) => setYear({ ...year, yearStart: e.target.value })} required />
            </Field>
            <Field label={tr('Calendar ends', 'Fin du calendrier')}>
              <Input type="date" value={year.yearEnd} onChange={(e) => setYear({ ...year, yearEnd: e.target.value })} required />
            </Field>
            <Field label={tr('Monday of week 1 (W1)', 'Lundi de la semaine 1 (W1)')}>
              <Input type="date" value={year.week1Start} onChange={(e) => setYear({ ...year, week1Start: e.target.value })} required />
            </Field>
            <Button type="submit" icon={<Save className="h-4 w-4" />} loading={busy === 'year'}>
              {tr('Save', 'Enregistrer')}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={tr('Public holidays', 'Jours fériés')} subtitle={`${data.holidays.length}`} />
          <form onSubmit={addHoliday} className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
            <Field label="Date">
              <Input type="date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} required min={data.year.yearStart} max={data.year.yearEnd} />
            </Field>
            <Field label={tr('Name', 'Nom')} className="min-w-40 flex-1">
              <Input value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} required placeholder="Fête…" />
            </Field>
            <Button type="submit" icon={<Plus className="h-4 w-4" />} loading={busy === 'holiday'}>
              {tr('Add', 'Ajouter')}
            </Button>
          </form>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data.holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-28 shrink-0 tabular-nums text-slate-500">{fmtDate(h.date, lang)}</span>
                <span className="flex-1">{h.name}</span>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => removeHoliday(h.date)}
                  aria-label={tr('Remove', 'Supprimer')}
                  disabled={busy === `del-${h.date}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
        </div>
        <div className="xl:col-span-2">
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            {legend.map(([type, label]) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className={cx('inline-block h-4 w-4 rounded', TYPE_STYLE[type])} /> {label}
              </span>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {data.months.map((m) => (
              <MonthGrid key={m.key} month={m} days={data.days} today={data.today.date} lang={lang} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
