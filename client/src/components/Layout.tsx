import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  NotebookPen,
  Printer,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api, setSessionToken } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useAuthStatus, useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { cx } from './ui';

interface NavItem {
  to: string;
  en: string;
  fr: string;
  icon: ReactNode;
}

const ICON = 'h-4.5 w-4.5';

const SECTIONS: Array<{ en: string; fr: string; items: NavItem[] }> = [
  {
    en: 'Overview',
    fr: 'Vue d’ensemble',
    items: [
      { to: '/', en: 'Dashboard', fr: 'Tableau de bord', icon: <LayoutDashboard className={ICON} /> },
      { to: '/statistics', en: 'Statistics', fr: 'Statistiques', icon: <BarChart3 className={ICON} /> },
    ],
  },
  {
    en: 'Every day',
    fr: 'Au quotidien',
    items: [
      { to: '/roll-call', en: 'Roll call', fr: 'Appel', icon: <CalendarCheck className={ICON} /> },
      { to: '/performance', en: 'Daily performance', fr: 'Performance quotidienne', icon: <TrendingUp className={ICON} /> },
    ],
  },
  {
    en: 'Assessments',
    fr: 'Évaluations',
    items: [
      { to: '/controls', en: 'Weekly controls', fr: 'Contrôles hebdo.', icon: <ClipboardCheck className={ICON} /> },
      { to: '/monthly-marks', en: 'Monthly marks', fr: 'Notes mensuelles', icon: <NotebookPen className={ICON} /> },
      { to: '/term-marks', en: 'Term marks', fr: 'Notes trimestrielles', icon: <ListChecks className={ICON} /> },
    ],
  },
  {
    en: 'Reports',
    fr: 'Rapports',
    items: [
      { to: '/reports/weekly', en: 'Weekly report', fr: 'Rapport hebdomadaire', icon: <FileText className={ICON} /> },
      { to: '/reports/monthly', en: 'Monthly report', fr: 'Rapport mensuel', icon: <FileText className={ICON} /> },
      { to: '/reports/term', en: 'Term report', fr: 'Rapport trimestriel', icon: <FileText className={ICON} /> },
      { to: '/report-cards', en: 'Report cards', fr: 'Bulletins', icon: <Printer className={ICON} /> },
    ],
  },
  {
    en: 'School',
    fr: 'École',
    items: [
      { to: '/pupils', en: 'Pupils', fr: 'Élèves', icon: <Users className={ICON} /> },
      { to: '/calendar', en: 'Calendar', fr: 'Calendrier', icon: <CalendarDays className={ICON} /> },
      { to: '/settings', en: 'Settings & import', fr: 'Paramètres & import', icon: <Settings className={ICON} /> },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const meta = useMetaData();
  const { lang, setLang, tr } = useLang();
  const { data: auth } = useAuthStatus();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { today, settings } = meta;

  const dayLabel: Record<string, string> = {
    school: tr('School day', 'Jour de classe'),
    weekend: tr('Weekend', 'Week-end'),
    holiday: tr('Public holiday', 'Jour férié'),
    break: tr('Holidays (break)', 'Vacances'),
    outside: tr('Outside the school year', 'Hors année scolaire'),
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setSessionToken(null);
    qc.clear();
    window.location.assign('/');
  };

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-3 px-5 py-5" onClick={() => setOpen(false)}>
        {settings.hasLogo ? (
          <img src={`/api/logo?v=${settings.logoVersion}`} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-0.5" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-emerald-950">
            <GraduationCap className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white">{settings.schoolName || 'School Manager'}</p>
          <p className="truncate text-xs text-emerald-200/80">
            {tr('School Manager', 'Gestion scolaire')} · {settings.academicYear}
          </p>
        </div>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {SECTIONS.map((section) => (
          <div key={section.en}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/60">{lang === 'fr' ? section.fr : section.en}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-white/15 text-white' : 'text-emerald-100/85 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {item.icon}
                  {lang === 'fr' ? item.fr : item.en}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-emerald-100/85 hover:bg-white/10 hover:text-white"
        >
          <LogOut className={ICON} />
          {tr('Sign out', 'Déconnexion')}
          <span className="ml-auto truncate text-xs text-emerald-200/60">{auth?.user?.username}</span>
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 bg-emerald-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-emerald-900 shadow-xl">
            <button type="button" className="absolute right-3 top-5 rounded-lg p-1 text-emerald-100 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="hidden truncate font-medium text-slate-700 sm:inline">{fmtDate(today.date, lang, 'long')}</span>
            {today.term && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{tr('Term', 'Trimestre')} {today.term}</span>}
            {today.week && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">W{today.week}</span>}
            <span
              className={cx(
                'truncate rounded-md px-2 py-0.5 text-xs font-semibold',
                today.type === 'school' && 'bg-green-100 text-green-800',
                today.type === 'holiday' && 'bg-orange-100 text-orange-800',
                today.type === 'break' && 'bg-yellow-100 text-yellow-800',
                (today.type === 'weekend' || today.type === 'outside') && 'bg-slate-100 text-slate-600',
              )}
            >
              {today.holiday ?? dayLabel[today.type]}
            </span>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cx('rounded-md px-2 py-1 uppercase', lang === l ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-800')}
              >
                {l}
              </button>
            ))}
          </div>
        </header>

        {settings.demoMode && (
          <div className="no-print flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              {tr(
                'Demo data: these pupils and marks are invented so you can explore the app.',
                'Données de démonstration : ces élèves et ces notes sont fictifs.',
              )}
            </span>
            {location.pathname !== '/settings' && (
              <Link to="/settings" className="font-semibold underline">
                {tr('Import your School_Manager workbook', 'Importer votre classeur School_Manager')}
              </Link>
            )}
          </div>
        )}

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PrintHint() {
  const { tr } = useLang();
  return (
    <span className="no-print inline-flex items-center gap-1 text-xs text-slate-500">
      <BookOpenCheck className="h-3.5 w-3.5" />
      {tr('A4 — use "Fit to page" if needed', 'A4 — choisir « Ajuster à la page » si besoin')}
    </span>
  );
}
