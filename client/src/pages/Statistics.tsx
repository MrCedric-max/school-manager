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
import type { Statistics as Stats } from '../lib/types';

const GREEN = '#047857';
const MARK_COLORS: Record<string, string> = { P: '#059669', A: '#dc2626', L: '#d97706', E: '#0284c7' };

function ChartCard({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: ReactNode; empty: boolean }) {
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
    </Card>
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
                <Bar dataKey="value" fill={GREEN} radius={[4, 4, 0, 0]} name={tr('Average /10', 'Moyenne /10')} />
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
                <Bar dataKey="value" fill="#0369a1" radius={[4, 4, 0, 0]} name={tr('Average /20', 'Moyenne /20')} />
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
                    <Cell key={d.code} fill={(d.pct ?? 0) >= 0.9 ? '#047857' : (d.pct ?? 0) >= 0.75 ? '#10b981' : (d.pct ?? 0) >= 0.5 ? '#f59e0b' : '#ef4444'} />
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
                <Radar dataKey="value" stroke={GREEN} fill={GREEN} fillOpacity={0.35} name="%" />
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
                <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2.5} dot={{ r: 4 }} connectNulls name="%" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}
    </>
  );
}
