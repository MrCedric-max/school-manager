import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AverageRow, InfoNote, NoPupils } from '../components/Common';
import { MarkGrid } from '../components/MarkGrid';
import { ClassSelect, SchoolDayPicker } from '../components/Selectors';
import { Card, ErrorBox, LoadingBlock, PageHeader, SaveIndicator, Toolbar } from '../components/ui';
import { api, qs } from '../lib/api';
import { fmtNum, mean } from '../lib/format';
import { patchNested } from '../lib/grid';
import { useBatchSaver, useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { CalendarDay, ClassInfo, PupilRow, Values } from '../lib/types';

interface PerformanceData {
  class: ClassInfo;
  date: string;
  day: CalendarDay;
  pupils: PupilRow[];
  values: Values;
}

interface Change {
  pupilId: number;
  date: string;
  area: string;
  value: number | null;
}

const keyOf = (c: Change) => `${c.pupilId}|${c.date}|${c.area}`;

export default function DailyPerformance() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const qc = useQueryClient();
  const queryKey = ['performance', sel.classId, sel.date];
  const q = useQuery({
    queryKey,
    queryFn: () => api.get<PerformanceData>(`/performance?${qs({ classId: sel.classId, date: sel.date })}`),
  });
  const saver = useBatchSaver((changes: Change[]) => api.put('/performance', { changes }), keyOf);
  const areas = meta.framework.areas;
  const value = (pupilId: number, code: string) => q.data?.values[pupilId]?.[code];
  const rowAverage = (pupilId: number) => mean(areas.map((a) => value(pupilId, a.code)));

  const setValue = (pupilId: number, area: string, v: number | null) => {
    qc.setQueryData<PerformanceData>(queryKey, (old) => old && patchNested(old, 'values', pupilId, area, v));
    saver.queue({ pupilId, date: sel.date, area, value: v });
  };

  const pupils = q.data?.pupils ?? [];
  const isSchoolDay = q.data?.day.type === 'school';
  return (
    <>
      <PageHeader
        title={tr('Daily performance', 'Performance quotidienne')}
        subtitle={tr('A mark out of 10 for each of the 7 areas, per pupil and per school day.', 'Une note sur 10 pour chacun des 7 domaines, par élève et par jour de classe.')}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <ClassSelect />
        <SchoolDayPicker />
      </Toolbar>
      {q.data && !isSchoolDay && (
        <InfoNote tone="amber">{tr('This date is not a school day — choose another day.', 'Cette date n’est pas un jour de classe — choisissez un autre jour.')}</InfoNote>
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
            columns={areas.map((a) => ({ key: a.code, header: lang === 'fr' ? a.label_fr : a.label_en, sub: `/${a.max}`, max: a.max, readOnly: !isSchoolDay }))}
            getValue={value}
            onChange={setValue}
            computed={[{ key: 'avg', header: tr('Average', 'Moyenne'), sub: '/10', render: (p) => <span className="font-semibold">{fmtNum(rowAverage(p.id), lang)}</span> }]}
            footer={
              <AverageRow
                label={tr('Class average', 'Moyenne de la classe')}
                values={[...areas.map((a) => mean(pupils.map((p) => value(p.id, a.code)))), mean(pupils.map((p) => rowAverage(p.id)))]}
              />
            }
          />
        )}
      </Card>
    </>
  );
}
