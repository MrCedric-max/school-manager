import { useQuery } from '@tanstack/react-query';
import { NoPupils } from '../components/Common';
import { CountsBar, RankCell, ReportActions, ReportTable, exportReportCsv, type ReportColumn } from '../components/ReportTable';
import { ClassSelect, WeekSelect } from '../components/Selectors';
import { Card, CoteBadge, ErrorBox, LoadingBlock, PageHeader, Toolbar } from '../components/ui';
import { api, qs } from '../lib/api';
import { round2 } from '../lib/csv';
import { dayMonth, fmtDate, fmtNum, fmtPct } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { WeeklyReport as Report } from '../lib/types';

type Row = Report['rows'][number];

export default function WeeklyReport() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const q = useQuery({
    queryKey: ['report-weekly', sel.classId, sel.week],
    queryFn: () => api.get<Report>(`/reports/weekly?${qs({ classId: sel.classId, week: sel.week })}`),
  });
  const r = q.data;
  const { subjects, areas } = meta.framework;

  const columns: Array<ReportColumn<Row>> = r
    ? [
        { key: 'n', header: 'N°', csvHeader: 'N°', align: 'left', render: (x) => x.n, csv: (x) => x.n, className: 'text-slate-400' },
        { key: 'id', header: tr('ID', 'Matricule'), csvHeader: 'Student ID', align: 'left', render: (x) => x.studentId, csv: (x) => x.studentId, className: 'whitespace-nowrap text-xs text-slate-500' },
        { key: 'name', header: tr('Names & surnames', 'Noms et prénoms'), csvHeader: 'Names & Surnames', align: 'left', render: (x) => <span className="font-medium">{x.name}</span>, csv: (x) => x.name, className: 'min-w-44' },
        ...subjects.map<ReportColumn<Row>>((s) => ({
          key: `c-${s.code}`,
          group: tr('Weekly controls (/20)', 'Contrôles hebdo. (/20)'),
          header: lang === 'fr' ? s.short_fr : s.short_en,
          csvHeader: s.label_en,
          render: (x) => fmtNum(x.controls[s.code], lang, 1),
          csv: (x) => x.controls[s.code],
          stats: r.footer.controls[s.code],
        })),
        {
          key: 'cavg',
          group: tr('Weekly controls (/20)', 'Contrôles hebdo. (/20)'),
          header: tr('Avg /20', 'Moy. /20'),
          csvHeader: 'Controls avg /20',
          render: (x) => (
            <span className="inline-flex items-center gap-1 font-semibold">
              {fmtNum(x.controlsAverage, lang)} <CoteBadge code={x.controlsCote} className="hidden sm:inline-flex" />
            </span>
          ),
          csv: (x) => round2(x.controlsAverage),
          stats: r.footer.controlsAverage,
        },
        ...areas.map<ReportColumn<Row>>((a) => ({
          key: `p-${a.code}`,
          group: tr('Daily performance (/10)', 'Performance quotidienne (/10)'),
          header: lang === 'fr' ? a.label_fr : a.label_en,
          csvHeader: a.label_en,
          render: (x) => fmtNum(x.performance[a.code], lang, 1),
          csv: (x) => round2(x.performance[a.code]),
          stats: r.footer.performance[a.code],
        })),
        {
          key: 'pavg',
          group: tr('Daily performance (/10)', 'Performance quotidienne (/10)'),
          header: tr('Avg /10', 'Moy. /10'),
          csvHeader: 'Performance avg /10',
          render: (x) => <span className="font-semibold">{fmtNum(x.performanceAverage, lang)}</span>,
          csv: (x) => round2(x.performanceAverage),
          stats: r.footer.performanceAverage,
        },
        ...(['P', 'A', 'L'] as const).map<ReportColumn<Row>>((m) => ({
          key: `a-${m}`,
          group: tr('Attendance (week)', 'Présence (semaine)'),
          header: m,
          csvHeader: m,
          render: (x) => x.attendance[m],
          csv: (x) => x.attendance[m],
        })),
        {
          key: 'rate',
          group: tr('Attendance (week)', 'Présence (semaine)'),
          header: '%',
          csvHeader: 'Attendance %',
          render: (x) => fmtPct(x.attendance.rate, lang),
          csv: (x) => round2(x.attendance.rate === null ? null : x.attendance.rate * 100),
          stats: r.footer.attendanceRate,
          format: (v) => fmtPct(v, lang),
        },
        { key: 'rank', group: tr('Rank', 'Rang'), header: tr('Rank', 'Rang'), csvHeader: 'Rank', render: (x) => <RankCell rank={x.rank} />, csv: (x) => x.rank },
      ]
    : [];

  return (
    <div className="print-landscape">
      <PageHeader
        title={tr('Weekly class report', 'Rapport hebdomadaire de la classe')}
        subtitle={
          r
            ? `${r.class.name} · W${r.week.number} · ${tr('from', 'du')} ${fmtDate(r.week.monday, lang)} ${tr('to', 'au')} ${fmtDate(r.week.friday, lang)}${
                r.week.term ? ` · ${tr('Term', 'Trimestre')} ${r.week.term}` : ''
              }`
            : undefined
        }
        actions={r && <ReportActions onCsv={() => exportReportCsv(`weekly-report-${r.class.code}-W${r.week.number}.csv`, columns, r.rows)} />}
      />
      <Toolbar>
        <ClassSelect />
        <WeekSelect />
        <p className="pb-2 text-xs text-slate-500">{tr('Rank = weekly controls average.', 'Rang = moyenne des contrôles de la semaine.')}</p>
      </Toolbar>
      <Card className="print-plain">
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
        ) : r && r.rows.length === 0 ? (
          <NoPupils />
        ) : r ? (
          <>
            <ReportTable rows={r.rows} columns={columns} />
            <CountsBar
              items={[
                [tr('School days', 'Jours de classe'), `${r.counts.schoolDays} (${r.week.dates.map((d) => dayMonth(d, lang)).join(', ') || '—'})`],
                [tr('Controls logged', 'Contrôles saisis'), r.counts.controlsLogged],
                [tr('Performance entries', 'Saisies de performance'), r.counts.performanceEntries],
                [tr('Roll marks', 'Marques d’appel'), r.counts.rollMarks],
              ]}
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}
