import { CircleAlert } from 'lucide-react';
import { AverageRow, InfoNote, NoPupils } from '../components/Common';
import { MarkGrid } from '../components/MarkGrid';
import { ClassSelect, MonthSelect } from '../components/Selectors';
import { Card, CoteBadge, ErrorBox, LoadingBlock, PageHeader, SaveIndicator, Toolbar } from '../components/ui';
import { fmtMark, fmtNum, mean, monthLabel } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { evaluate, overall, useMarks } from '../lib/marks';
import { useSelection } from '../lib/selection';

export default function MonthlyMarks() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const { query: q, saver, setMark } = useMarks(sel.classId, sel.month);
  const fw = meta.framework;
  const disciplines = fw.monthlyDisciplines;
  const competences = fw.competences.filter((c) => c.monthlyMax > 0);
  const { cotes, academicWeight } = meta.settings;
  const month = meta.calendar.months.find((m) => m.key === sel.month);

  const pupils = q.data?.pupils ?? [];
  const evals = new Map(pupils.map((p) => [p.id, evaluate(q.data?.values[p.id], disciplines, competences, fw.monthlyMax, cotes)]));
  const perf = (id: number) => q.data?.performance[id] ?? null;
  const overallOf = (id: number) => overall(evals.get(id)?.average ?? null, perf(id), academicWeight);

  const groupHeader = (
    <tr className="text-[11px] uppercase tracking-wide text-slate-500">
      <th className="sticky-col border-b border-slate-200 bg-white" />
      {competences.map((c) => {
        const span = disciplines.filter((d) => d.competence === c.number).length;
        return (
          <th key={c.number} colSpan={span} className="border-b border-l border-slate-200 bg-white px-1 py-1.5 text-center font-semibold" title={lang === 'fr' ? c.title_fr : c.title_en}>
            C{c.number} · {lang === 'fr' ? c.short_fr : c.short_en}
          </th>
        );
      })}
      <th colSpan={competences.length + 6} className="border-b border-l border-slate-200 bg-white px-1 py-1.5 text-center font-semibold text-school-800">
        {tr('Automatic results', 'Résultats automatiques')}
      </th>
    </tr>
  );

  return (
    <>
      <PageHeader
        title={tr('Monthly marks', 'Notes mensuelles')}
        subtitle={tr(
          `Marks shown on the monthly report card: Competences 1 (French & English), 2, 4 and 5 — total /${fw.monthlyMax}.`,
          `Notes du bulletin mensuel : compétences 1 (français et anglais), 2, 4 et 5 — total /${fw.monthlyMax}.`,
        )}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <ClassSelect />
        <MonthSelect />
        {month && (
          <div className="pb-2 text-xs text-slate-500">
            {month.uaTerm
              ? tr(`Counts as UA${month.uaIndex} of Term ${month.uaTerm}`, `Compte comme UA${month.uaIndex} du trimestre ${month.uaTerm}`)
              : tr('Not a UA month — it will not appear on a term card', 'Pas un mois d’UA — n’apparaît pas sur un bulletin trimestriel')}
          </div>
        )}
      </Toolbar>
      <InfoNote>
        {tr(
          'National language, Competences 3 & 6 and the attitude grades are entered in "Term marks" — they feed the term report card.',
          'La langue nationale, les compétences 3 et 6 et les attitudes se saisissent dans « Notes trimestrielles » — elles alimentent le bulletin trimestriel.',
        )}
      </InfoNote>
      <Card>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
        ) : pupils.length === 0 ? (
          <NoPupils />
        ) : (
          <MarkGrid
            pupils={pupils}
            groupHeader={groupHeader}
            columns={disciplines.map((d) => ({
              key: d.code,
              header: d.code,
              sub: `${lang === 'fr' ? d.short_fr : d.short_en} /${d.max}`,
              max: d.max,
              title: d.label,
            }))}
            getValue={(id, code) => q.data?.values[id]?.[code]}
            onChange={setMark}
            computed={[
              ...competences.map((c) => ({
                key: `c${c.number}`,
                header: `C${c.number}`,
                sub: `/${c.monthlyMax}`,
                render: (p: { id: number }) => fmtMark(evals.get(p.id)?.competences[c.number], lang) || '–',
              })),
              {
                key: 'total',
                header: tr('Total', 'Total'),
                sub: `/${fw.monthlyMax}`,
                render: (p) => {
                  const e = evals.get(p.id);
                  return (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {fmtMark(e?.total, lang) || '–'}
                      {e && e.entered > 0 && !e.complete && (
                        <span title={tr(`${e.entered}/${disciplines.length} marks entered`, `${e.entered}/${disciplines.length} notes saisies`)}>
                          <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </span>
                  );
                },
              },
              { key: 'avg', header: tr('Average', 'Moyenne'), sub: '/20', render: (p) => <span className="font-semibold">{fmtNum(evals.get(p.id)?.average, lang)}</span> },
              { key: 'cote', header: 'Cote', render: (p) => <CoteBadge code={evals.get(p.id)?.cote} /> },
              { key: 'perf', header: tr('Perf.', 'Perf.'), sub: '/10', render: (p) => fmtNum(perf(p.id), lang) },
              { key: 'overall', header: tr('Overall', 'Global'), sub: `/20 (${Math.round(academicWeight * 100)}/${Math.round((1 - academicWeight) * 100)})`, render: (p) => <span className="font-bold text-school-900">{fmtNum(overallOf(p.id), lang)}</span> },
            ]}
            footer={
              <AverageRow
                label={tr('Class average', 'Moyenne de la classe')}
                values={[
                  ...disciplines.map((d) => mean(pupils.map((p) => q.data?.values[p.id]?.[d.code]))),
                  ...competences.map((c) => mean(pupils.map((p) => evals.get(p.id)?.competences[c.number]))),
                  mean(pupils.map((p) => evals.get(p.id)?.total)),
                  mean(pupils.map((p) => evals.get(p.id)?.average)),
                  null,
                  mean(pupils.map((p) => perf(p.id))),
                  mean(pupils.map((p) => overallOf(p.id))),
                ]}
              />
            }
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        {tr('Daily-performance average for', 'Moyenne de performance quotidienne de')} {monthLabel(month, lang)} ·{' '}
        {tr(
          `Overall = ${Math.round(academicWeight * 100)}% academic average + ${Math.round((1 - academicWeight) * 100)}% performance (rescaled /20).`,
          `Global = ${Math.round(academicWeight * 100)} % moyenne académique + ${Math.round((1 - academicWeight) * 100)} % performance (ramenée sur 20).`,
        )}
      </p>
    </>
  );
}
