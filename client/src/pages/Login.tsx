import { useQueryClient } from '@tanstack/react-query';
import { GraduationCap, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, cx } from '../components/ui';
import { api } from '../lib/api';
import type { AuthStatus } from '../lib/hooks';
import { useLang } from '../lib/i18n';

export default function LoginPage({ status }: { status: AuthStatus }) {
  const { lang, setLang, tr } = useLang();
  const qc = useQueryClient();
  const setup = status.setupRequired;
  const [username, setUsername] = useState(setup ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (path: string, credentials: { username: string; password: string }) => {
    setError(null);
    setBusy(true);
    try {
      await api.post(path, credentials);
      await qc.invalidateQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (setup && password !== confirm) {
      setError(tr('The two passwords are different', 'Les deux mots de passe sont différents'));
      return;
    }
    void send(setup ? '/auth/setup' : '/auth/login', { username, password });
  };

  const demo = status.demo;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950">
      <div className="flex justify-end p-4">
        <div className="flex rounded-lg bg-white/10 p-0.5 text-xs font-semibold">
          {(['en', 'fr'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cx('rounded-md px-2.5 py-1 uppercase', lang === l ? 'bg-white text-emerald-900' : 'text-emerald-100 hover:text-white')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center text-white">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-emerald-950 shadow-lg">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">{status.school.name || 'School Manager'}</h1>
            <p className="text-sm text-emerald-100/80">
              {status.school.subtitle} {status.school.academicYear && `· ${status.school.academicYear}`}
            </p>
          </div>
          <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-2">
              {setup ? <ShieldCheck className="h-5 w-5 text-emerald-700" /> : <KeyRound className="h-5 w-5 text-emerald-700" />}
              <h2 className="text-lg font-semibold text-slate-900">
                {setup ? tr('Create the administrator account', 'Créer le compte administrateur') : tr('Sign in', 'Connexion')}
              </h2>
            </div>
            {setup && (
              <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                {tr(
                  'First start: choose the username and password that will protect the school data.',
                  'Premier démarrage : choisissez l’identifiant et le mot de passe qui protégeront les données de l’école.',
                )}
              </p>
            )}
            <div className="space-y-4">
              <Field label={tr('Username', 'Identifiant')}>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus={!setup} required />
              </Field>
              <Field label={tr('Password', 'Mot de passe')} hint={setup ? tr('At least 8 characters', 'Au moins 8 caractères') : undefined}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={setup ? 'new-password' : 'current-password'}
                  autoFocus={setup}
                  required
                />
              </Field>
              {setup && (
                <Field label={tr('Confirm password', 'Confirmer le mot de passe')}>
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                </Field>
              )}
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="w-full" loading={busy}>
                {setup ? tr('Create account', 'Créer le compte') : tr('Sign in', 'Se connecter')}
              </Button>
            </div>
          </form>
          {demo && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 shadow-xl" data-testid="demo-account">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-amber-600" />
                {tr('Demo account', 'Compte de démonstration')}
              </div>
              <p className="mb-3 text-amber-900/80">
                {setup
                  ? tr('Just looking? Explore the app with invented pupils and marks.', 'Simple visite ? Découvrez l’application avec des élèves et des notes fictifs.')
                  : tr('Explore the app with invented pupils and marks.', 'Découvrez l’application avec des élèves et des notes fictifs.')}
              </p>
              <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-amber-900/70">{tr('Username', 'Identifiant')}</dt>
                <dd className="font-mono font-semibold select-all">{demo.username}</dd>
                <dt className="text-amber-900/70">{tr('Password', 'Mot de passe')}</dt>
                <dd className="font-mono font-semibold select-all">{demo.password}</dd>
              </dl>
              <Button type="button" variant="secondary" className="w-full" loading={busy} onClick={() => void send('/auth/login', demo)}>
                {tr('Sign in with the demo account', 'Se connecter avec le compte de démo')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
