import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayMonth, fmtDate, monthLabel } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import { Field, Select, cx } from './ui';

function StepButton({ dir, onClick, disabled, label }: { dir: 'prev' | 'next'; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      {dir === 'prev' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

export function ClassSelect({ className }: { className?: string }) {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { tr } = useLang();
  return (
    <Field label={tr('Class', 'Classe')} className={className}>
      <Select value={sel.classId} onChange={(e) => update({ classId: Number(e.target.value) })} className="min-w-32">
        {/* The school runs two cycles: they are marked differently, so the list says which is which. */}
        {[
          ['primary', tr('Primary', 'Primaire')],
          ['college', tr('College', 'Collège')],
        ].map(([cycle, label]) => (
          <optgroup key={cycle} label={label}>
            {meta.classes
              .filter((c) => c.cycle === cycle)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.enrolled})
                </option>
              ))}
          </optgroup>
        ))}
        {meta.classes
          .filter((c) => c.cycle !== 'primary' && c.cycle !== 'college')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.enrolled})
            </option>
          ))}
      </Select>
    </Field>
  );
}

export function WeekSelect() {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  const weeks = meta.calendar.weeks;
  const idx = weeks.findIndex((w) => w.number === sel.week);
  return (
    <Field label={tr('Week', 'Semaine')}>
      <div className="flex gap-1">
        <StepButton dir="prev" label={tr('Previous week', 'Semaine précédente')} disabled={idx <= 0} onClick={() => update({ week: weeks[idx - 1].number })} />
        <Select value={sel.week} onChange={(e) => update({ week: Number(e.target.value) })} className="min-w-52">
          {weeks.map((w) => (
            <option key={w.number} value={w.number}>
              W{w.number} · {dayMonth(w.monday, lang)} – {dayMonth(w.friday, lang)}
              {w.schoolDays === 0 ? ` (${tr('no school', 'pas de classe')})` : ''}
              {w.number === meta.today.week ? ` · ${tr('this week', 'cette semaine')}` : ''}
            </option>
          ))}
        </Select>
        <StepButton dir="next" label={tr('Next week', 'Semaine suivante')} disabled={idx >= weeks.length - 1} onClick={() => update({ week: weeks[idx + 1].number })} />
      </div>
    </Field>
  );
}

export function MonthSelect({ uaOnly = false }: { uaOnly?: boolean }) {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  const months = uaOnly ? meta.calendar.months.filter((m) => m.uaTerm) : meta.calendar.months;
  const current = uaOnly ? sel.uaMonth : sel.month;
  const set = (key: string) => update(uaOnly ? { uaMonth: key } : { month: key });
  const idx = months.findIndex((m) => m.key === current);
  return (
    <Field label={tr('Month', 'Mois')}>
      <div className="flex gap-1">
        <StepButton dir="prev" label={tr('Previous month', 'Mois précédent')} disabled={idx <= 0} onClick={() => set(months[idx - 1].key)} />
        <Select value={current} onChange={(e) => set(e.target.value)} className="min-w-52">
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {monthLabel(m, lang)}
              {m.uaTerm ? ` · ${tr('Term', 'Trim.')} ${m.uaTerm} UA${m.uaIndex}` : ''}
            </option>
          ))}
        </Select>
        <StepButton dir="next" label={tr('Next month', 'Mois suivant')} disabled={idx >= months.length - 1} onClick={() => set(months[idx + 1].key)} />
      </div>
    </Field>
  );
}

export function TermSelect() {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  return (
    <Field label={tr('Term', 'Trimestre')}>
      <Select value={sel.term} onChange={(e) => update({ term: Number(e.target.value) })} className="min-w-56">
        {meta.calendar.terms.map((t) => (
          <option key={t.number} value={t.number}>
            {tr('Term', 'Trimestre')} {t.number} · {dayMonth(t.start, lang)} – {fmtDate(t.end, lang)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function SchoolDayPicker() {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  const days = meta.calendar.schoolDays;
  const idx = days.indexOf(sel.date);
  const pick = (value: string) => {
    if (days.includes(value)) return update({ date: value });
    // Snap to the nearest school day on or before the chosen date.
    const before = [...days].reverse().find((d) => d <= value);
    update({ date: before ?? days[0] });
  };
  return (
    <Field label={tr('School day', 'Jour de classe')}>
      <div className="flex gap-1">
        <StepButton dir="prev" label={tr('Previous school day', 'Jour précédent')} disabled={idx <= 0} onClick={() => update({ date: days[idx - 1] })} />
        <div className="relative">
          <input
            type="date"
            value={sel.date}
            min={days[0]}
            max={days[days.length - 1]}
            onChange={(e) => e.target.value && pick(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-school-600 focus:ring-2 focus:ring-school-600/20"
          />
        </div>
        <StepButton dir="next" label={tr('Next school day', 'Jour suivant')} disabled={idx < 0 || idx >= days.length - 1} onClick={() => update({ date: days[idx + 1] })} />
      </div>
      <span className={cx('text-xs', sel.date === meta.today.date ? 'text-school-700' : 'text-slate-500')}>
        {fmtDate(sel.date, lang, 'long')}
        {sel.date === meta.today.date ? ` · ${tr('today', "aujourd'hui")}` : ''}
      </span>
    </Field>
  );
}
