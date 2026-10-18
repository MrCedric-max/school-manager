import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NoPupils } from '../components/Common';
import { Card, CardHeader, ErrorBox, Field, LoadingBlock, PageHeader, SaveIndicator, Select, Tabs, Toolbar, cx } from '../components/ui';
import { api, qs } from '../lib/api';
import { fmtDate, fmtNum, mean } from '../lib/format';
import { useBatchSaver, useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { Lang, SequenceSheetData } from '../lib/types';

type Kind = 'interro' | 'devoir' | 'mark';

interface Change {
  pupilId: number;
  term: number;
  sequence: number;
  subject: string;
  kind: 'interro' | 'devoir';
  value: number | null;
}

const keyOf = (c: Change) => `${c.pupilId}|${c.sequence}|${c.subject}|${c.kind}`;

/**
 * The marks of the college, entered séquence by séquence: a séquence is six weeks of the
 * national calendar, two to a term, and the bulletin reports one mark per subject per
 * séquence — the average of the interrogation and the devoir written in those weeks.
 */
export default function Sequences() {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('devoir');

  const collegeClasses = meta.classes.filter((c) => c.cycle === 'college');
  const classId = collegeClasses.some((c) => c.id === sel.classId) ? sel.classId : (collegeClasses[0]?.id ?? sel.classId);
  const classes = collegeClasses.length ? collegeClasses : meta.classes;

  const grid = useQuery({ queryKey: ['college-sequences'], queryFn: () => api.get<{ sequences: SequenceSheetData['sequences'] }>('/college/sequences') });
  const sequences = grid.data?.sequences ?? [];
  const [sequence, setSequence] = useState<number | null>(null);
  const current = sequence ?? sequences.find((s) => s.number === 3)?.number ?? sequences[0]?.number ?? null;

  const queryKey = ['college-marks', classId, current];
  const q = useQuery({
    queryKey,
    queryFn: () => api.get<SequenceSheetData>(`/college/marks?${qs({ classId, sequence: current })}`),
    enabled: current !== null,
  });

  const saver = useBatchSaver<Change>((changes) => api.put('/college/marks/bulk', { marks: changes }), keyOf);

  const setMark = (pupilId: number, subject: string, value: number | null) => {
    if (kind === 'mark' || !q.data) return;
    const term = q.data.sequence.term;
    const seq = q.data.sequence.number;
    qc.setQueryData<SequenceSheetData>(queryKey, (old) =>
      old
        ? {
            ...old,
            pupils: old.pupils.map((p) =>
              p.pupilId === pupilId
                ? { ...p, marks: p.marks.map((m) => (m.code === subject ? { ...m, [kind]: value, mark: average(kind === 'interro' ? value : m.interro, kind === 'devoir' ? value : m.devoir) } : m)) }
                : p,
            ),
          }
        : old,
    );
    saver.queue({ pupilId, term, sequence: seq, subject, kind, value });
  };

  const sheet = q.data;
  const subjects = sheet?.subjects ?? [];
  const columns = useMemo(() => {
    if (!sheet) return [];
    return subjects.map((s) => ({
      code: s.code,
      label: s.label,
      coefficient: s.coefficient,
      group: s.groupNo,
      average: mean(sheet.pupils.map((p) => p.marks.find((m) => m.code === s.code)?.mark ?? null)),
    }));
  }, [sheet, subjects]);

  return (
    <>
      <PageHeader
        title={tr('Séquences', 'Séquences')}
        subtitle={tr(
          'The college’s marks: six séquences of six weeks, two to a term. The bulletin reports the average of the interrogation and the devoir of each séquence.',
          'Les notes du collège : six séquences de six semaines, deux par trimestre. Le bulletin rapporte la moyenne de l’interrogation et du devoir de chaque séquence.',
        )}
        actions={<SaveIndicator state={saver.state} error={saver.error} onRetry={() => void saver.flush()} />}
      />
      <Toolbar>
        <Field label={tr('Class', 'Classe')}>
          <Select value={classId} onChange={(e) => update({ classId: Number(e.target.value) })} className="min-w-40">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.enrolled}){c.cycle === 'primary' ? ` · ${tr('primary', 'primaire')}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr('Séquence', 'Séquence')}>
          <Select value={current ?? ''} onChange={(e) => setSequence(Number(e.target.value))} className="min-w-64">
            {sequences.map((s) => (
              <option key={s.number} value={s.number}>
                {tr(`Sequence ${s.number}`, `Séquence ${s.number}`)} · {tr('Term', 'Trimestre')} {s.term} · {fmtDate(s.start, lang)} – {fmtDate(s.end, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <Tabs
          value={kind}
          onChange={setKind}
          tabs={[
            { value: 'devoir', label: tr('Devoir', 'Devoir') },
            { value: 'interro', label: tr('Interrogation', 'Interrogation') },
            { value: 'mark', label: tr('Séquence', 'Séquence') },
          ]}
        />
      </Toolbar>

      {collegeClasses.length === 0 && (
        <Card className="mb-5 p-5 text-sm text-slate-600">
          {tr(
            'No class is in the college yet. Put the classes from 6ème onwards in the college in Settings → Classes.',
            'Aucune classe n’est encore au collège. Placez les classes à partir de la 6ème au collège dans Paramètres → Classes.',
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<GraduationCap className="h-5 w-5" />}
          title={sheet ? tr(`Sequence ${sheet.sequence.number} — ${sheet.class.name}`, `Séquence ${sheet.sequence.number} — ${sheet.class.name}`) : ''}
          subtitle={
            sheet
              ? tr(
                  `${fmtDate(sheet.sequence.start, lang)} – ${fmtDate(sheet.sequence.end, lang)} · ${sheet.sequence.schoolDays} school days · ${sheet.entered}/${sheet.expected} boxes filled`,
                  `${fmtDate(sheet.sequence.start, lang)} – ${fmtDate(sheet.sequence.end, lang)} · ${sheet.sequence.schoolDays} jours de classe · ${sheet.entered}/${sheet.expected} cases remplies`,
                )
              : ''
          }
        />
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4">
            <ErrorBox error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : !sheet || sheet.pupils.length === 0 ? (
          <NoPupils />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="sticky-col border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold">N°</th>
                  <th className="sticky-col border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold">{tr('Name', 'Nom')}</th>
                  {columns.map((c) => (
                    <th key={c.code} className="min-w-20 border-b border-l border-slate-200 px-1 py-1.5 text-center font-semibold" title={`${c.label} · coef ${c.coefficient}`}>
                      <span className="block truncate text-slate-700">{c.label}</span>
                      <span className="block font-normal text-slate-400">coef {c.coefficient}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.pupils.map((p) => (
                  <tr key={p.pupilId} className="border-b border-slate-100">
                    <td className="sticky-col bg-white px-2 py-0.5 text-xs text-slate-400">{p.classNo}</td>
                    <td className="sticky-col bg-white px-2 py-0.5 text-left">
                      <span className={cx(p.status !== 'Active' && 'text-slate-400')}>{p.name}</span>
                    </td>
                    {subjects.map((s) => {
                      const cell = p.marks.find((m) => m.code === s.code);
                      const value = kind === 'mark' ? (cell?.mark ?? null) : (cell?.[kind as 'interro' | 'devoir'] ?? null);
                      return (
                        <td key={s.code} className="border-l border-slate-100 px-1 py-0.5">
                          {kind === 'mark' ? (
                            <span className={cx('block px-1 text-center tabular-nums', cell?.mark === null && 'text-slate-300')}>
                              {cell?.mark === null || cell?.mark === undefined ? '–' : fmtNum(cell.mark, lang, 2)}
                            </span>
                          ) : (
                            <MarkInput value={value} onChange={(v) => setMark(p.pupilId, s.code, v)} lang={lang} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-xs font-semibold">
                  <td className="sticky-col bg-slate-50 px-2 py-1" colSpan={2}>
                    {tr('Class average', 'Moyenne de la classe')}
                  </td>
                  {columns.map((c) => (
                    <td key={c.code} className="border-l border-slate-200 px-1 py-1 text-center tabular-nums">
                      {fmtNum(c.average, lang, 2)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function average(a: number | null, b: number | null) {
  const values = [a, b].filter((v): v is number => v !== null && Number.isFinite(v));
  return values.length ? values.reduce((x, y) => x + y, 0) / values.length : null;
}

function MarkInput({ value, onChange, lang }: { value: number | null; onChange: (v: number | null) => void; lang: Lang }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  // While the box is being typed in, what is typed wins; otherwise it follows the mark.
  useEffect(() => {
    if (!focused) setText(value === null ? '' : String(value));
  }, [value, focused]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="–"
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const next = text.trim() === '' ? null : Number(text.replace(',', '.'));
        if (Number.isNaN(next as number)) return;
        if (next === value) return;
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={cx(
        'h-7 w-full rounded border border-transparent bg-transparent px-1 text-center text-sm tabular-nums outline-none hover:border-slate-300 focus:border-school-600 focus:bg-white focus:ring-1 focus:ring-school-600/30',
        value === null && 'text-slate-300',
      )}
      title={lang === 'fr' ? 'Note sur 20' : 'Mark out of 20'}
    />
  );
}
