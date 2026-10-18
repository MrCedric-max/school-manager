import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClassSelect, MonthSelect, WeekSelect } from '../components/Selectors';
import { Card, CardHeader, ErrorBox, LoadingBlock, PageHeader, Toolbar } from '../components/ui';
import { api, qs } from '../lib/api';
import { fmtNum, fmtPct, monthLabel } from '../lib/format';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { Lang, Statistics as Stats, SuccessRow } from '../lib/types';

// Charts use the school colours (see index.css): the navy of the crest, its sky blue for contrast.
const NAVY = '#002e52';
const SKY = '#1f7cb8';
/** Roll marks: present is the school blue, late amber, absent red, excused neutral grey. */
const MARK_COLORS: Record<string, string> = { P: SKY, A: '#dc2626', L: '#d97706', E: '#64748b' };
/** Colour of a success rate: school blue from 75%, amber from the pass mark, red below it. */
const rateColor = (rate: number) => (rate >= 75 ? SKY : rate >= 50 ? '#f59e0b' : '#ef4444');

function ChartCard({
  title,
  subtitle,
  children,
  empty,
  note,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  empty: boolean;
  note?: string;
}) {
  const { tr } = useLang();
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="h-72 p-4">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">{tr('No data recorded yet for this selection', 'Aucune donnée pour cette sélection')}</div>
        ) : (
          children
        )}
      </div>
      {note ? <p className="px-4 pb-4 -mt-2 text-xs leading-relaxed text-slate-400">{note}</p> : null}
    </Card>
  );
}

// ---- Success rates (% of pupils who reached the pass mark) ------------------

interface RatePoint {
  key: string;
  name: string;
  /** Success rate as a percentage (0–100), null when no pupil could be judged. */
  rate: number | null;
  withoutControls: number | null;
  passed: number;
  evaluated: number;
  average: number | null;
}

/** One line of a chart, for the competences or subjects that can actually be evaluated. */
function rateRows(rows: SuccessRow[], lang: Lang, without?: SuccessRow[]): RatePoint[] {
  return rows
    .filter((r) => r.max > 0)
    .map((r) => ({
      key: r.key,
      name: r.number ? `C${r.number} ${lang === 'fr' ? r.short_fr : r.short_en}` : lang === 'fr' ? r.short_fr : r.short_en,
      rate: r.rate === null ? null : Math.round(r.rate * 1000) / 10,
      withoutControls: without?.find((o) => o.key === r.key)?.rate ?? null,
      passed: r.passed,
      evaluated: r.evaluated,
      average: r.averagePct === null ? null : Math.round(r.averagePct * 1000) / 10,
    }));
}

interface TooltipItem {
  name?: string;
  value?: number;
  dataKey?: string | number;
  fill?: string;
  payload?: RatePoint;
}

