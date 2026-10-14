import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, LoadingBlock, Modal, PageHeader, Select, Toolbar, cx, useToast } from '../components/ui';
import { ApiError, api, qs } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import { fmtDate } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { Pupil } from '../lib/types';

const STATUS_TONE: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Suspended: 'bg-amber-50 text-amber-700',
  Transferred: 'bg-slate-100 text-slate-600',
  Expelled: 'bg-red-50 text-red-700',
  Graduated: 'bg-sky-50 text-sky-700',
};

function age(dob: string | null, today: string) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

interface FormState {
  id?: number;
  classId: number;
  studentId: string;
  classNo: string;
  fullName: string;
  gender: '' | 'M' | 'F';
  dateOfBirth: string;
  placeOfBirth: string;
  guardian: string;
  phone: string;
  address: string;
  status: string;
}

function PupilForm({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const meta = useMetaData();
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { records: number }>(null);
  const isNew = !initial.id;

  // Suggest the next ID (e.g. CE2-28) when adding a pupil or changing class.
  useEffect(() => {
    if (!isNew) return;
    api
      .get<{ studentId: string; classNo: number }>(`/pupils/next-id?${qs({ classId: f.classId })}`)
      .then((r) => setF((s) => ({ ...s, studentId: r.studentId, classNo: String(r.classNo) })))
      .catch(() => {});
  }, [f.classId, isNew]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['pupils'] }), qc.invalidateQueries({ queryKey: ['meta'] })]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      classId: f.classId,
      studentId: f.studentId.trim() || undefined,
      classNo: f.classNo ? Number(f.classNo) : undefined,
      fullName: f.fullName,
      gender: f.gender || null,
      dateOfBirth: f.dateOfBirth || null,
      placeOfBirth: f.placeOfBirth,
      guardian: f.guardian,
      phone: f.phone,
      address: f.address,
      status: f.status,
    };
    try {
      if (isNew) await api.post('/pupils', body);
      else await api.put(`/pupils/${f.id}`, body);
      await refresh();
      toast.success(isNew ? tr('Pupil added', 'Élève ajouté') : tr('Pupil updated', 'Élève modifié'));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (force: boolean) => {
    setBusy(true);
    try {
      await api.del(`/pupils/${f.id}${force ? '?force=true' : ''}`);
      await refresh();
      toast.success(tr('Pupil deleted', 'Élève supprimé'));
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const records = (err.details as { records?: number } | undefined)?.records ?? 0;
        setConfirmDelete({ records });
      } else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? tr('Add a pupil', 'Ajouter un élève') : `${f.studentId} — ${initial.fullName}`}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(false)} disabled={busy}>
              {tr('Delete', 'Supprimer')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {tr('Cancel', 'Annuler')}
          </Button>
          <Button type="submit" form="pupil-form" loading={busy}>
            {tr('Save', 'Enregistrer')}
          </Button>
        </>
      }
    >
      <form id="pupil-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={tr('Class', 'Classe')}>
          <Select value={f.classId} onChange={(e) => set('classId', Number(e.target.value))}>
            {meta.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('Student ID', 'Matricule')} hint={isNew ? tr('Suggested automatically', 'Proposé automatiquement') : undefined}>
            <Input value={f.studentId} onChange={(e) => set('studentId', e.target.value.toUpperCase())} required={!isNew} />
          </Field>
          <Field label={tr('N° in class', 'N° dans la classe')}>
            <Input type="number" min={0} value={f.classNo} onChange={(e) => set('classNo', e.target.value)} />
          </Field>
        </div>
        <Field label={tr('Names & surnames', 'Noms et prénoms')} className="sm:col-span-2">
          <Input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required autoFocus placeholder="NOM PRÉNOMS" />
        </Field>
        <Field label={tr('Gender', 'Sexe')}>
          <Select value={f.gender} onChange={(e) => set('gender', e.target.value as FormState['gender'])}>
            <option value="">—</option>
            <option value="M">{tr('Male (M)', 'Masculin (M)')}</option>
            <option value="F">{tr('Female (F)', 'Féminin (F)')}</option>
          </Select>
        </Field>
        <Field label={tr('Status', 'Statut')}>
          <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {meta.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr('Date of birth', 'Date de naissance')}>
          <Input type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
        <Field label={tr('Place of birth', 'Lieu de naissance')}>
          <Input value={f.placeOfBirth} onChange={(e) => set('placeOfBirth', e.target.value)} />
        </Field>
        <Field label={tr('Parent / guardian', 'Parent / tuteur')}>
          <Input value={f.guardian} onChange={(e) => set('guardian', e.target.value)} />
        </Field>
        <Field label={tr('Phone', 'Téléphone')}>
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="6XX XX XX XX" />
        </Field>
        <Field label={tr('Address / quarter', 'Adresse / quartier')} className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
        {confirmDelete && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
            <p>
              {tr(
                `This pupil has ${confirmDelete.records} recorded marks and roll entries. Deleting removes them too — consider setting the status to "Transferred" instead.`,
                `Cet élève a ${confirmDelete.records} notes et marques d’appel. La suppression les efface aussi — préférez le statut « Transferred ».`,
              )}
            </p>
            <Button variant="danger" size="sm" className="mt-2" onClick={() => remove(true)} loading={busy}>
              {tr('Delete pupil and all records', 'Supprimer l’élève et toutes ses données')}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Pupils() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const [classFilter, setClassFilter] = useState<number | 'all'>(sel.classId || 'all');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);

  const q = useQuery({
    queryKey: ['pupils', classFilter, status],
    queryFn: () => api.get<{ pupils: Pupil[] }>(`/pupils?${qs({ classId: classFilter === 'all' ? null : classFilter, status })}`),
  });

  const pupils = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = q.data?.pupils ?? [];
    if (!term) return list;
    return list.filter((p) => `${p.full_name} ${p.student_id} ${p.guardian ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(term));
  }, [q.data, search]);

  const blank = (): FormState => ({
    classId: classFilter === 'all' ? meta.classes[0]?.id ?? 0 : classFilter,
    studentId: '',
    classNo: '',
    fullName: '',
    gender: '',
    dateOfBirth: '',
    placeOfBirth: '',
    guardian: '',
    phone: '',
    address: '',
    status: 'Active',
  });

  const edit = (p: Pupil) =>
    setEditing({
      id: p.id,
      classId: p.class_id,
      studentId: p.student_id,
      classNo: String(p.class_no),
      fullName: p.full_name,
      gender: p.gender ?? '',
      dateOfBirth: p.date_of_birth ?? '',
      placeOfBirth: p.place_of_birth ?? '',
      guardian: p.guardian ?? '',
      phone: p.phone ?? '',
      address: p.address ?? '',
      status: p.status,
    });

  const exportCsv = () =>
    downloadCsv(`pupils-${classFilter === 'all' ? 'all' : meta.classes.find((c) => c.id === classFilter)?.code}.csv`, [
      ['N°', 'Student ID', 'Class', 'Names & Surnames', 'Gender', 'Date of birth', 'Place of birth', 'Parent / Guardian', 'Phone', 'Address / Quarter', 'Status'],
      ...pupils.map((p) => [p.class_no, p.student_id, p.class_name, p.full_name, p.gender, p.date_of_birth, p.place_of_birth, p.guardian, p.phone, p.address, p.status]),
    ]);

  const missing = pupils.filter((p) => !p.gender || !p.date_of_birth || !p.guardian).length;

  return (
    <>
      <PageHeader
        title={tr('Pupils', 'Élèves')}
        subtitle={tr('School registration — the official roll of every class.', 'Registre des élèves — la liste officielle de chaque classe.')}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!pupils.length}>
              CSV
            </Button>
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing(blank())} disabled={!meta.classes.length}>
              {tr('Add a pupil', 'Ajouter un élève')}
            </Button>
          </>
        }
      />
      <Toolbar>
        <Field label={tr('Class', 'Classe')}>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="min-w-40">
            <option value="all">{tr('All classes', 'Toutes les classes')}</option>
            {meta.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.registered})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr('Status', 'Statut')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-36">
            <option value="">{tr('Any status', 'Tous les statuts')}</option>
            {meta.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr('Search', 'Rechercher')} className="min-w-56 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="w-full pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Name, ID, parent or phone…', 'Nom, matricule, parent ou téléphone…')} />
          </div>
        </Field>
      </Toolbar>
      {missing > 0 && (
        <p className="mb-3 text-xs text-amber-700">
          {tr(
            `${missing} pupil(s) still miss gender, date of birth or parent information — click a row to complete it.`,
            `${missing} élève(s) sans sexe, date de naissance ou parent — cliquez sur une ligne pour compléter.`,
          )}
        </p>
      )}
      <Card>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.error ? (
          <div className="p-4"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
        ) : !pupils.length ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title={tr('No pupils found', 'Aucun élève trouvé')}>
            {tr('Import your School_Manager workbook in Settings, or add pupils one by one.', 'Importez votre classeur School_Manager dans Paramètres, ou ajoutez les élèves un par un.')}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-semibold">N°</th>
                  <th className="px-3 py-2 font-semibold">{tr('ID', 'Matricule')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Names & surnames', 'Noms et prénoms')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Class', 'Classe')}</th>
                  <th className="px-3 py-2 text-center font-semibold">{tr('Sex', 'Sexe')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Born', 'Né(e) le')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Parent / guardian', 'Parent / tuteur')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Phone', 'Téléphone')}</th>
                  <th className="px-3 py-2 font-semibold">{tr('Status', 'Statut')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => {
                  const a = age(p.date_of_birth, meta.today.date);
                  return (
                    <tr key={p.id} className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50/40" onClick={() => edit(p)}>
                      <td className="px-4 py-2 tabular-nums text-slate-400">{p.class_no}</td>
                      <td className="px-3 py-2 font-medium tabular-nums text-slate-600">{p.student_id}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-3 py-2">{p.class_name}</td>
                      <td className="px-3 py-2 text-center">{p.gender ?? <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.date_of_birth ? (
                          <>
                            {fmtDate(p.date_of_birth, lang, 'numeric')} <span className="text-xs text-slate-400">({a} {tr('y', 'ans')})</span>
                          </>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{p.guardian ?? <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.phone ?? <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2">
                        <Badge className={cx(STATUS_TONE[p.status])}>{p.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        <Pencil className="ml-auto h-4 w-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              {pupils.length} {tr('pupil(s)', 'élève(s)')}
            </p>
          </div>
        )}
      </Card>
      {editing && <PupilForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
