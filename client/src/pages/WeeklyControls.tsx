import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AverageRow, InfoNote, NoPupils } from '../components/Common';
import { MarkGrid } from '../components/MarkGrid';
import { ClassSelect, WeekSelect } from '../components/Selectors';
import { Card, CoteBadge, ErrorBox, LoadingBlock, PageHeader, SaveIndicator, Toolbar } from '../components/ui';
import { api, qs } from '../lib/api';
import { coteFor, dayMonth, fmtNum, mean } from '../lib/format';
import { patchNested } from '../lib/grid';
import { useBatchSaver, useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { ClassInfo, PupilRow, Values, WeekInfo } from '../lib/types';

interface ControlsData {
  class: ClassInfo;
  week: WeekInfo;
  pupils: PupilRow[];
  values: Values;
}

interface Change {
  pupilId: number;
  week: number;
  subject: string;
  value: number | null;
}

const keyOf = (c: Change) => `${c.pupilId}|${c.week}|${c.subject}`;

export default function WeeklyControls() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const qc = useQueryClient();
  const queryKey = ['controls', sel.classId, sel.week];
  const q = useQuery({
    queryKey,
    queryFn: () => api.get<ControlsData>(`/controls?${qs({ classId: sel.classId, week: sel.week })}`),
  });
  const saver = useBatchSaver((changes: Change[]) => api.put('/controls', { changes }), keyOf);
  const subjects = meta.framework.subjects;
  const week = meta.calendar.weeks.find((w) => w.number === sel.week);
  const cotes = meta.settings.cotes;

  const value = (pupilId: number, code: string) => q.data?.values[pupilId]?.[code];
  const rowAverage = (pupilId: number) => mean(subjects.map((s) => value(pupilId, s.code)));

  const setValue = (pupilId: number, subject: string, v: number | null) => {
    qc.setQueryData<ControlsData>(queryKey, (old) => old && patchNested(old, 'values', pupilId, subject, v));
    saver.queue({ pupilId, week: sel.week, subject, value: v });
  };

  const pupils = q.data?.pupils ?? [];
  return (
    <>
      <PageHeader
        title={tr('Weekly controls', 'Contrôles hebdomadaires')}
        subtitle={tr('One mark out of 20 per subject, per pupil and per week.', 'Une note sur 20 par matière, par élève et par semaine.')}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <ClassSelect />
        <WeekSelect />
        {week && (
          <div className="pb-2 text-xs text-slate-500">
            {dayMonth(week.monday, lang)} – {dayMonth(week.friday, lang)} · {week.term ? `${tr('Term', 'Trimestre')} ${week.term}` : tr('Holidays', 'Vacances')} ·{' '}
            {week.schoolDays} {tr('school days', 'jours de classe')}
          </div>
        )}
      </Toolbar>
      {week && week.schoolDays === 0 && (
        <InfoNote tone="amber">{tr('There is no school this week (holidays). Marks can still be entered.', 'Pas de classe cette semaine (vacances). Vous pouvez quand même saisir des notes.')}</InfoNote>
      )}
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
            columns={subjects.map((s) => ({ key: s.code, header: lang === 'fr' ? s.label_fr : s.label_en, sub: `/${s.max}`, max: s.max }))}
            getValue={value}
            onChange={setValue}
            computed={[
              { key: 'avg', header: tr('Average', 'Moyenne'), sub: '/20', render: (p) => <span className="font-semibold">{fmtNum(rowAverage(p.id), lang)}</span> },
              { key: 'cote', header: 'Cote', render: (p) => <CoteBadge code={coteFor((rowAverage(p.id) ?? NaN) / 20, cotes)} /> },
            ]}
            footer={
              <AverageRow
                label={tr('Class average', 'Moyenne de la classe')}
                values={[...subjects.map((s) => mean(pupils.map((p) => value(p.id, s.code)))), mean(pupils.map((p) => rowAverage(p.id)))]}
                trailing={1}
              />
            }
          />
        )}
      </Card>
    </>
  );
}
