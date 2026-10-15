import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AverageRow, InfoNote, NoPupils } from '../components/Common';
import { MarkGrid } from '../components/MarkGrid';
import { ClassSelect, MonthSelect } from '../components/Selectors';
import { Card, CoteBadge, ErrorBox, LoadingBlock, PageHeader, SaveIndicator, Tabs, Toolbar } from '../components/ui';
import { fmtMark, fmtNum, mean, monthLabel } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { evaluate, overall, useMarks } from '../lib/marks';
import { useSelection } from '../lib/selection';

export default function TermMarks() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const [tab, setTab] = useState<'marks' | 'attitudes'>('marks');
  const { query: q, saver, setMark, setGrade } = useMarks(sel.classId, sel.uaMonth);
  const fw = meta.framework;
  const { cotes, academicWeight } = meta.settings;
  const month = meta.calendar.months.find((m) => m.key === sel.uaMonth);

  const pupils = q.data?.pupils ?? [];
  const evals = new Map(pupils.map((p) => [p.id, evaluate(q.data?.values[p.id], fw.disciplines, fw.competences, fw.totalMax, cotes)]));
  const perf = (id: number) => q.data?.performance[id] ?? null;
  const overallOf = (id: number) => overall(evals.get(id)?.average ?? null, perf(id), academicWeight);

  const groupHeader = (
    <tr className="text-[11px] uppercase tracking-wide text-slate-500">
      <th className="sticky-col border-b border-slate-200 bg-white" />
      {fw.competences.map((c) => (
        <th
          key={c.number}
          colSpan={fw.disciplines.filter((d) => d.competence === c.number).length}
          className="border-b border-l border-slate-200 bg-white px-1 py-1.5 text-center font-semibold"
          title={lang === 'fr' ? c.title_fr : c.title_en}
        >
          C{c.number} · {lang === 'fr' ? c.short_fr : c.short_en}
        </th>
      ))}
      <th colSpan={fw.competences.length + 5} className="border-b border-l border-slate-200 bg-white px-1 py-1.5 text-center font-semibold text-emerald-800">
        {tr('Automatic results', 'Résultats automatiques')}
      </th>
    </tr>
  );

  return (
    <>
      <PageHeader
        title={tr('Term marks', 'Notes trimestrielles')}
        subtitle={tr(
          `Full framework /${fw.totalMax} for one UA month. Each month becomes UA1–UA3 on the term report card.`,
          `Référentiel complet /${fw.totalMax} pour un mois d’UA. Chaque mois devient UA1–UA3 sur le bulletin trimestriel.`,
        )}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <ClassSelect />
        <MonthSelect uaOnly />
        <div className="ml-auto self-center">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'marks', label: tr('Disciplines', 'Disciplines') },
              { value: 'attitudes', label: tr('Attitudes (A+ to C)', 'Attitudes (A+ à C)') },
            ]}
          />
        </div>
      </Toolbar>
      {tab === 'marks' && (
        <InfoNote>
          {tr('Grey columns come from', 'Les colonnes grises viennent des')}{' '}
          <Link to="/monthly-marks" className="font-semibold text-emerald-700 underline">
            {tr('Monthly marks', 'Notes mensuelles')}
          </Link>{' '}
          ({monthLabel(month, lang)}).{' '}
          {tr('Here you only type 1C (national language), 3A, 3B, 6A1 and 6B.', 'Ici, vous saisissez seulement 1C (langue nationale), 3A, 3B, 6A1 et 6B.')}
        </InfoNote>
      )}
      <Card>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
        ) : pupils.length === 0 ? (
          <NoPupils />
        ) : tab === 'marks' ? (
          <MarkGrid
            pupils={pupils}
            groupHeader={groupHeader}
            columns={fw.disciplines.map((d) => ({
              key: d.code,
              header: d.code,
              sub: `/${d.max}`,
              max: d.max,
              readOnly: d.on_monthly_card,
              title: `${d.label}${d.on_monthly_card ? ` — ${tr('entered in Monthly marks', 'saisi dans Notes mensuelles')}` : ''}`,
            }))}
            getValue={(id, code) => q.data?.values[id]?.[code]}
            onChange={setMark}
            computed={[
              ...fw.competences.map((c) => ({
                key: `c${c.number}`,
                header: `C${c.number}`,
                sub: `/${c.max}`,
                render: (p: { id: number }) => fmtMark(evals.get(p.id)?.competences[c.number], lang) || '–',
              })),
              { key: 'total', header: 'Total', sub: `/${fw.totalMax}`, render: (p) => <span className="font-semibold">{fmtMark(evals.get(p.id)?.total, lang) || '–'}</span> },
              { key: 'avg', header: tr('Average', 'Moyenne'), sub: '/20', render: (p) => <span className="font-semibold">{fmtNum(evals.get(p.id)?.average, lang)}</span> },
              { key: 'cote', header: 'Cote', render: (p) => <CoteBadge code={evals.get(p.id)?.cote} /> },
              { key: 'perf', header: 'Perf.', sub: '/10', render: (p) => fmtNum(perf(p.id), lang) },
              { key: 'overall', header: tr('Overall', 'Global'), sub: '/20', render: (p) => <span className="font-bold text-emerald-900">{fmtNum(overallOf(p.id), lang)}</span> },
            ]}
            footer={
              <AverageRow
                label={tr('Class average', 'Moyenne de la classe')}
                values={[
                  ...fw.disciplines.map((d) => mean(pupils.map((p) => q.data?.values[p.id]?.[d.code]))),
                  ...fw.competences.map((c) => mean(pupils.map((p) => evals.get(p.id)?.competences[c.number]))),
                  mean(pupils.map((p) => evals.get(p.id)?.total)),
                  mean(pupils.map((p) => evals.get(p.id)?.average)),
                  null,
                  mean(pupils.map((p) => perf(p.id))),
                  mean(pupils.map((p) => overallOf(p.id))),
                ]}
              />
            }
          />
        ) : (
          <MarkGrid
            pupils={pupils}
            columns={fw.attitudes.map((a) => ({ key: a.code, header: lang === 'fr' ? a.label_fr : a.label_en, max: 0, kind: 'grade' as const }))}
            grades={meta.attitudeGrades}
            getValue={() => null}
            getGrade={(id, code) => q.data?.attitudes[id]?.[code]}
            onChange={() => {}}
            onGrade={setGrade}
          />
        )}
      </Card>
    </>
  );
}
