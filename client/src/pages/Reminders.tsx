import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CalendarClock, CircleAlert, Mail, MailCheck, Send, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, LoadingBlock, PageHeader, Select, StatCard, cx, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { EventCategory, OutboxMessage, RemindersData } from '../lib/types';

const CATEGORY_LABEL: Record<EventCategory, [string, string]> = {
  official: ['Official dates', 'Dates officielles'],
  break: ['Holidays', 'Vacances'],
  holiday: ['Public holidays', 'Jours fériés'],
  exam: ['Exams', 'Examens'],
  deadline: ['Deadlines', 'Échéances'],
  event: ['School events', 'Événements'],
};

const CATEGORY_STYLE: Record<EventCategory, string> = {
  official: 'bg-school-100 text-school-800',
  break: 'bg-amber-100 text-amber-800',
  holiday: 'bg-orange-100 text-orange-800',
  exam: 'bg-violet-100 text-violet-800',
  deadline: 'bg-rose-100 text-rose-700',
  event: 'bg-slate-100 text-slate-700',
};

/**
 * Reminders: who is told about the school's dates, how long beforehand, and — while no mail
 * server is set up — exactly the messages that would go out.
 */
export function Reminders() {
  const { lang, tr } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['reminders'], queryFn: () => api.get<RemindersData>('/reminders') });

  if (q.isPending) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;
  const { settings, mail, preview } = data;

  const refresh = () => qc.invalidateQueries({ queryKey: ['reminders'] });

  const call = async (fn: () => Promise<unknown>, message: string) => {
    try {
      const res = (await fn()) as { messages?: Array<{ to: string }> };
      refresh();
      if (message) toast.success(message);
      return res;
    } catch (e) {
      toast.error(e);
      return null;
    }
  };

  const save = async (patch: Record<string, unknown>, message: string) =>
    call(() => api.put('/reminders/settings', patch), message);

  const leadText = settings.leadDays.join(', ');

  return (
    <>
      <PageHeader
        title={tr('Reminders', 'Rappels')}
        subtitle={tr(
          'The school’s dates, e-mailed to everybody with an invitation they can drop straight into their own calendar.',
          'Les dates de l’école envoyées par e-mail à tous, avec une invitation à déposer directement dans leur agenda.',
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={tr('Reminders', 'Rappels')}
          value={settings.enabled ? tr('On', 'Activés') : tr('Off', 'Désactivés')}
          icon={settings.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          tone={settings.enabled ? 'school' : 'slate'}
          hint={`${leadText} ${lang === 'fr' ? 'jours avant' : 'days before'}`}
        />
        <StatCard label={tr('People told', 'Personnes prévenues')} value={data.recipients.length} icon={<Users className="h-5 w-5" />} tone="sky" />
        <StatCard label={tr('Dates in the next 30 days', 'Dates dans les 30 jours')} value={preview.groups.length} icon={<CalendarClock className="h-5 w-5" />} tone="violet" />
        <StatCard
          label={tr('Delivery', 'Envoi')}
          value={mail.configured ? tr('Mail server', 'Serveur mail') : tr('Not set up', 'Non configuré')}
          icon={mail.configured ? <MailCheck className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
          tone={mail.configured ? 'school' : 'amber'}
          hint={mail.configured ? mail.host : tr('Nothing leaves the app yet', 'Rien ne sort encore de l’application')}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<Bell className="h-5 w-5" />}
              title={tr('When to remind', 'Quand rappeler')}
              subtitle={tr('Saved as you change it.', 'Enregistré à chaque modification.')}
            />
            <div className="space-y-4 p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-school-300"
                onClick={() => void save({ enabled: !settings.enabled }, '')}
              >
                <span>
                  <span className="block text-sm font-medium text-slate-800">{tr('Send reminders by e-mail', 'Envoyer des rappels par e-mail')}</span>
                  <span className="block text-xs text-slate-500">
                    {tr('One message per person per date, with a calendar invitation attached.', 'Un message par personne et par date, avec une invitation d’agenda jointe.')}
                  </span>
                </span>
                <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', settings.enabled ? 'bg-school-700' : 'bg-slate-300')}>
                  <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', settings.enabled ? 'left-5.5' : 'left-0.5')} />
                </span>
              </button>

              <Field
                label={tr('Days of notice', 'Jours de préavis')}
                hint={tr('Comma separated: 7, 1 means one reminder a week before and one the day before.', 'Séparés par des virgules : 7, 1 signifie un rappel une semaine avant et un la veille.')}
              >
                <Input
                  value={leadText}
                  onChange={(e) => setLeadDebounced(e.target.value, save, settings.enabled)}
                  placeholder="7, 1"
                />
              </Field>

              <Field label={tr('Time of day', 'Heure d’envoi')} hint={tr('The server sends the day’s reminders at this hour.', 'Le serveur envoie les rappels du jour à cette heure.')}>
                <Select value={String(settings.hour)} onChange={(e) => void save({ hour: Number(e.target.value) }, '')} className="w-32">
                  {[5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 19, 20].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={tr('Which dates', 'Quelles dates')}>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => {
                    const on = settings.categories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={cx(
                          'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                          on ? 'border-school-600 bg-school-50 text-school-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                        )}
                        onClick={() =>
                          void save(
                            { categories: on ? settings.categories.filter((x) => x !== c) : [...settings.categories, c] },
                            '',
                          )
                        }
                      >
                        {CATEGORY_LABEL[c][lang === 'fr' ? 1 : 0]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="rounded-xl border border-slate-200 p-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium text-slate-800">{tr('Draft next year on its own', 'Préparer l’année suivante automatiquement')}</span>
                    <span className="block text-xs text-slate-500">
                      {tr('Reads the national calendar for the next year and leaves it as a draft to check.', 'Lit le calendrier national de l’année suivante et le laisse en brouillon à vérifier.')}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-school-700"
                    checked={settings.autoPrepare}
                    onChange={(e) => void save({ autoPrepare: e.target.checked }, '')}
                  />
                </label>
                {settings.autoPrepare && (
                  <div className="mt-3">
                    <Field label={tr('How long before the year ends', 'Combien de jours avant la fin de l’année')}>
                      <Input
                        type="number"
                        min={1}
                        max={180}
                        className="w-28"
                        value={String(settings.prepareDays)}
                        onChange={(e) => void save({ prepareDays: Number(e.target.value) }, '')}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <DeliveryCard mail={mail} accounts={data.accounts} onSent={refresh} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<Users className="h-5 w-5" />}
              title={tr('Who is told', 'Qui est prévenu')}
              subtitle={tr('Everybody with an account and an address, plus anybody on the list below.', 'Tous ceux qui ont un compte et une adresse, plus toutes les personnes de la liste ci-dessous.')}
            />
            <ul className="divide-y divide-slate-100">
              {data.accounts.map((a) => (
                <AccountEmailRow key={a.id} account={a} onSaved={refresh} />
              ))}
              {data.subscribers.map((s) => (
                <li key={`s${s.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800">{s.name || s.email}</span>
                    <span className="ml-2 text-slate-500">{s.email}</span>
                  </span>
                  <Badge className={s.active ? 'bg-school-50 text-school-700' : 'bg-slate-100 text-slate-500'}>
                    {s.active ? tr('On the list', 'Sur la liste') : tr('Paused', 'En pause')}
                  </Badge>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 hover:text-school-700"
                    onClick={() => void call(() => api.put(`/reminders/subscribers/${s.id}`, { active: !s.active }), '')}
                  >
                    {s.active ? tr('Pause', 'Suspendre') : tr('Resume', 'Reprendre')}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-400 hover:text-red-600"
                    onClick={() => void call(() => api.del(`/reminders/subscribers/${s.id}`), tr('Removed from the list', 'Retiré de la liste'))}
                  >
                    {tr('Remove', 'Retirer')}
                  </button>
                </li>
              ))}
              {data.subscribers.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">{tr('Nobody on the list yet.', 'Personne sur la liste pour l’instant.')}</li>
              )}
            </ul>
            <AddSubscriber onAdded={refresh} />
          </Card>

          <Card>
            <CardHeader
              icon={<CalendarClock className="h-5 w-5" />}
              title={tr('What goes out next', 'Ce qui partira')}
              subtitle={tr('The dates of the next 30 days, as they will be written.', 'Les dates des 30 prochains jours, telles qu’elles seront rédigées.')}
              actions={
                <Button
                  size="sm"
                  icon={<Send className="h-4 w-4" />}
                  onClick={() =>
                    void call(() => api.post('/reminders/send', { dryRun: mail.configured ? false : true }), '').then((r) => {
                      if (r) toast.success(tr(`${(r as { sent?: number }).sent ?? 0} messages prepared`, `${(r as { sent?: number }).sent ?? 0} messages préparés`));
                    })
                  }
                >
                  {tr('Run now', 'Lancer maintenant')}
                </Button>
              }
            />
            {preview.groups.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                {tr('Nothing is due in the next 30 days.', 'Rien n’est à envoyer dans les 30 prochains jours.')}
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {preview.groups.map((g) => (
                  <li key={`${g.date}-${g.lead}`} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{fmtDate(g.date, lang)}</span>
                      <Badge className={cx(g.due ? 'bg-school-50 text-school-700' : 'bg-slate-100 text-slate-500')}>
                        {g.lead <= 0 ? tr('that day', 'le jour même') : lang === 'fr' ? `${g.lead} j avant` : `${g.lead} d before`}
                      </Badge>
                      <span className="text-xs text-slate-400">{fmtDate(g.sendOn, lang)}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {g.items.map((i) => (
                        <li key={i.key} className="flex items-center gap-2 text-sm text-slate-700">
                          <Badge className={CATEGORY_STYLE[i.category]}>{CATEGORY_LABEL[i.category]?.[lang === 'fr' ? 1 : 0]}</Badge>
                          <span className="truncate">{i.title}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Outbox messages={data.outbox} onChanged={refresh} />
        </div>
      </div>
    </>
  );
}

/** Typing "7, 1" must not fire a save on every keystroke. */
let leadTimer: ReturnType<typeof setTimeout> | null = null;
function setLeadDebounced(value: string, save: (patch: Record<string, unknown>, message: string) => Promise<unknown>, _enabled: boolean) {
  const numbers = value
    .split(/[^\d]+/)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 60);
  if (leadTimer) clearTimeout(leadTimer);
  leadTimer = setTimeout(() => void save({ leadDays: numbers.length ? numbers : [7] }, ''), 700);
}

function AccountEmailRow({ account, onSaved }: { account: RemindersData['accounts'][number]; onSaved: () => void }) {
  const { tr } = useLang();
  const toast = useToast();
  const [email, setEmail] = useState(account.email);
  useEffect(() => setEmail(account.email), [account.email]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/reminders/accounts/${account.id}/email`, { email });
      onSaved();
      toast.success(tr('Address saved', 'Adresse enregistrée'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <span className="w-28 shrink-0 font-medium text-slate-800">{account.username}</span>
      <Input
        type="email"
        className="h-8 min-w-48 flex-1"
        placeholder={tr('name@school.cm', 'nom@ecole.cm')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => email !== account.email && void save()}
        onKeyDown={(e) => e.key === 'Enter' && void save()}
      />
      {busy && <span className="text-xs text-slate-400">…</span>}
      {account.demo && <Badge className="bg-amber-50 text-amber-700">{tr('demo account', 'compte démo')}</Badge>}
    </li>
  );
}

function AddSubscriber({ onAdded }: { onAdded: () => void }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', name: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/reminders/subscribers', form);
      setForm({ email: '', name: '' });
      onAdded();
      toast.success(tr('Added to the list', 'Ajouté à la liste'));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-4">
      <Field label={tr('E-mail', 'E-mail')} className="min-w-52 flex-1">
        <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nom@ecole.cm" />
      </Field>
      <Field label={tr('Name (optional)', 'Nom (facultatif)')} className="min-w-40 flex-1">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="M. Nkodo" />
      </Field>
      <Button type="submit" loading={busy}>
        {tr('Add', 'Ajouter')}
      </Button>
    </form>
  );
}

function DeliveryCard({ mail, accounts, onSent }: { mail: RemindersData['mail']; accounts: RemindersData['accounts']; onSent: () => void }) {
  const { tr } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const me = accounts.find((a) => a.email);

  const test = async () => {
    setBusy(true);
    try {
      const res = (await api.post('/reminders/test', {})) as { status: string; detail?: string };
      onSent();
      toast.success(res.status === 'sent' ? tr('Test message sent', 'Message de test envoyé') : tr('Test message prepared', 'Message de test préparé'));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Mail className="h-5 w-5" />}
        title={tr('E-mail delivery', 'Envoi des e-mails')}
        subtitle={
          mail.configured
            ? `${mail.host}:${mail.port} · ${mail.from}`
            : tr('No mail server is set up yet — nothing is delivered.', 'Aucun serveur mail n’est encore configuré — rien n’est envoyé.')
        }
      />
      <div className="space-y-3 p-5">
        {mail.configured ? (
          <p className="rounded-xl bg-school-50 p-3 text-sm text-school-800">
            {tr('Messages leave the app through', 'Les messages quittent l’application via')} <strong>{mail.host}</strong>.
          </p>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">{tr('Everything is prepared, nothing is delivered', 'Tout est préparé, rien n’est envoyé')}</p>
            <p className="mt-1 text-xs">
              {tr(
                'Set these on the server to start sending: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM.',
                'Renseignez ceci sur le serveur pour commencer à envoyer : MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM.',
              )}
            </p>
            <p className="mt-1 text-xs">
              {tr('Missing now:', 'Manquants :')} {mail.missing.join(', ')}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Mail className="h-4 w-4" />} onClick={test} loading={busy} disabled={!me}>
            {tr('Send me a test', 'M’envoyer un test')}
          </Button>
          {!me && <span className="text-xs text-slate-500">{tr('Add your address above first.', 'Ajoutez d’abord votre adresse ci-dessus.')}</span>}
        </div>
      </div>
    </Card>
  );
}

function Outbox({ messages, onChanged }: { messages: OutboxMessage[]; onChanged: () => void }) {
  const { lang, tr } = useLang();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    try {
      await api.del('/reminders/outbox');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const download = (m: OutboxMessage) => {
    const url = URL.createObjectURL(new Blob([m.ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invite.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader
        icon={<Send className="h-5 w-5" />}
        title={tr('Outbox', 'Boîte d’envoi')}
        subtitle={tr('The last messages prepared or sent.', 'Les derniers messages préparés ou envoyés.')}
        actions={messages.length ? (
          <Button variant="ghost" size="sm" onClick={clear} loading={busy}>
            {tr('Empty', 'Vider')}
          </Button>
        ) : undefined}
      />
      {messages.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">{tr('Nothing prepared yet.', 'Rien de préparé pour l’instant.')}</p>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-2 text-sm">
              <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === m.id ? null : m.id)}>
                <span className="w-52 shrink-0 truncate text-slate-500">{m.recipient}</span>
                <span className="min-w-0 flex-1 truncate">{m.subject}</span>
                <Badge className={m.status === 'sent' ? 'bg-school-50 text-school-700' : m.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}>
                  {m.status === 'sent' ? tr('sent', 'envoyé') : m.status === 'failed' ? tr('failed', 'échec') : tr('not delivered', 'non envoyé')}
                </Badge>
                <span className="w-20 shrink-0 text-right text-xs text-slate-400">{fmtDate(m.createdAt.slice(0, 10), lang)}</span>
              </button>
              {open === m.id && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3">
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700">{m.body}</pre>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => download(m)}>
                      {tr('Download the invitation', 'Télécharger l’invitation')}
                    </Button>
                  </div>
                  {m.detail && <p className="mt-2 text-xs text-slate-500">{m.detail}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default Reminders;
