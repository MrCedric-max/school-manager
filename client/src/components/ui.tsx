import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useLang } from '../lib/i18n';
import type { SaveState } from '../lib/hooks';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-school-700 text-white hover:bg-school-800 shadow-sm disabled:bg-school-700/50',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-600/50',
  subtle: 'bg-school-50 text-school-800 hover:bg-school-100 disabled:text-school-800/50',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-600 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-school-700">{icon}</div>}
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('no-print mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', className ?? 'bg-slate-100 text-slate-700')}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-school-700', className)} />;
}

export function LoadingBlock({ label }: { label?: string }) {
  const { tr } = useLang();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {label ?? tr('Loading…', 'Chargement…')}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { tr } = useLang();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tr('Retry', 'Réessayer')}
        </Button>
      )}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-school-600 focus:ring-2 focus:ring-school-600/20 disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, 'h-auto min-h-20 py-2', className)} {...rest} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx('w-full rounded-2xl bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: ReactNode }> }) {
  return (
    <div className="no-print inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.value ? 'bg-white text-school-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'school' }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'school' | 'amber' | 'sky' | 'violet' | 'rose' | 'slate' }) {
  const tones = {
    school: 'bg-school-50 text-school-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cx('rounded-lg p-2', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  );
}

export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error?: string | null; onRetry?: () => void }) {
  const { tr } = useLang();
  if (state === 'idle') return <span className="text-xs text-slate-400">{tr('Changes save automatically', 'Enregistrement automatique')}</span>;
  if (state === 'pending' || state === 'saving')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr('Saving…', 'Enregistrement…')}
      </span>
    );
  if (state === 'saved')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-school-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {tr('All changes saved', 'Tout est enregistré')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-700">
      <AlertTriangle className="h-3.5 w-3.5" /> {error ?? tr('Not saved', 'Non enregistré')}
      {onRetry && (
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          {tr('Retry', 'Réessayer')}
        </button>
      )}
    </span>
  );
}

// ---- Toasts -----------------------------------------------------------------

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

const ToastContext = createContext<(kind: Toast['kind'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg',
              t.kind === 'success' && 'border-school-200 bg-school-50 text-school-900',
              t.kind === 'error' && 'border-red-200 bg-red-50 text-red-900',
              t.kind === 'info' && 'border-slate-200 bg-white text-slate-800',
            )}
          >
            {t.kind === 'error' ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (m: string) => push('success', m),
    error: (m: unknown) => push('error', m instanceof Error ? m.message : String(m)),
    info: (m: string) => push('info', m),
  };
}

export function CoteBadge({ code, className }: { code: string | null | undefined; className?: string }) {
  if (!code) return <span className="text-slate-300">–</span>;
  const tone =
    code === 'A+'
      ? 'bg-school-600 text-white'
      : code === 'A'
        ? 'bg-school-100 text-school-800'
        : code === 'ECA/B'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-700';
  return <span className={cx('cote-badge inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-bold', tone, className)}>{code}</span>;
}
