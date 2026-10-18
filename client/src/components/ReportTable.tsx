import { Download, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { downloadCsv } from '../lib/csv';
import { fmtNum } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import type { Stats } from '../lib/types';
import { SchoolLogo } from './SchoolLogo';
import { Button, cx } from './ui';

export interface ReportColumn<R> {
  key: string;
  header: ReactNode;
  csvHeader: string;
  group?: string;
  render: (row: R) => ReactNode;
  csv: (row: R) => string | number | null | undefined;
  stats?: Stats;
  format?: (v: number | null) => string;
  align?: 'left' | 'center';
  className?: string;
}

export function ReportActions({ onCsv }: { onCsv: () => void }) {
  const { tr } = useLang();
  return (
    <>
      <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={onCsv}>
        CSV
      </Button>
      <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
        {tr('Print', 'Imprimer')}
      </Button>
    </>
  );
}

export function exportReportCsv<R>(filename: string, columns: Array<ReportColumn<R>>, rows: R[]) {
  downloadCsv(filename, [columns.map((c) => c.csvHeader), ...rows.map((r) => columns.map((c) => c.csv(r)))]);
}

export function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-slate-300">–</span>;
  const tone = rank === 1 ? 'bg-amber-400 text-amber-950' : rank === 2 ? 'bg-slate-300 text-slate-800' : rank === 3 ? 'bg-orange-300 text-orange-950' : 'bg-slate-100 text-slate-700';
  return <span className={cx('rank-badge inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold', tone)}>{rank}</span>;
}

/** Class report table with grouped headers and class average / highest / lowest rows. */
export function ReportTable<R extends { pupilId: number; status: string }>({ rows, columns }: { rows: R[]; columns: Array<ReportColumn<R>> }) {
  const { lang, tr } = useLang();
  const groups: Array<{ label: string; span: number }> = [];
  for (const c of columns) {
    const label = c.group ?? '';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.span += 1;
    else groups.push({ label, span: 1 });
  }
  const statRows: Array<[string, keyof Stats]> = [
    [tr('Class average', 'Moyenne de la classe'), 'avg'],
    [tr('Highest', 'Plus haut'), 'max'],
    [tr('Lowest', 'Plus bas'), 'min'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="print-table w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500">
            {groups.map((g, i) => (
              <th key={i} colSpan={g.span} className={cx('border-b border-slate-200 bg-white px-1 py-1.5 font-semibold', g.label && 'border-l text-center')}>
                {g.label}
              </th>
            ))}
          </tr>
          <tr className="text-xs text-slate-600">
            {columns.map((c) => (
              <th key={c.key} className={cx('border-b border-slate-200 bg-slate-50 px-1.5 py-2 font-semibold leading-tight', c.align === 'left' ? 'text-left' : 'text-center')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pupilId} className={cx('hover:bg-slate-50', r.status !== 'Active' && 'text-slate-400')}>
              {columns.map((c) => (
                <td key={c.key} className={cx('border-b border-slate-100 px-1.5 py-1.5 tabular-nums', c.align === 'left' ? 'text-left' : 'text-center', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tbody>
          {statRows.map(([label, key], i) => (
            <tr key={key} className="bg-slate-50 text-xs font-semibold text-slate-600">
              {columns.map((c, ci) => {
                if (ci === 0) {
                  const leading = columns.findIndex((x) => x.stats !== undefined || x.align !== 'left');
                  return (
                    <td key={c.key} colSpan={Math.max(1, leading)} className={cx('px-2 py-1.5 text-left', i === 0 && 'border-t border-slate-200')}>
                      {label}
                    </td>
                  );
                }
                const leading = columns.findIndex((x) => x.stats !== undefined || x.align !== 'left');
                if (ci < leading) return null;
                const v = c.stats ? c.stats[key] : null;
                return (
                  <td key={c.key} className={cx('px-2 py-1.5 text-center tabular-nums', i === 0 && 'border-t border-slate-200')}>
                    {c.stats ? (c.format ? c.format(v as number | null) : fmtNum(v as number | null, lang)) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CountsBar({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
      {items.map(([label, value]) => (
        <span key={label}>
          {label}: <strong className="text-slate-900">{value}</strong>
        </span>
      ))}
    </div>
  );
}

/**
 * Letterhead printed above a class report: the crest, the school, and which report this is.
 * On screen the sidebar already carries the crest, so this only appears on paper.
 */
export function ReportLetterhead({ title, period }: { title: string; period?: string }) {
  const settings = useMetaData().settings;
  const school = [settings?.schoolName, settings?.schoolSubtitle].filter(Boolean).join(' — ');
  return (
    <div className="hidden border-b-2 border-school-800 print:block">
      <div className="flex items-center gap-3 border-b border-school-400 px-4 pb-2 pt-3">
        <SchoolLogo
          version={settings?.logoVersion}
          fallback={settings?.schoolName}
          className="h-12 w-12 object-contain"
          monogramClassName="h-12 w-12 rounded-full border-2 border-school-800 text-[8px] font-bold leading-tight"
        />
        <div className="flex-1 text-center">
          <p className="text-sm font-extrabold uppercase tracking-wide text-school-900">{school}</p>
          <p className="text-xs font-bold">{title}</p>
          {period ? <p className="text-[11px] text-slate-600">{period}</p> : null}
        </div>
        <div className="w-12" />
      </div>
    </div>
  );
}
