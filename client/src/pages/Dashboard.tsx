import { useQuery } from '@tanstack/react-query';
import { Award, CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, FileSpreadsheet, GraduationCap, Printer, School, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CoteBadge, ErrorBox, LoadingBlock, PageHeader, StatCard, cx } from '../components/ui';
import { api } from '../lib/api';
import { MARK_STYLES, fmtDate, fmtNum, fmtPct } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { Dashboard as DashboardData } from '../lib/types';

function Bar({ value, max, tone = 'bg-school-600' }: { value: number | null; max: number; tone?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const meta = useMetaData();
  const { lang, tr } = useLang();
  const { update } = useSelection();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const d = q.data;
  const noPupils = d ? d.totals.registered === 0 : false;

  return (
    <>
      <PageHeader
        title={tr('Dashboard', 'Tableau de bord')}
        subtitle={`${meta.settings.schoolName} — ${tr('school year', 'année scolaire')} ${meta.settings.academicYear} · ${tr('as of', 'au')} ${fmtDate(meta.today.date, lang, 'long')}`}
      />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : d ? (
        <div className="space-y-5">
          {noPupils && (
            <Card className="border-school-200 bg-school-50/60">
              <CardHeader
                icon={<FileSpreadsheet className="h-5 w-5" />}
                title={tr('Getting started', 'Pour commencer')}
                subtitle={tr('Bring your School_Manager workbook into the app in three steps.', 'Importez votre classeur School_Manager en trois étapes.')}
              />
              <ol className="grid gap-3 p-5 text-sm sm:grid-cols-3">
                {[
                  { to: '/settings', icon: <FileSpreadsheet className="h-4 w-4" />, en: 'Import School_Manager.xlsx (pupils, calendar and any marks already entered).', fr: 'Importez School_Manager.xlsx (élèves, calendrier et notes déjà saisies).' },
                  { to: '/calendar', icon: <CalendarDays className="h-4 w-4" />, en: 'Check the calendar: terms, UA months and public holidays.', fr: 'Vérifiez le calendrier : trimestres, mois d’UA et jours fériés.' },
                  { to: '/roll-call', icon: <CalendarCheck className="h-4 w-4" />, en: 'Take the roll call and record marks every day.', fr: 'Faites l’appel et saisissez les notes chaque jour.' },
                ].map((s, i) => (
                  <li key={s.to}>
                    <Link to={s.to} className="flex h-full gap-3 rounded-xl border border-school-200 bg-white p-3 hover:border-school-400">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-school-700 text-xs font-bold text-white">{i + 1}</span>
                      <span className="text-slate-700">{lang === 'fr' ? s.fr : s.en}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label={tr('Enrolled pupils', 'Élèves inscrits')} value={d.totals.enrolled} hint={d.totals.registered !== d.totals.enrolled ? `${d.totals.registered} ${tr('registered', 'enregistrés')}` : undefined} icon={<Users className="h-5 w-5" />} />
            <StatCard label={tr('Classes', 'Classes')} value={d.totals.classes} icon={<School className="h-5 w-5" />} tone="sky" />
            <StatCard label={tr('General average', 'Moyenne générale')} value={d.totals.generalAverage === null ? '–' : `${fmtNum(d.totals.generalAverage, lang)}`} hint="/20" icon={<GraduationCap className="h-5 w-5" />} tone="violet" />
            <StatCard label={tr('Attendance rate', 'Taux de présence')} value={fmtPct(d.totals.attendanceRate, lang, 1)} icon={<CalendarCheck className="h-5 w-5" />} tone="school" />
            <StatCard label={tr('School days', 'Jours de classe')} value={`${d.totals.schoolDaysElapsed} / ${d.totals.schoolDays}`} hint={tr('done / total', 'écoulés / total')} icon={<CalendarDays className="h-5 w-5" />} tone="amber" />
            <StatCard label={tr('Monthly evaluations', 'Évaluations mensuelles')} value={d.totals.monthlyEvaluations} hint={tr('recorded', 'enregistrées')} icon={<Award className="h-5 w-5" />} tone="rose" />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={tr('Per-class statistics', 'Statistiques par classe')} subtitle={tr('Since the start of the year', 'Depuis la rentrée')} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="px-5 py-2 font-semibold">{tr('Class', 'Classe')}</th>
                      <th className="px-3 py-2 text-center font-semibold">{tr('Enrolled', 'Inscrits')}</th>
                      <th className="px-3 py-2 text-center font-semibold">{tr('Eval. avg /20', 'Moy. éval. /20')}</th>
                      <th className="px-3 py-2 text-center font-semibold">{tr('Controls avg /20', 'Moy. contrôles /20')}</th>
                      <th className="px-3 py-2 text-center font-semibold">{tr('Attendance', 'Présence')}</th>
                      <th className="px-3 py-2 text-center font-semibold">{tr('Evaluated', 'Évalués')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.perClass.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-2 font-semibold text-slate-800">{c.name}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{c.enrolled}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{fmtNum(c.evaluationAverage, lang)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{fmtNum(c.controlsAverage, lang)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{fmtPct(c.attendanceRate, lang, 1)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{c.studentsEvaluated}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 text-sm font-semibold">
                      <td className="px-5 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-center tabular-nums">{d.totals.enrolled}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{fmtNum(d.totals.generalAverage, lang)}</td>
                      <td className="px-3 py-2 text-center" />
                      <td className="px-3 py-2 text-center tabular-nums">{fmtPct(d.totals.attendanceRate, lang, 1)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{d.perClass.reduce((a, c) => a + c.studentsEvaluated, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<CalendarCheck className="h-5 w-5" />}
                title={tr("Today's roll call", 'Appel du jour')}
                subtitle={d.today.type === 'school' ? fmtDate(d.today.date, lang, 'day') : tr('No school today', 'Pas de classe aujourd’hui')}
              />
              {d.today.type === 'school' ? (
                <div className="space-y-2.5 p-5">
                  {d.perClass.map((c) => {
                    const done = c.enrolled > 0 && c.rollToday >= c.enrolled;
                    return (
                      <Link
                        key={c.id}
                        to="/roll-call"
                        onClick={() => update({ classId: c.id, week: d.today.week ?? undefined })}
                        className="flex items-center gap-3 rounded-lg px-1 text-sm hover:bg-slate-50"
                      >
                        <span className="w-12 font-semibold text-slate-700">{c.name}</span>
                        <Bar value={c.rollToday} max={Math.max(1, c.enrolled)} tone={done ? 'bg-school-600' : 'bg-amber-500'} />
                        <span className="w-14 text-right text-xs tabular-nums text-slate-500">
                          {done ? <CheckCircle2 className="ml-auto h-4 w-4 text-school-600" /> : `${c.rollToday}/${c.enrolled}`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="p-5 text-sm text-slate-500">{d.today.holiday ?? tr('Enjoy the break!', 'Bonnes vacances !')}</p>
              )}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader icon={<ClipboardCheck className="h-5 w-5" />} title={tr('Weekly controls', 'Contrôles hebdo.')} subtitle={tr('Subject averages /20', 'Moyennes par matière /20')} />
              <div className="space-y-3 p-5">
                {d.subjectAverages.map((s) => (
                  <div key={s.code}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{lang === 'fr' ? s.label_fr : s.label_en}</span>
                      <span className="font-semibold tabular-nums">{fmtNum(s.average, lang)}</span>
                    </div>
                    <Bar value={s.average} max={20} />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={<TrendingUp className="h-5 w-5" />} title={tr('Daily performance', 'Performance quotidienne')} subtitle={tr('Area averages /10', 'Moyennes par domaine /10')} />
              <div className="space-y-2.5 p-5">
                {d.areaAverages.map((a) => (
                  <div key={a.code}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{lang === 'fr' ? a.label_fr : a.label_en}</span>
                      <span className="font-semibold tabular-nums">{fmtNum(a.average, lang)}</span>
                    </div>
                    <Bar value={a.average} max={10} tone="bg-sky-600" />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={<Award className="h-5 w-5" />} title={tr('Cote distribution', 'Répartition des cotes')} subtitle={tr('Monthly evaluations', 'Évaluations mensuelles')} />
              <div className="space-y-3 p-5">
                {d.coteDistribution.map((c) => (
                  <div key={c.code} className="flex items-center gap-3 text-sm">
                    <CoteBadge code={c.code} />
                    <span className="flex-1 text-slate-600">{lang === 'fr' ? c.fr : c.en}</span>
                    <span className="font-semibold tabular-nums">{c.count}</span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-slate-400">A+ ≥ 90% · A ≥ 75% · ECA/B ≥ 50% · NA &lt; 50%</p>
              </div>
            </Card>
            <Card>
              <CardHeader icon={<CalendarCheck className="h-5 w-5" />} title={tr('Roll marks recorded', 'Marques d’appel')} />
              <div className="space-y-3 p-5">
                {(
                  [
                    ['P', tr('Present', 'Présent')],
                    ['A', tr('Absent', 'Absent')],
                    ['L', tr('Late', 'Retard')],
                    ['E', tr('Excused', 'Excusé')],
                  ] as const
                ).map(([m, label]) => (
                  <div key={m} className="flex items-center gap-3 text-sm">
                    <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold', MARK_STYLES[m])}>{m}</span>
                    <span className="flex-1 text-slate-600">{label}</span>
                    <span className="font-semibold tabular-nums">{d.rollMarks[m]}</span>
                  </div>
                ))}
                <Link to="/report-cards" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-school-700 hover:underline">
                  <Printer className="h-4 w-4" /> {tr('Print report cards', 'Imprimer les bulletins')}
                </Link>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
