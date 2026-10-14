import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Database, Download, FileSpreadsheet, ImagePlus, KeyRound, Plus, Save, School, Sparkles, Trash2, Upload } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, Button, Card, CardHeader, Field, Input, Select, cx, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import type { ImportSummary } from '../lib/types';

interface PreviewResponse {
  importId: string;
  fileName: string;
  summary: ImportSummary;
  demoMode: boolean;
  existingPupils: number;
}

function ImportCard() {
  const { lang, tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [busy, setBusy] = useState<'upload' | 'commit' | null>(null);

  const upload = async (file: File) => {
    setBusy('upload');
    setPreview(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload<PreviewResponse>('/import/preview', form);
      setPreview(r);
      setMode(r.existingPupils === 0 || r.demoMode ? 'replace' : 'merge');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy('commit');
    try {
      const r = await api.post<{ mode: string; result: Record<string, number> }>('/import/commit', { importId: preview.importId, mode });
      await qc.invalidateQueries();
      toast.success(
        tr(
          `Imported ${r.result.pupils} pupils, ${r.result.attendance} roll marks, ${r.result.controls + r.result.performance + r.result.marks} marks.`,
          `${r.result.pupils} élèves, ${r.result.attendance} marques d’appel et ${r.result.controls + r.result.performance + r.result.marks} notes importés.`,
        ),
      );
      setPreview(null);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const s = preview?.summary;
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        icon={<FileSpreadsheet className="h-5 w-5" />}
        title={tr('Import the School_Manager workbook', 'Importer le classeur School_Manager')}
        subtitle={tr(
          'Reads Registration, Calendar, Roll_Call, Weekly_Controls, Daily_Performance, Month_Card_Entry and Term_Card_Entry. Nothing is written until you confirm.',
          'Lit Registration, Calendar, Roll_Call, Weekly_Controls, Daily_Performance, Month_Card_Entry et Term_Card_Entry. Rien n’est écrit avant votre confirmation.',
        )}
      />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => input.current?.click()} loading={busy === 'upload'}>
            {tr('Choose School_Manager.xlsx', 'Choisir School_Manager.xlsx')}
          </Button>
          <span className="text-xs text-slate-500">{tr('The file stays on this server — it is not uploaded anywhere else.', 'Le fichier reste sur ce serveur — il n’est envoyé nulle part ailleurs.')}</span>
        </div>

        {s && preview && (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-slate-900">
                {preview.fileName} — {s.school.name ?? '?'} {s.school.academicYear && `· ${s.school.academicYear}`}
              </p>
              <span className="text-xs text-slate-500">
                {s.sheets.length} {tr('sheets', 'feuilles')}
              </span>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  [tr('Pupils', 'Élèves'), s.counts.pupils],
                  [tr('Roll marks', 'Marques d’appel'), s.counts.attendance],
                  [tr('Control marks', 'Notes de contrôle'), s.counts.controls],
                  [tr('Performance marks', 'Notes de perf.'), s.counts.performance],
                  [tr('Card marks', 'Notes bulletins'), s.counts.marks],
                  [tr('Attitude grades', 'Attitudes'), s.counts.attitudes],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.classes.map((c) => (
                <Badge key={c.name} className="bg-white text-slate-700 shadow-sm">
                  {c.name} · {c.pupils}
                </Badge>
              ))}
            </div>
            {s.calendar && (
              <p className="text-sm text-slate-600">
                {tr('Calendar', 'Calendrier')}: {fmtDate(s.calendar.yearStart, lang)} – {fmtDate(s.calendar.yearEnd, lang)} · W1 = {fmtDate(s.calendar.week1Start, lang)} · {s.calendar.terms.length}{' '}
                {tr('terms', 'trimestres')} · {s.calendar.holidays} {tr('holidays', 'jours fériés')}
              </p>
            )}
            {s.warningCount > 0 && (
              <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <summary className="cursor-pointer font-semibold">
                  {s.warningCount} {tr('warning(s) — values that will be skipped', 'avertissement(s) — valeurs ignorées')}
                </summary>
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                  {s.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <Field label={tr('Import mode', 'Mode d’import')}>
                <Select value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'merge')} disabled={preview.demoMode} className="min-w-80">
                  <option value="replace">{tr('Replace — pupils & marks come only from the workbook', 'Remplacer — élèves et notes uniquement depuis le classeur')}</option>
                  <option value="merge">{tr('Merge — update matching IDs, keep other data', 'Fusionner — mettre à jour les matricules, garder le reste')}</option>
                </Select>
              </Field>
              <Button onClick={commit} loading={busy === 'commit'} icon={<FileSpreadsheet className="h-4 w-4" />}>
                {tr('Import now', 'Importer maintenant')}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {tr('Cancel', 'Annuler')}
              </Button>
            </div>
            {(preview.demoMode || (mode === 'replace' && preview.existingPupils > 0)) && (
              <p className="text-xs text-amber-800">
                {preview.demoMode
                  ? tr('The demo pupils and their marks will be removed.', 'Les élèves de démonstration et leurs notes seront supprimés.')
                  : tr(`The ${preview.existingPupils} pupils currently in the app and all their marks will be replaced.`, `Les ${preview.existingPupils} élèves actuels et toutes leurs notes seront remplacés.`)}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function SchoolCard() {
  const meta = useMetaData();
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const s = meta.settings;
  const [form, setForm] = useState({ schoolName: s.schoolName, schoolSubtitle: s.schoolSubtitle, academicYear: s.academicYear, timezone: s.timezone, weight: String(Math.round(s.academicWeight * 100)) });
  const [busy, setBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({ schoolName: s.schoolName, schoolSubtitle: s.schoolSubtitle, academicYear: s.academicYear, timezone: s.timezone, weight: String(Math.round(s.academicWeight * 100)) });
  }, [s.schoolName, s.schoolSubtitle, s.academicYear, s.timezone, s.academicWeight]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/settings', { ...form, academicWeight: Number(form.weight) / 100 });
      await qc.invalidateQueries();
      toast.success(tr('School details saved', 'Informations enregistrées'));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = (file: File) => {
    if (file.size > 500_000) return toast.error(tr('Logo too large (max 500 KB)', 'Logo trop volumineux (max 500 Ko)'));
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.put('/settings/logo', { dataUrl: reader.result });
        await qc.invalidateQueries({ queryKey: ['meta'] });
        toast.success(tr('Logo updated', 'Logo mis à jour'));
      } catch (err) {
        toast.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader icon={<School className="h-5 w-5" />} title={tr('School details', 'Informations de l’école')} subtitle={tr('Printed on reports and report cards', 'Imprimées sur les rapports et bulletins')} />
      <form onSubmit={save} className="space-y-3 p-5">
        <Field label={tr('School name', 'Nom de l’école')}>
          <Input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} required />
        </Field>
        <Field label={tr('Subtitle', 'Sous-titre')}>
          <Input value={form.schoolSubtitle} onChange={(e) => setForm({ ...form, schoolSubtitle: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr('Academic year', 'Année scolaire')}>
            <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required />
          </Field>
          <Field label={tr('Academic weight (%)', 'Poids académique (%)')} hint={tr('Overall = this % + rest for performance', 'Global = ce % + le reste pour la performance')}>
            <Input type="number" min={0} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required />
          </Field>
        </div>
        <Field label={tr('Timezone', 'Fuseau horaire')}>
          <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} required />
        </Field>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={busy}>
            {tr('Save', 'Enregistrer')}
          </Button>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          <Button variant="secondary" icon={<ImagePlus className="h-4 w-4" />} onClick={() => logoInput.current?.click()}>
            {s.hasLogo ? tr('Change logo', 'Changer le logo') : tr('Add a logo', 'Ajouter un logo')}
          </Button>
          {s.hasLogo && (
            <>
              <img src={`/api/logo?v=${s.logoVersion}`} alt="" className="h-9 w-9 rounded border object-contain" />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await api.del('/settings/logo');
                  await qc.invalidateQueries({ queryKey: ['meta'] });
                }}
              >
                {tr('Remove', 'Retirer')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Card>
  );
}

function BackupCard() {
  const meta = useMetaData();
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const noPupils = meta.classes.every((c) => c.registered === 0);

  const restore = async (file: File) => {
    if (!window.confirm(tr('Replace ALL current data with this backup?', 'Remplacer TOUTES les données actuelles par cette sauvegarde ?'))) return;
    setBusy('restore');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.upload('/restore', form);
      toast.success(tr('Backup restored', 'Sauvegarde restaurée'));
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const loadDemo = async () => {
    setBusy('demo');
    try {
      await api.post('/demo');
      await qc.invalidateQueries();
      toast.success(tr('Demo data loaded', 'Données de démonstration chargées'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Database className="h-5 w-5" />} title={tr('Backup & restore', 'Sauvegarde & restauration')} subtitle={tr('Download a copy of all school data regularly.', 'Téléchargez régulièrement une copie de toutes les données.')} />
      <div className="space-y-3 p-5">
        <a href="/api/backup" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-800">
          <Download className="h-4 w-4" /> {tr('Download backup (.db)', 'Télécharger la sauvegarde (.db)')}
        </a>
        <div>
          <input ref={input} type="file" accept=".db,.sqlite" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => input.current?.click()} loading={busy === 'restore'}>
            {tr('Restore a backup…', 'Restaurer une sauvegarde…')}
          </Button>
        </div>
        {noPupils && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="mb-2 text-slate-600">{tr('Want to explore first? Load invented pupils and marks.', 'Envie d’explorer d’abord ? Chargez des élèves et des notes fictifs.')}</p>
            <Button variant="subtle" size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={loadDemo} loading={busy === 'demo'}>
              {tr('Load demo data', 'Charger des données de démo')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ClassesCard() {
  const meta = useMetaData();
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState(meta.classes.map((c) => ({ ...c })));
  const [added, setAdded] = useState({ name: '', code: '' });

  useEffect(() => setRows(meta.classes.map((c) => ({ ...c }))), [meta.classes]);

  const save = async (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    try {
      await api.put(`/classes/${id}`, { name: row.name, code: row.code });
      await qc.invalidateQueries();
      toast.success(tr('Class saved', 'Classe enregistrée'));
    } catch (e) {
      toast.error(e);
    }
  };
  const remove = async (id: number) => {
    try {
      await api.del(`/classes/${id}`);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e);
    }
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/classes', added);
      setAdded({ name: '', code: '' });
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card>
      <CardHeader title={tr('Classes', 'Classes')} subtitle={tr('The code is used in student IDs (e.g. 6EME-04).', 'Le code sert dans les matricules (ex. 6EME-04).')} />
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => {
              const original = meta.classes.find((c) => c.id === r.id);
              const dirty = original && (original.name !== r.name || original.code !== r.code);
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-1.5">
                    <Input value={r.name} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} className="h-8 w-28" />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input value={r.code} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, code: e.target.value.toUpperCase() } : x)))} className="h-8 w-24" />
                  </td>
                  <td className="px-2 text-xs text-slate-500">{r.registered}</td>
                  <td className="px-2 py-1.5 text-right">
                    {dirty ? (
                      <Button size="sm" onClick={() => save(r.id)}>
                        {tr('Save', 'OK')}
                      </Button>
                    ) : r.registered === 0 ? (
                      <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(r.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="flex items-end gap-2 border-t border-slate-100 p-3">
        <Field label={tr('New class', 'Nouvelle classe')}>
          <Input value={added.name} onChange={(e) => setAdded({ ...added, name: e.target.value })} className="h-9 w-28" placeholder="1ère" required />
        </Field>
        <Field label="Code">
          <Input value={added.code} onChange={(e) => setAdded({ ...added, code: e.target.value.toUpperCase() })} className="h-9 w-24" placeholder="1ERE" required />
        </Field>
        <Button type="submit" size="sm" icon={<Plus className="h-4 w-4" />}>
          {tr('Add', 'Ajouter')}
        </Button>
      </form>
    </Card>
  );
}

function AccountCard() {
  const { tr } = useLang();
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return toast.error(tr('The two new passwords are different', 'Les deux nouveaux mots de passe sont différents'));
    setBusy(true);
    try {
      await api.post('/auth/password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success(tr('Password changed', 'Mot de passe modifié'));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader icon={<KeyRound className="h-5 w-5" />} title={tr('Change password', 'Changer le mot de passe')} />
      <form onSubmit={submit} className="space-y-3 p-5">
        <Field label={tr('Current password', 'Mot de passe actuel')}>
          <Input type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} autoComplete="current-password" required />
        </Field>
        <Field label={tr('New password (8+ characters)', 'Nouveau mot de passe (8 caractères min.)')}>
          <Input type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label={tr('Confirm new password', 'Confirmer')}>
          <Input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" required />
        </Field>
        <Button type="submit" loading={busy}>
          {tr('Change password', 'Changer')}
        </Button>
      </form>
    </Card>
  );
}

function FrameworkCard() {
  const meta = useMetaData();
  const { lang, tr } = useLang();
  const fw = meta.framework;
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title={tr('Competence framework', 'Référentiel de compétences')}
        subtitle={tr(`As printed on the report cards — total /${fw.totalMax}, monthly card /${fw.monthlyMax}.`, `Tel qu’imprimé sur les bulletins — total /${fw.totalMax}, bulletin mensuel /${fw.monthlyMax}.`)}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Code</th>
              <th className="px-3 py-2">{tr('Discipline', 'Discipline')}</th>
              <th className="px-3 py-2 text-center">Max</th>
              <th className="px-3 py-2">{tr('Assessment criteria', 'Critères d’évaluation')}</th>
              <th className="px-3 py-2 text-center">{tr('Monthly card', 'Bulletin mensuel')}</th>
            </tr>
          </thead>
          <tbody>
            {fw.competences.map((c) => (
              <Fragment key={c.number}>
                <tr className="bg-emerald-50/60">
                  <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-emerald-900">
                    C{c.number} — {lang === 'fr' ? c.title_fr : c.title_en} (/{c.max})
                  </td>
                </tr>
                {fw.disciplines
                  .filter((d) => d.competence === c.number)
                  .map((d) => (
                    <tr key={d.code} className="border-b border-slate-50">
                      <td className="px-4 py-1.5 font-semibold">{d.code}</td>
                      <td className="px-3 py-1.5">{d.label}</td>
                      <td className="px-3 py-1.5 text-center">{d.max}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-500">{d.criteria}</td>
                      <td className="px-3 py-1.5 text-center">{d.on_monthly_card ? '✓' : ''}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DangerCard() {
  const { tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      await api.post('/data/reset', { confirm });
      setConfirm('');
      await qc.invalidateQueries();
      toast.success(tr('All pupils and marks were deleted', 'Tous les élèves et notes ont été supprimés'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="border-red-200">
      <CardHeader icon={<AlertTriangle className="h-5 w-5 text-red-600" />} title={tr('Danger zone', 'Zone dangereuse')} subtitle={tr('Delete every pupil and all their marks (calendar and settings are kept).', 'Supprimer tous les élèves et toutes leurs notes (le calendrier et les paramètres sont conservés).')} />
      <div className="flex flex-wrap items-end gap-2 p-5">
        <Field label={tr('Type DELETE to confirm', 'Tapez DELETE pour confirmer')}>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-40" />
        </Field>
        <Button variant="danger" disabled={confirm !== 'DELETE'} loading={busy} onClick={reset} icon={<Trash2 className="h-4 w-4" />}>
          {tr('Delete all pupils & marks', 'Tout supprimer')}
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { tr } = useLang();
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tr('Settings & import', 'Paramètres & import')}</h1>
        <p className="mt-1 text-sm text-slate-500">{tr('Import the workbook, protect your data and adjust the school details.', 'Importez le classeur, protégez vos données et ajustez les informations de l’école.')}</p>
      </div>
      <div className={cx('grid gap-5 xl:grid-cols-2')}>
        <ImportCard />
        <SchoolCard />
        <BackupCard />
        <ClassesCard />
        <AccountCard />
        <FrameworkCard />
        <DangerCard />
      </div>
    </>
  );
}
