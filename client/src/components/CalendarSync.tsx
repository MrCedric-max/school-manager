import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, FileSpreadsheet, History, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { CalendarEvent, EventCategory, PlannerPreview, SchoolYearsData, YearDiff } from '../lib/types';
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, cx, useToast } from './ui';

const CATEGORY_STYLE: Record<EventCategory, string> = {
  official: 'bg-school-100 text-school-800',
  break: 'bg-amber-100 text-amber-800',
  holiday: 'bg-orange-100 text-orange-800',
  exam: 'bg-violet-100 text-violet-800',
  deadline: 'bg-rose-100 text-rose-700',
  event: 'bg-slate-100 text-slate-700',
};

const CATEGORY_LABEL: Record<EventCategory, [string, string]> = {
  official: ['Official', 'Officiel'],
  break: ['Holidays', 'Vacances'],
  holiday: ['Public holiday', 'Jour férié'],
  exam: ['Exams', 'Examens'],
  deadline: ['Deadline', 'Échéance'],
  event: ['School event', 'Événement'],
};

const SOURCE_LABEL: Record<string, [string, string]> = {
  national: ['National', 'National'],
  import: ['Planner', 'Calendrier'],
  manual: ['Added here', 'Ajouté ici'],
};

/**
 * The national calendar: what the ministry published, whether the app is in step with it,
 * and the school's own dates imported from its planner.
 */
