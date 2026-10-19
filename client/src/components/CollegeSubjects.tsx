import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, qs } from '../lib/api';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import type { CollegeSubject } from '../lib/types';
import { Button, Card, CardHeader, ErrorBox, Field, Input, Select, cx, useToast } from './ui';

interface Draft {
  code: string;
  labelFr: string;
  labelEn: string;
  groupNo: number;
  coefficient: number;
  teacher: string;
}

const draft = (s: CollegeSubject): Draft => ({
  code: s.code,
  labelFr: s.label,
  labelEn: s.labelEn,
  groupNo: s.groupNo,
  coefficient: s.coefficient,
  teacher: s.teacher,
});

/**
 * The subjects of a college class — the ones printed on the bulletin, with the coefficient
 * each carries and the group it belongs to. Every class has its own list, because 6ème and
 * 3ème do not weigh the same subjects.
 */
export function CollegeSubjectsCard() {
  const meta = useMetaData();
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const college = meta.classes.filter((c) => c.cycle === 'college');
  const [classId, setClassId] = useState(college[0]?.id ?? 0);
  useEffect(() => {
    if (college.length && !college.some((c) => c.id === classId)) setClassId(college[0].id);
  }, [college, classId]);

  const q = useQuery({
    queryKey: ['college-subjects', classId],
    queryFn: () => api.get<{ subjects: CollegeSubject[] }>(`/college/subjects?${qs({ classId })}`),
    enabled: classId > 0,
  });
  const [rows, setRows] = useState<Draft[]>([]);
  const [added, setAdded] = useState({ labelFr: '', groupNo: 1, coefficient: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows((q.data?.subjects ?? []).map(draft)), [q.data]);

  if (college.length === 0) return null;

  const dirty = JSON.stringify(rows) !== JSON.stringify((q.data?.subjects ?? []).map(draft));
  const coefTotal = rows.reduce((a, r) => a + Number(r.coefficient || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/college/subjects', { classId, subjects: rows });
      await qc.invalidateQueries({ queryKey: ['college-subjects', classId] });
      toast.success(tr('Subjects saved', 'Matières enregistrées'));
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const label = added.labelFr.trim();
    if (!label) return;
    setRows([...rows, { code: '', labelFr: label, labelEn: '', groupNo: added.groupNo, coefficient: added.coefficient, teacher: '' }]);
    setAdded({ labelFr: '', groupNo: added.groupNo, coefficient: 1 });
  };

  return (
    <Card>
      <CardHeader
        icon={<GraduationCap className="h-5 w-5" />}
        title={tr('Subjects of the college', 'Matières du collège')}
        subtitle={tr(
          'What each class is marked on: the groups and coefficients printed on the bulletin.',
          'Sur quoi chaque classe est notée : les groupes et coefficients imprimés sur le bulletin.',
        )}
        actions={
          <>
            <Select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className="h-9 w-32">
              {college.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button size="sm" icon={<Save className="h-4 w-4" />} onClick={save} loading={saving} disabled={!dirty}>
              {tr('Save', 'Enregistrer')}
            </Button>
          </>
        }
      />
      {q.isPending ? (
        <p className="p-4 text-sm text-slate-500">{tr('Loading…', 'Chargement…')}</p>
      ) : q.error ? (
        <div className="p-4">
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : (
        <>
          <div className="max-h-[22rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-3 py-1.5 font-medium">{tr('Subject', 'Matière')}</th>
                  <th className="px-2 py-1.5 font-medium">{tr('English', 'Anglais')}</th>
                  <th className="px-2 py-1.5 font-medium">{tr('Group', 'Groupe')}</th>
                  <th className="px-2 py-1.5 font-medium">Coef.</th>
                  <th className="px-2 py-1.5 font-medium">{tr('Teacher', 'Enseignant')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.code}-${i}`} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      <Input value={r.labelFr} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, labelFr: e.target.value } : x)))} className="h-8" />
                    </td>
                    <td className="px-1 py-1">
                      <Input value={r.labelEn} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, labelEn: e.target.value } : x)))} className="h-8" />
                    </td>
                    <td className="px-1 py-1">
                      <Select value={r.groupNo} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, groupNo: Number(e.target.value) } : x)))} className="h-8 w-16">
                        {[1, 2, 3].map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={r.coefficient}
                        onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, coefficient: Number(e.target.value) } : x)))}
                        className="h-8 w-16 text-right"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input value={r.teacher} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, teacher: e.target.value } : x)))} className="h-8" placeholder="M. …" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        aria-label={tr('Remove', 'Retirer')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 text-sm font-semibold">
                  <td className="px-3 py-1.5" colSpan={3}>
                    {tr('Total of the coefficients', 'Total des coefficients')}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{coefTotal}</td>
                  <td className="px-2 py-1.5 text-xs font-normal text-slate-500" colSpan={2}>
                    {rows.length} {tr('subjects', 'matières')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3">
            <Field label={tr('New subject', 'Nouvelle matière')} className="min-w-48 flex-1">
              <Input value={added.labelFr} onChange={(e) => setAdded({ ...added, labelFr: e.target.value })} className="h-9" placeholder="Philosophie" />
            </Field>
            <Field label={tr('Group', 'Groupe')}>
              <Select value={added.groupNo} onChange={(e) => setAdded({ ...added, groupNo: Number(e.target.value) })} className="h-9 w-20">
                {[1, 2, 3].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Coef.">
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={added.coefficient}
                onChange={(e) => setAdded({ ...added, coefficient: Number(e.target.value) })}
                className="h-9 w-16 text-right"
              />
            </Field>
            <Button type="submit" size="sm" icon={<Plus className="h-4 w-4" />}>
              {tr('Add', 'Ajouter')}
            </Button>
          </form>
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            {tr(
              'A subject belongs to a class: changing it here changes the bulletin of that class only. Moving a subject to another group re-sorts the bulletin.',
              'Une matière appartient à une classe : la modifier ici ne change que le bulletin de cette classe. Changer de groupe réordonne le bulletin.',
            )}
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * The cycle of one class — the school moves a level between the primary and the college
 * here, and the class is then reported on the card of that cycle.
 */
export function CycleSelect({ classId, cycle, onChanged }: { classId: number; cycle: string; onChanged: () => void }) {
  const { lang, tr } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold', cycle === 'college' ? 'bg-school-50 text-school-700' : 'bg-slate-100 text-slate-600')}>
      <select
        value={cycle}
        disabled={busy}
        className="bg-transparent text-xs font-semibold outline-none disabled:opacity-50"
        aria-label={tr('Cycle', 'Cycle')}
        title={tr('Which cycle this class is evaluated in', 'Dans quel cycle cette classe est évaluée')}
        onChange={async (e) => {
          setBusy(true);
          try {
            await api.put(`/classes/${classId}/cycle`, { cycle: e.target.value });
            onChanged();
            toast.success(tr('Cycle changed', 'Cycle modifié'));
          } catch (err) {
            toast.error(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="primary">{lang === 'fr' ? 'Primaire' : 'Primary'}</option>
        <option value="college">{lang === 'fr' ? 'Collège' : 'College'}</option>
      </select>
    </span>
  );
}
