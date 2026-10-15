import { FileSpreadsheet, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtNum } from '../lib/format';
import { useLang } from '../lib/i18n';
import { EmptyState, cx } from './ui';

export function NoPupils() {
  const { tr } = useLang();
  return (
    <EmptyState icon={<Users className="h-10 w-10" />} title={tr('No pupils in this class yet', 'Aucun élève dans cette classe')}>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
          <FileSpreadsheet className="h-4 w-4" /> {tr('Import the workbook', 'Importer le classeur')}
        </Link>
        <Link to="/pupils" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <UserPlus className="h-4 w-4" /> {tr('Add pupils', 'Ajouter des élèves')}
        </Link>
      </div>
    </EmptyState>
  );
}

/** Footer row: "Class average" followed by one cell per value. */
export function AverageRow({ label, values, leading = 1, trailing = 0, digits = 2 }: { label: ReactNode; values: Array<number | null>; leading?: number; trailing?: number; digits?: number }) {
  const { lang } = useLang();
  return (
    <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
      <td className="sticky-col border-t border-slate-200 bg-slate-50 px-2 py-2" colSpan={leading}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="border-t border-slate-200 px-1 py-2 text-center tabular-nums">
          {fmtNum(v, lang, digits)}
        </td>
      ))}
      {trailing > 0 && <td colSpan={trailing} className="border-t border-slate-200" />}
    </tr>
  );
}

export function InfoNote({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'emerald' }) {
  return (
    <div
      className={cx(
        'mb-4 rounded-xl border px-4 py-3 text-sm',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-900',
        tone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
        tone === 'slate' && 'border-slate-200 bg-white text-slate-600',
      )}
    >
      {children}
    </div>
  );
}