function RateTooltip({
  active,
  payload,
  lang,
  tr,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  lang: Lang;
  tr: (en: string, fr: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-700">{point?.name}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="mt-0.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.fill }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-medium text-slate-800">{fmtNum(entry.value, lang, 1)} %</span>
        </div>
      ))}
      {point?.evaluated ? (
        <div className="mt-1 text-slate-400">
          {point.passed} / {point.evaluated}{' '}
          {tr('pupils reached the pass mark', 'élèves ont atteint le seuil')}
        </div>
      ) : null}
      {point?.average !== null && point?.average !== undefined ? (
        <div className="text-slate-400">
          {tr('Class average', 'Moyenne de la classe')} : {fmtNum(point.average, lang, 1)} %
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bars of success rates, optionally comparing the monthly card on its own with the same competences
 * once the weekly controls are folded in.
 */
function RateChart({
  rows,
  lang,
  tr,
  compare = false,
}: {
  rows: RatePoint[];
  lang: Lang;
  tr: (en: string, fr: string) => string;
  compare?: boolean;
}) {
  const withoutLabel = tr('Monthly card only', 'Carte mensuelle seule');
  const withLabel = tr('Controls included', 'Contrôles inclus');
  return (
    <ResponsiveContainer>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={rows.length > 6 ? -20 : 0} textAnchor={rows.length > 6 ? 'end' : 'middle'} height={rows.length > 6 ? 60 : 30} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <Tooltip content={<RateTooltip lang={lang} tr={tr} />} />
        {compare ? (
          <>
            <Bar dataKey="withoutControls" fill="#94a3b8" radius={[4, 4, 0, 0]} name={withoutLabel} />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]} name={withLabel}>
              {rows.map((r) => (
                <Cell key={r.key} fill={rateColor(r.rate ?? 0)} />
              ))}
            </Bar>
          </>
        ) : (
          <Bar dataKey="rate" radius={[4, 4, 0, 0]} name={tr('Success rate', 'Taux de réussite')}>
            {rows.map((r) => (
              <Cell key={r.key} fill={rateColor(r.rate ?? 0)} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Statistics() {
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const q = useQuery({
    queryKey: ['statistics', sel.classId, sel.week, sel.month],
    queryFn: () => api.get<Stats>(`/statistics?${qs({ classId: sel.classId, week: sel.week, month: sel.month })}`),
  });
  const s = q.data;
  const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);

  // Success rates: the share of pupils who reached the pass mark (charts 6–9).
  const su = s?.success;
  const passNote = su
    ? `${tr('Pass mark', 'Seuil de réussite')} ${fmtPct(su.passMark, lang, 0)}${su.passCote ? ` (${su.passCote})` : ''} · ${tr(
        'pupils with a complete evaluation',
        'élèves ayant une évaluation complète',
      )}`
    : '';
  const competences = su ? rateRows(su.class.competences, lang) : [];
  const subjects = su ? rateRows(su.class.subjects, lang) : [];
  const withControls = su ? rateRows(su.class.competencesWithControls, lang, su.class.competences) : [];
  const schoolCompetences = su ? rateRows(su.school.competences, lang) : [];
  const schoolSubjects = su ? rateRows(su.school.subjects, lang) : [];
  const competencesNotEvaluated = su
    ? su.class.competences
        .filter((c) => su.notEvaluated.includes(c.number ?? 0))
        .map((c) => `C${c.number} ${lang === 'fr' ? c.short_fr : c.short_en}`)
        .join(', ')
    : '';
  const notEvaluatedNote = competencesNotEvaluated
    ? `${competencesNotEvaluated} — ${tr(
        'no subject on the monthly card, so no rate for them',
        'aucune matière sur la carte mensuelle, donc pas de taux pour elles',
      )}`
    : undefined;
  const controlsIncludedNote = su
    ? [
        tr(
          'The grey bar is the monthly card on its own; the coloured one folds the weekly controls in.',
          'La barre grise est la carte mensuelle seule ; la barre colorée y ajoute les contrôles hebdomadaires.',
        ),
        notEvaluatedNote,
      ]
        .filter(Boolean)
        .join(' ')
    : undefined;

  return (
    <>
      <PageHeader
        title={tr('Statistics & charts', 'Statistiques et graphiques')}
        subtitle={tr('Pick a class, a week and a month — every chart follows instantly.', 'Choisissez la classe, la semaine et le mois — les graphiques suivent instantanément.')}
      />
      <Toolbar>
        <ClassSelect />
        <WeekSelect />
        <MonthSelect />
      </Toolbar>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : s ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title={`1 — ${tr('Daily performance per area', 'Performance quotidienne par domaine')}`}
            subtitle={`${s.class.name} · ${monthLabel(s.month, lang)} · /10`}
            empty={s.performanceByArea.every((a) => a.average === null)}
          >
            <ResponsiveContainer>
              <BarChart data={s.performanceByArea.map((a) => ({ name: lang === 'fr' ? a.label_fr : a.label_en, value: round(a.average) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtNum(Number(v), lang)} />
                <Bar dataKey="value" fill={NAVY} radius={[4, 4, 0, 0]} name={tr('Average /10', 'Moyenne /10')} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={`2 — ${tr('Weekly performance per subject', 'Performances hebdomadaires par matière')}`}
            subtitle={`${s.class.name} · W${s.week.number} · /20`}
            empty={s.controlsBySubject.every((a) => a.average === null)}
          >
            <ResponsiveContainer>
              <BarChart data={s.controlsBySubject.map((a) => ({ name: lang === 'fr' ? a.label_fr : a.label_en, value: round(a.average) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtNum(Number(v), lang)} />
                <Bar dataKey="value" fill={SKY} radius={[4, 4, 0, 0]} name={tr('Average /20', 'Moyenne /20')} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={`3 — ${tr('Monthly performance per discipline', 'Performances mensuelles par discipline')}`}
            subtitle={`${s.class.name} · ${monthLabel(s.month, lang)} · ${tr('% of max points', '% du barème')}`}
            empty={s.disciplines.every((a) => a.average === null)}
          >
            <ResponsiveContainer>
              <BarChart data={s.disciplines.map((d) => ({ name: d.code, label: lang === 'fr' ? d.short_fr : d.short_en, value: pct(d.pct) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${fmtNum(Number(v), lang, 1)} %`} labelFormatter={(_, p) => (p?.[0]?.payload ? `${p[0].payload.name} — ${p[0].payload.label}` : '')} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="%">
                  {s.disciplines.map((d) => (
                    <Cell key={d.code} fill={(d.pct ?? 0) >= 0.9 ? NAVY : (d.pct ?? 0) >= 0.75 ? SKY : (d.pct ?? 0) >= 0.5 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={`4 — ${tr('Monthly performance per competence', 'Performances mensuelles par compétence')}`}
            subtitle={`${s.class.name} · ${monthLabel(s.month, lang)} · %`}
            empty={s.competences.every((a) => a.average === null)}
          >
            <ResponsiveContainer>
              <RadarChart data={s.competences.map((c) => ({ name: `C${c.number} ${lang === 'fr' ? c.short_fr : c.short_en}`, value: pct(c.pct) ?? 0 }))} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `${fmtNum(Number(v), lang, 1)} %`} />
                <Radar dataKey="value" stroke={NAVY} fill={NAVY} fillOpacity={0.35} name="%" />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={`5 — ${tr('Roll marks', 'Marques d’appel')} · ${monthLabel(s.month, lang)}`}
            subtitle={`${s.class.name} · ${tr('attendance rate', 'taux de présence')} ${fmtPct(s.attendance.rate, lang, 1)}`}
            empty={Object.values(s.attendance.counts).every((v) => !v)}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={(['P', 'A', 'L', 'E'] as const).map((m) => ({ name: m, value: s.attendance.counts[m] }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="75%"
                  label={({ name, value }) => (value ? `${name}: ${value}` : '')}
                >
                  {(['P', 'A', 'L', 'E'] as const).map((m) => (
                    <Cell key={m} fill={MARK_COLORS[m]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title={`5b — ${tr('Attendance trend across the year', 'Évolution de la présence sur l’année')}`}
            subtitle={s.class.name}
            empty={s.attendance.trend.every((t) => t.rate === null)}
          >
            <ResponsiveContainer>
              <LineChart data={s.attendance.trend.map((t) => ({ name: (lang === 'fr' ? t.name_fr : t.name_en).slice(0, 3), value: pct(t.rate) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${fmtNum(Number(v), lang, 1)} %`} />
                <Line type="monotone" dataKey="value" stroke={NAVY} strokeWidth={2.5} dot={{ r: 4 }} connectNulls name="%" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {su ? (
            <>
              <ChartCard
                title={`6 — ${tr('Monthly success rate per competence', 'Taux de réussite mensuel par compétence')}`}
                subtitle={`${s?.class.name ?? ''} · ${monthLabel(su.month, lang)} · ${passNote}`}
                empty={competences.every((r) => r.rate === null)}
                note={notEvaluatedNote}
              >
                <RateChart rows={competences} lang={lang} tr={tr} />
              </ChartCard>

              <ChartCard
                title={`7 — ${tr('Monthly success rate per subject', 'Taux de réussite mensuel par matière')}`}
                subtitle={`${s?.class.name ?? ''} · ${monthLabel(su.month, lang)} · ${tr(
                  'monthly card, weekly controls left out',
                  'carte mensuelle, contrôles hebdomadaires exclus',
                )}`}
                empty={subjects.every((r) => r.rate === null)}
              >
                <RateChart rows={subjects} lang={lang} tr={tr} />
              </ChartCard>

              <ChartCard
                title={`8 — ${tr('Monthly success rate per competence, weekly controls included', 'Taux de réussite mensuel par compétence, contrôles hebdomadaires inclus')}`}
                subtitle={`${s?.class.name ?? ''} · ${monthLabel(su.month, lang)} · ${fmtPct(1 - su.controlWeight, lang, 0)} ${tr(
                  'monthly card',
                  'carte mensuelle',
                )} / ${fmtPct(su.controlWeight, lang, 0)} ${tr('controls', 'contrôles')}`}
                empty={withControls.every((r) => r.rate === null)}
                note={controlsIncludedNote}
              >
                <RateChart rows={withControls} lang={lang} tr={tr} compare />
              </ChartCard>

              <Card className="lg:col-span-2">
                <CardHeader
                  title={`9 — ${tr('Whole school: success rate per competence and per subject', 'Toute l’école : taux de réussite par compétence et par matière')}`}
                  subtitle={`${tr('All classes', 'Toutes les classes')} · ${monthLabel(su.month, lang)} · ${tr(
                    'monthly card, weekly controls left out',
                    'carte mensuelle, contrôles hebdomadaires exclus',
                  )} · ${passNote}`}
                />
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {tr('Per competence', 'Par compétence')} · {tr('% of pupils who passed', '% d’élèves ayant réussi')}
                    </p>
                    <div className="h-64">
                      {schoolCompetences.every((r) => r.rate === null) ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          {tr('No data recorded yet for this selection', 'Aucune donnée pour cette sélection')}
                        </div>
                      ) : (
                        <RateChart rows={schoolCompetences} lang={lang} tr={tr} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {tr('Per subject', 'Par matière')} · {tr('% of pupils who passed', '% d’élèves ayant réussi')}
                    </p>
                    <div className="h-64">
                      {schoolSubjects.every((r) => r.rate === null) ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          {tr('No data recorded yet for this selection', 'Aucune donnée pour cette sélection')}
                        </div>
                      ) : (
                        <RateChart rows={schoolSubjects} lang={lang} tr={tr} />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