export function CalendarSync({ compact = false }: { compact?: boolean }) {
  const { lang, tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useQuery({ queryKey: ['school-years'], queryFn: () => api.get<SchoolYearsData>('/calendar/years') });
  const data = q.data;
  const activeId = data?.activeId ?? null;
  const preview = useQuery({
    queryKey: ['school-years', activeId, 'preview'],
    queryFn: () => api.get<YearDiff>(`/calendar/years/${activeId}/preview`),
    enabled: activeId !== null,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [planner, setPlanner] = useState<PlannerPreview | null>(null);
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');

  const year = data?.years.find((y) => y.id === activeId) ?? null;
  const changes = preview.data?.terms.filter((t) => t.changed).length ?? 0;
  const holidayChanges =
    (preview.data?.holidays.added.length ?? 0) + (preview.data?.holidays.removed.length ?? 0) + (preview.data?.holidays.renamed.length ?? 0);
  const outOfStep = changes > 0 || holidayChanges > 0;

  const events = useMemo(() => {
    const all = data?.events ?? [];
    return filter === 'all' ? all : all.filter((e) => e.category === filter);
  }, [data, filter]);

  const nextYear = useMemo(() => {
    const label = year?.label ?? '';
    const m = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(label);
    if (!m) return null;
    const wanted = `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
    return data?.years.find((y) => y.label === wanted) ?? { label: wanted } as never;
  }, [data, year]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['school-years'] });
    await qc.invalidateQueries({ queryKey: ['calendar'] });
    await qc.invalidateQueries({ queryKey: ['meta'] });
  };

  const run = async (key: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
      toast.success(message);
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!activeId) return;
    const ok = await run('apply', () => api.post(`/calendar/years/${activeId}/apply`, {}), tr('The calendar now follows the national calendar', 'Le calendrier suit maintenant le calendrier national'));
    if (ok) setConfirm(false);
  };

  const prepareNext = () =>
    run(
      'next',
      () => api.post(`/calendar/years/${activeId}/rollover`, {}),
      tr(`A draft of ${nextYear?.label ?? ''} is ready to check`, `Un brouillon de ${nextYear?.label ?? ''} est prêt à vérifier`),
    );

  const activateYear = (id: number, status: string) =>
    run('status', () => api.post(`/calendar/years/${id}/status`, { status }), tr('School year updated', 'Année scolaire mise à jour'));

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    void run(
      'upload',
      async () => setPlanner(await api.upload<PlannerPreview>('/calendar/events/import/preview', form)),
      tr('Planner read', 'Calendrier lu'),
    );
  };

  const commitPlanner = () =>
    run(
      'commit',
      () => api.post('/calendar/events/import/commit', { importId: planner?.importId }),
      tr('The school’s dates were added to the calendar', 'Les dates de l’école ont été ajoutées au calendrier'),
    ).then((ok) => {
      if (ok) setPlanner(null);
    });

  const removeEvent = (id: number) => run(`del-${id}`, () => api.del(`/calendar/events/${id}`), tr('Date removed', 'Date supprimée'));

  if (q.isPending) return <Card className="p-5 text-sm text-slate-500">{tr('Loading the national calendar…', 'Chargement du calendrier national…')}</Card>;
  if (q.error || !data) return <Card className="p-5 text-sm text-red-700">{String((q.error as Error)?.message ?? '')}</Card>;

  return (
    <>
      <Card className="mb-5">
        <CardHeader
          icon={<CalendarClock className="h-5 w-5" />}
          title={tr('National calendar', 'Calendrier national')}
          subtitle={
            year
              ? tr(
                  `School year ${year.label}${year.backbone.reference ? ` · ${year.backbone.reference}` : ''}`,
                  `Année scolaire ${year.label}${year.backbone.reference ? ` · ${year.backbone.reference}` : ''}`,
                )
              : tr('No school year on file yet', 'Aucune année scolaire enregistrée')
          }
          actions={
            outOfStep ? (
              <Button size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setConfirm(true)} loading={busy === 'apply'}>
                {tr('Bring in line', 'Mettre en conformité')}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-school-50 px-2.5 py-1.5 text-xs font-semibold text-school-700">
                <CheckCircle2 className="h-4 w-4" /> {tr('In step', 'En conformité')}
              </span>
            )
          }
        />
        <div className="space-y-4 p-5">
          {year && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label={tr('School days in the official year', 'Jours de classe de l’année officielle')} value={String(preview.data?.schoolDays ?? year.plan.terms.reduce((a, t) => a + t.schoolDays, 0))} />
              <Fact label={tr('Official dates', 'Dates officielles')} value={String(data.events.filter((e) => e.source === 'national').length)} />
              <Fact label={tr('The school’s own dates', 'Dates de l’école')} value={String(data.events.filter((e) => e.source !== 'national').length)} />
            </div>
          )}

          {outOfStep && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {tr(
                  'The calendar in the app does not match the national calendar yet',
                  'Le calendrier de l’application ne correspond pas encore au calendrier national',
                )}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {preview.data?.terms
                  .filter((t) => t.changed)
                  .map((t) => (
                    <li key={t.number}>
                      {t.name}: {t.from ? `${fmtDate(t.from.start, lang)} – ${fmtDate(t.from.end, lang)}` : '—'} →{' '}
                      {t.to ? `${fmtDate(t.to.start, lang)} – ${fmtDate(t.to.end, lang)}` : '—'}
                    </li>
                  ))}
                {preview.data && preview.data.holidays.added.length > 0 && (
                  <li>
                    + {preview.data.holidays.added.length} {tr('public holidays', 'jours fériés')}
                  </li>
                )}
                {preview.data && preview.data.holidays.removed.length > 0 && (
                  <li>
                    − {preview.data.holidays.removed.length} {tr('public holidays', 'jours fériés')}
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs">
                {tr(
                  'Applying changes the term dates, and therefore the school days behind every report.',
                  'Appliquer modifie les dates des trimestres, et donc les jours de classe derrière chaque rapport.',
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={pickFile} />
            <Button variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} loading={busy === 'upload'}>
              {tr('Import the school planner', 'Importer le calendrier de l’école')}
            </Button>
            {nextYear && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={prepareNext}
                loading={busy === 'next'}
                disabled={Boolean(data.years.find((y) => y.label === nextYear.label))}
              >
                {tr(`Prepare ${nextYear.label}`, `Préparer ${nextYear.label}`)}
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void refresh()}>
              {tr('Refresh', 'Rafraîchir')}
            </Button>
          </div>

          {data.years.length > 1 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <History className="h-3.5 w-3.5" /> {tr('School years on file', 'Années scolaires archivées')}
              </p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.years.map((y) => (
                  <li key={y.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{y.label}</span>
                    <Badge className={y.status === 'active' ? 'bg-school-100 text-school-800' : y.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}>
                      {y.status === 'active' ? tr('Active', 'Active') : y.status === 'draft' ? tr('Draft', 'Brouillon') : tr('Archived', 'Archivée')}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {fmtDate(y.startDate, lang)} – {fmtDate(y.endDate, lang)}
                    </span>
                    <span className="flex-1" />
                    {y.status === 'draft' && (
                      <Button size="sm" variant="secondary" loading={busy === 'status'} onClick={() => activateYear(y.id, 'active')}>
                        {tr('Activate', 'Activer')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {!compact && (
        <Card className="mb-5">
          <CardHeader
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={tr('Dates of the school year', 'Dates de l’année scolaire')}
            subtitle={tr(
              'The official dates and the school’s own, the ones reminders are sent for.',
              'Les dates officielles et celles de l’école, celles pour lesquelles des rappels sont envoyés.',
            )}
            actions={
              <Select value={filter} onChange={(e) => setFilter(e.target.value as EventCategory | 'all')} className="h-9 w-40">
                <option value="all">{tr('Everything', 'Tout')}</option>
                {(data.categories ?? []).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]?.[lang === 'fr' ? 1 : 0] ?? c}
                  </option>
                ))}
              </Select>
            }
          />
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {events.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">{tr('No date yet', 'Aucune date')}</li>}
            {events.map((e) => (
              <EventRow key={e.id} event={e} lang={lang} onRemove={() => removeEvent(e.id)} busy={busy === `del-${e.id}`} />
            ))}
          </ul>
          <div className="border-t border-slate-100">
            <AddEventForm onAdded={() => void refresh()} />
          </div>
        </Card>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        wide
        title={tr('Bring the calendar in line with the national calendar', 'Mettre le calendrier en conformité avec le calendrier national')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {tr('Not now', 'Plus tard')}
            </Button>
            <Button icon={<RefreshCw className="h-4 w-4" />} onClick={apply} loading={busy === 'apply'}>
              {tr('Apply the national calendar', 'Appliquer le calendrier national')}
            </Button>
          </>
        }
      >
        <DiffView diff={preview.data} lang={lang} />
      </Modal>

      <Modal
        open={Boolean(planner)}
        onClose={() => setPlanner(null)}
        wide
        title={tr('Add the school’s dates', 'Ajouter les dates de l’école')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanner(null)}>
              {tr('Cancel', 'Annuler')}
            </Button>
            <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={commitPlanner} loading={busy === 'commit'}>
              {tr(`Add ${planner?.summary.count ?? 0} dates`, `Ajouter ${planner?.summary.count ?? 0} dates`)}
            </Button>
          </>
        }
      >
        {planner && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              {tr('Read from', 'Lu depuis')} <strong>{planner.fileName}</strong> · {planner.summary.sheets.join(', ')}
            </p>
            <p className="text-slate-700">
              {tr(
                `${planner.summary.count} dated notes between ${fmtDate(planner.summary.from, lang)} and ${fmtDate(planner.summary.to, lang)}.`,
                `${planner.summary.count} notes datées entre le ${fmtDate(planner.summary.from, lang)} et le ${fmtDate(planner.summary.to, lang)}.`,
              )}
            </p>
            {planner.alreadyImported > 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                {tr(
                  `${planner.alreadyImported} dates were already imported — they will be replaced.`,
                  `${planner.alreadyImported} dates ont déjà été importées — elles seront remplacées.`,
                )}
              </p>
            )}
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {planner.summary.sample.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(s.date, lang)}</span>
                  <Badge className={CATEGORY_STYLE[s.category]}>{CATEGORY_LABEL[s.category]?.[lang === 'fr' ? 1 : 0]}</Badge>
                  <span className="truncate">{s.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EventRow({ event, lang, onRemove, busy }: { event: CalendarEvent; lang: 'en' | 'fr'; onRemove: () => void; busy: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <span className="w-24 shrink-0 tabular-nums text-slate-500">{fmtDate(event.date, lang)}</span>
      <Badge className={CATEGORY_STYLE[event.category]}>{CATEGORY_LABEL[event.category]?.[lang === 'fr' ? 1 : 0]}</Badge>
      <span className="min-w-0 flex-1 truncate" title={event.title}>
        {event.title}
      </span>
      {event.endDate && <span className="text-xs text-slate-400">→ {fmtDate(event.endDate, lang)}</span>}
      <Badge className={cx('shrink-0', event.source === 'national' ? 'bg-school-50 text-school-700' : 'bg-slate-100 text-slate-600')}>
        {SOURCE_LABEL[event.source]?.[lang === 'fr' ? 1 : 0] ?? event.source}
      </Badge>
      <button
        type="button"
        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        onClick={onRemove}
        disabled={busy}
        aria-label={lang === 'fr' ? 'Supprimer' : 'Remove'}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function DiffView({ diff, lang }: { diff?: YearDiff; lang: 'en' | 'fr' }) {
  const { tr } = useLang();
  if (!diff) return <p className="text-sm text-slate-500">{tr('Loading…', 'Chargement…')}</p>;
  return (
    <div className="space-y-4 text-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="px-2 py-1">{tr('Term', 'Trimestre')}</th>
            <th className="px-2 py-1">{tr('Now', 'Actuel')}</th>
            <th className="px-2 py-1">{tr('National', 'National')}</th>
            <th className="px-2 py-1 text-right">{tr('Days', 'Jours')}</th>
          </tr>
        </thead>
        <tbody>
          {diff.terms.map((t) => (
            <tr key={t.number} className={cx(t.changed && 'bg-amber-50')}>
              <td className="px-2 py-1 font-medium">{t.name}</td>
              <td className="px-2 py-1 text-slate-500">{t.from ? `${fmtDate(t.from.start, lang)} – ${fmtDate(t.from.end, lang)}` : '—'}</td>
              <td className="px-2 py-1">{t.to ? `${fmtDate(t.to.start, lang)} – ${fmtDate(t.to.end, lang)}` : '—'}</td>
              <td className="px-2 py-1 text-right tabular-nums">{t.schoolDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(['added', 'removed'] as const).map((kind) =>
        diff.holidays[kind].length ? (
          <div key={kind}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {kind === 'added' ? tr('Public holidays added', 'Jours fériés ajoutés') : tr('Public holidays removed', 'Jours fériés retirés')}
            </p>
            <ul className="mt-1 text-xs text-slate-600">
              {diff.holidays[kind].map((h) => (
                <li key={h.date}>
                  {fmtDate(h.date, lang)} — {h.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      <p className="text-xs text-slate-500">
        {tr(
          'The school’s own dates are never touched, and a holiday added by hand is kept.',
          'Les dates de l’école ne sont jamais modifiées, et un jour férié ajouté à la main est conservé.',
        )}
      </p>
    </div>
  );
}

/** Add a date of the school's own (not from the planner). */
export function AddEventForm({ onAdded }: { onAdded: () => void }) {
  const { lang, tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({ date: '', title: '', category: 'event' as EventCategory });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/calendar/events', form);
      setForm({ date: '', title: '', category: 'event' });
      onAdded();
      toast.success(tr('Date added', 'Date ajoutée'));
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <Field label={tr('Date', 'Date')}>
        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </Field>
      <Field label={tr('What happens', 'Ce qui est prévu')} className="min-w-56 flex-1">
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr('Staff meeting…', 'Réunion des enseignants…')} />
      </Field>
      <Field label={tr('Kind', 'Type')}>
        <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })} className="w-40">
          {(['event', 'exam', 'deadline', 'holiday', 'official'] as EventCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c][lang === 'fr' ? 1 : 0]}
            </option>
          ))}
        </Select>
      </Field>
      <Button onClick={submit} loading={saving} disabled={!form.date || !form.title.trim()}>
        {tr('Add', 'Ajouter')}
      </Button>
    </div>
  );
}
