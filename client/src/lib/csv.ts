/** Download rows as a CSV file that opens correctly in Excel (UTF-8 BOM, ; separator). */
export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = '\uFEFF' + rows.map((r) => r.map(escape).join(';')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const round2 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
