import { useQuery } from '@tanstack/react-query';
import { NoPupils } from '../components/Common';
import { CountsBar, RankCell, ReportActions, ReportTable, exportReportCsv, type ReportColumn } from '../components/ReportTable';
import { ClassSelect, MonthSelect } from '../components/Selectors';
import { Card, CoteBadge, ErrorBox, LoadingBlock, PageHeader, Toolbar } from '../components/ui';
import { api, qs } from '../lib/api';
import { round2 } from '../lib/csv';
import { fmtDate, fmtMark, fmtNum, fmtPct, monthLabel } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { MonthlyReport as Report } from '../lib/types';

type Row = Report['rows'][number];

export default function MonthlyReport() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const q = useQuery({
    queryKey: ['report-monthly', sel.classId, sel.month],
    queryFn: () => api.get<Report>(`/reports/monthly?${qs({ classId: sel.classId, month: sel.month })}`),
  });
  const r = q.data;
  const fw = meta.framework;
  const competences = fw.competences.filter((c) => c.monthlyMax > 0);
  const evalGroup = tr(`Monthly competence evaluation (/${fw.monthlyMax})`, `Évaluation mensuelle des compétences (/${fw.monthlyMax})`);
  const ctrlGroup = tr('Weekly control avgs (/20)', 'Moy. contrôles hebdo. (/20)');
  const attGroup = tr('Attendance (month)', 'Présence (mois)');

  const columns: Array<ReportColumn<Row>> = r
    ? [
        { key: 'n', header: 'N°', csvHeader: 'N°', align: 'left', render: (x) => x.n, csv: (x) => x.n, className: 'text-slate-400' },
        { key: 'id', header: tr('ID', 'Matricule'), csvHeader: 'Student ID', align: 'left', render: (x) => x.studentId, csv: (x) => x.studentId, className: 'whitespace-nowrap text-xs text-slate-500' },
        { key: 'name', header: tr('Names & surnames', 'Noms et prénoms'), csvHeader: 'Names & Surnames', align: 'left', render: (x) => <span className="font-medium">{x.name}</span>, csv: (x) => x.name, className: 'min-w-44' },
        ...competences.map<ReportColumn<Row>>((c) => ({
          key: `c${c.number}`,
          group: evalGroup,
          header: `C${c.number} /${c.monthlyMax}`,
          csvHeader: `C${c.number} /${c.monthlyMax}`,
          render: (x) => fmtMark(x.competences[c.number], lang) || '–',
          csv: (x) => x.competences[c.number],
          stats: r.footer.competences[c.number],
        })),
        { key: 'total', group: evalGroup, header: `Total /${fw.monthlyMax}`, csvHeader: `Total /${fw.monthlyMax}`, render: (x) => <span className="font-semibold">{fmtMark(x.total, lang) || '–'}</span>, csv: (x) => x.total, stats: r.footer.total },
        { key: 'avg', group: evalGroup, header: tr('Avg /20', 'Moy. /20'), csvHeader: 'Average /20', render: (x) => <span className="font-semibold">{fmtNum(x.average, lang)}</span>, csv: (x) => round2(x.average), stats: r.footer.average },
        { key: 'cote', group: evalGroup, header: 'Cote', csvHeader: 'Cote', render: (x) => <CoteBadge code={x.cote} />, csv: (x) => x.cote },
        ...fw.subjects.map<ReportColumn<Row>>((s) => ({
          key: `s-${s.code}`,
          group: ctrlGroup,
          header: lang === 'fr' ? s.short_fr : s.short_en,
          csvHeader: s.label_en,
          render: (x) => fmtNum(x.controls[s.code], lang, 1),
          csv: (x) => round2(x.controls[s.code]),
          stats: r.footer.controls[s.code],
        })),
        {
          key: 'perf',
          group: tr('Daily perf.', 'Perf. quotidienne'),
          header: tr('Avg /10', 'Moy. /10'),
          csvHeader: 'Performance avg /10',
          render: (x) => fmtNum(x.performanceAverage, lang),
          csv: (x) => round2(x.performanceAverage),
          stats: r.footer.performanceAverage,
        },
        ...(['P', 'A', 'L'] as const).map<ReportColumn<Row>>((m) => ({
          key: `a-${m}`,
          group: attGroup,
          header: m,
          csvHeader: m,
          render: (x) => x.attendance[m],
          csv: (x) => x.attendance[m],
          stats: r.footer.attendance[m],
        })),
        {
          key: 'rate',
          group: attGroup,
          header: '%',
          csvHeader: 'Attendance %',
          render: (x) => fmtPct(x.attendance.rate, lang),
          csv: (x) => round2(x.attendance.rate === null ? null : x.attendance.rate * 100),
          stats: r.footer.attendance.rate,
          format: (v) => fmtPct(v, lang),
        },
        {
          key: 'overall',
          group: tr('Overall & rank', 'Global & rang'),
          header: tr('Overall /20', 'Global /20'),
          csvHeader: 'Overall /20',
          render: (x) => <span className="font-bold text-emerald-900">{fmtNum(x.overall, lang)}</span>,
          csv: (x) => round2(x.overall),
          stats: r.footer.overall,
        },
        { key: 'rank', group: tr('Overall & rank', 'Global & rang'), header: tr('Rank', 'Rang'), csvHeader: 'Rank', render: (x) => <RankCell rank={x.rank} />, csv: (x) => x.rank },
      ]
    : [];

  return (
    <div className="print-landscape">
      <PageHeader
        title={tr('Monthly class report', 'Rapport mensuel de la classe')}
        subtitle={
          r
            ? `${r.class.name} · ${monthLabel(r.month, lang)} · ${tr('from', 'du')} ${fmtDate(r.month.firstDay, lang)} ${tr('to', 'au')} ${fmtDate(r.month.lastDay, lang)} · W${r.month.weekFrom} – W${r.month.weekTo}`
            : undefined
        }
        actions={r && <ReportActions onCsv={() => exportReportCsv(`monthly-report-${r.class.code}-${r.month.key}.csv`, columns, r.rows)} />}
      />
      <Toolbar>
        <ClassSelect />
        <MonthSelect />
        <p className="pb-2 text-xs text-slate-500">
          {tr('Competences 3 & 6 are on the Term report. Rank = overall score.', 'Les compétences 3 et 6 sont dans le rapport trimestriel. Rang = score global.')}
        </p>
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
                [tr('Students evaluated', 'Élèves évalués'), r.counts.studentsEvaluated],
                [tr('Controls logged', 'Contrôles saisis'), r.counts.controlsLogged],
                [tr('Performance entries', 'Saisies de performance'), r.counts.performanceEntries],
                [tr('School days', 'Jours de classe'), r.counts.schoolDays],
                [tr('Class general average /20', 'Moyenne générale de la classe /20'), fmtNum(r.counts.classAverage, lang)],
              ]}
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}
