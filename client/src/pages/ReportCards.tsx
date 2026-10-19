import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NoPupils } from '../components/Common';
import { PrintHint } from '../components/Layout';
import { SchoolLogo } from '../components/SchoolLogo';
import Bulletins from './Bulletins';
import { ClassSelect, MonthSelect, TermSelect } from '../components/Selectors';
import { Button, Card, ErrorBox, Field, LoadingBlock, PageHeader, Select, Tabs, Toolbar, cx } from '../components/ui';
import { api, qs } from '../lib/api';
import { both, coteMeaning, fmtNum, fmtPct, monthLabel } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { Cote, Lang, Meta, MonthlyCard, MonthlyCards, SchoolHeader, TermCard, TermCards } from '../lib/types';

const n2 = (v: number | null | undefined, lang: Lang) => fmtNum(v, lang, 2);
const mark = (v: number | null | undefined, lang: Lang) => (v === null || v === undefined ? '' : fmtNum(v, lang, Number.isInteger(v) ? 0 : 2));

function CardHeader({ school, title, logoVersion }: { school: SchoolHeader; title: string; logoVersion: string }) {
  // Two-tone rule under the letterhead, like the crest: the navy of the shield over its sky blue.
  return (
    <div className="mb-1.5 border-b-2 border-school-800">
      <div className="flex items-center gap-3 border-b border-school-400 pb-1.5">
        <SchoolLogo
          version={logoVersion}
          fallback={school.name}
          className="h-14 w-14 object-contain"
          monogramClassName="h-14 w-14 rounded-full border-2 border-school-800 text-[9px] font-bold leading-tight"
        />
        <div className="flex-1 text-center">
          <p className="text-[15px] font-extrabold uppercase tracking-wide text-school-900">
            {school.name}
            {school.subtitle ? ` — ${school.subtitle}` : ''}
          </p>
          <p className="text-[13px] font-bold">{title}</p>
          <p className="text-[11px]">Academic year / Année scolaire {school.academicYear}</p>
        </div>
        <div className="w-12" />
      </div>
    </div>
  );
}

function IdentityRow({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="mb-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded border border-slate-400 px-2 py-1 text-[11px]">
      {items.map(([label, value]) => (
        <p key={label}>
          <span className="text-slate-600">{label}</span> <strong>{value}</strong>
        </p>
      ))}
    </div>
  );
}

/** Class council remarks: editable on screen, printed as text (or blank lines). */
function Remarks({ pupilId, period, initial }: { pupilId: number; period: string; initial: string }) {
  const { tr } = useLang();
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setText(initial), [initial]);
  const save = (value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setState('saving');
      try {
        await api.put('/remarks', { pupilId, period, text: value });
        setState('saved');
      } catch {
        setState('error');
      }
    }, 700);
  };
  return (
    <>
      <div className="no-print">
        <textarea
          value={text}
          maxLength={600}
          onChange={(e) => {
            setText(e.target.value);
            save(e.target.value);
          }}
          placeholder={tr('Type the class council remarks (optional) — they will be printed here.', 'Saisissez les appréciations du conseil de classe (facultatif) — elles seront imprimées ici.')}
          className="h-14 w-full resize-none rounded border border-dashed border-slate-300 bg-school-50/60 p-1.5 text-[11px] outline-none focus:border-school-600"
        />
        <p className="text-right text-[9px] text-slate-400">
          {state === 'saving' ? tr('Saving…', 'Enregistrement…') : state === 'saved' ? tr('Saved', 'Enregistré') : state === 'error' ? tr('Not saved', 'Non enregistré') : ''}
        </p>
      </div>
      <div className="hidden min-h-8 whitespace-pre-wrap text-[11px] print:block">
        {text || (
          <>
            <div className="h-4 border-b border-dotted border-slate-400" />
            <div className="h-4 border-b border-dotted border-slate-400" />
          </>
        )}
      </div>
    </>
  );
}

function Signatures({ note }: { note?: string }) {
  return (
    <>
      <div className="mt-1.5 grid grid-cols-[1.5fr_1fr_1fr] gap-4">
        <div>
          <p className="font-semibold leading-tight">Observations et appréciations des parents / Parents&apos; observations:</p>
          <div className="h-3.5 border-b border-dotted border-slate-400" />
          <div className="h-3.5 border-b border-dotted border-slate-400" />
        </div>
        <div>
          <p className="font-semibold leading-tight">Visa des parents / Parents&apos; signature:</p>
          <div className="mt-7 border-b border-slate-500" />
        </div>
        <div>
          <p className="font-semibold leading-tight">The Principal / Le Directeur</p>
          <div className="mt-7 border-b border-slate-500" />
        </div>
      </div>
      {note && <p className="mt-1.5 text-[8.5px] italic leading-tight text-slate-600">{note}</p>}
    </>
  );
}

function SummaryBoxes({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <table className="mt-1">
      <tbody>
        <tr className="bg-school-50 text-[8.5px] font-semibold leading-tight">
          {items.map(([label]) => (
            <td key={label} className="text-center">
              {label}
            </td>
          ))}
        </tr>
        <tr className="text-[12px] font-bold">
          {items.map(([label, value]) => (
            <td key={label} className="text-center">
              {value}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function PerformanceBlock({ meta, values, attendance, title, lang }: { meta: Meta; values: Record<string, number | null>; attendance: string; title: string; lang: Lang }) {
  const areas = meta.framework.areas;
  const half = Math.ceil(areas.length / 2);
  const left = areas.slice(0, half);
  const right = areas.slice(half);
  return (
    <table className="mt-1.5">
      <thead>
        <tr className="bg-school-50">
          <th colSpan={4} className="text-left text-[10px]">
            {title}
          </th>
        </tr>
      </thead>
      <tbody>
        {left.map((a, i) => (
          <tr key={a.code}>
            <td className="w-[35%]">
              {i + 1} — {both(a.label_en, a.label_fr)}
            </td>
            <td className="w-[15%] text-center font-semibold">{n2(values[a.code], lang)}</td>
            {right[i] ? (
              <>
                <td className="w-[35%]">
                  {half + i + 1} — {both(right[i].label_en, right[i].label_fr)}
                </td>
                <td className="w-[15%] text-center font-semibold">{n2(values[right[i].code], lang)}</td>
              </>
            ) : (
              <>
                <td>Attendance / Présence:</td>
                <td className="text-center font-semibold">{attendance}</td>
              </>
            )}
          </tr>
        ))}
        {left.length === right.length && (
          <tr>
            <td colSpan={2} />
            <td>Attendance / Présence:</td>
            <td className="text-center font-semibold">{attendance}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function PerformanceList({ meta, values, attendance, title, lang }: { meta: Meta; values: Record<string, number | null>; attendance: string; title: string; lang: Lang }) {
  return (
    <table>
      <thead>
        <tr className="bg-school-50">
          <th colSpan={2} className="text-left text-[9.5px] leading-tight">
            {title}
          </th>
        </tr>
      </thead>
      <tbody>
        {meta.framework.areas.map((a, i) => (
          <tr key={a.code}>
            <td>
              {i + 1} — {both(a.label_en, a.label_fr)}
            </td>
            <td className="w-[26%] text-center font-semibold">{n2(values[a.code], lang)}</td>
          </tr>
        ))}
        <tr>
          <td>Attendance / Présence</td>
          <td className="whitespace-nowrap text-center text-[9px] font-semibold">{attendance}</td>
        </tr>
      </tbody>
    </table>
  );
}

function MonthlyCardView({ data, card, meta, lang }: { data: MonthlyCards; card: MonthlyCard; meta: Meta; lang: Lang }) {
  const cotes: Cote[] = meta.settings.cotes;
  const w = Math.round(meta.settings.academicWeight * 100);
  const att = card.attendance;
  return (
    <div className="report-card mx-auto mb-6 shadow-lg">
      <CardHeader school={data.school} title="MONTHLY REPORT CARD / BULLETIN MENSUEL" logoVersion={meta.settings.logoVersion} />
      <IdentityRow
        items={[
          ['Class / Classe:', data.class.name],
          ['Month / Mois:', `${data.month.name_en} / ${data.month.name_fr} ${data.month.year}`],
          ['Code:', card.pupil.studentId],
          ['Noms et prénoms / Names:', card.pupil.name],
        ]}
      />
      <table>
        <thead>
          <tr className="bg-school-800 text-[10px] text-white">
            <th className="w-[34%] text-left">COMPETENCES / DISCIPLINES</th>
            <th className="w-[5%]">Max</th>
            <th className="w-[27%] text-left">Critères d&apos;évaluation / Assessment criteria</th>
            <th className="w-[7%]">Note / Mark</th>
            <th className="w-[7%]">%</th>
            <th className="w-[6%]">Cote / Grade</th>
            <th className="w-[14%]">Appreciation / Appréciation</th>
          </tr>
        </thead>
        <tbody>
          {card.competences.map((c) => (
            <CompetenceRows key={c.number} c={c} cotes={cotes} lang={lang} />
          ))}
          <tr className="bg-school-100 font-bold">
            <td colSpan={3}>TOTAL DES POINTS / TOTAL POINTS (/{card.total.max})</td>
            <td className="text-center">{mark(card.total.note, lang)}</td>
            <td className="text-center">{fmtPct(card.total.pct, lang, 1)}</td>
            <td className="text-center">{card.total.cote ?? ''}</td>
            <td className="text-[9px]">{coteMeaning(card.total.cote, cotes)}</td>
          </tr>
          <tr className="font-bold">
            <td colSpan={3}>MOYENNE GENERALE / GENERAL AVERAGE (ACADEMIC)</td>
            <td colSpan={4} className="text-center">{card.average === null ? '–' : `${n2(card.average, lang)} / 20`}</td>
          </tr>
          <tr>
            <td colSpan={3}>MOYENNE GENERALE DE LA CLASSE / CLASS GENERAL AVERAGE (this month)</td>
            <td colSpan={4} className="text-center font-semibold">{data.classAverage === null ? '–' : `${n2(data.classAverage, lang)} / 20`}</td>
          </tr>
        </tbody>
      </table>
      <PerformanceBlock
        meta={meta}
        lang={lang}
        values={card.performance}
        attendance={`P: ${att.P} · A: ${att.A} · L: ${att.L}`}
        title="DAILY PERFORMANCE — MONTHLY AVERAGES / MOYENNES MENSUELLES DE VIE DE CLASSE (/10)"
      />
      <SummaryBoxes
        items={[
          ["PUPIL AVERAGE / MOYENNE DE L'ÉLÈVE (/20)", n2(card.average, lang)],
          ['CLASS AVERAGE / MOYENNE DE LA CLASSE (/20)', n2(data.classAverage, lang)],
          ['DAILY PERFORMANCE AVG / MOYENNE VIE DE CLASSE (/10)', n2(card.performanceAverage, lang)],
          ['ATTENDANCE RATE / TAUX DE PRÉSENCE', fmtPct(att.rate, lang)],
        ]}
      />
      <SummaryBoxes
        items={[
          [`OVERALL SCORE /20 — (${w}% ACADEMIC + ${100 - w}% DAILY PERFORMANCE)`, n2(card.overall, lang)],
          ['MONTHLY CLASS RANK / RANG MENSUEL', card.rank === null ? '–' : `${card.rank} / ${data.ranked}`],
          ['OVERALL COTE / APPRÉCIATION', card.overallCote ? `${card.overallCote} — ${coteMeaning(card.overallCote, cotes)}` : '–'],
        ]}
      />
      <div className="mt-1.5">
        <p className="font-semibold">Appréciations du Conseil de classe / Class council remarks:</p>
        <Remarks pupilId={card.pupil.id} period={`M:${data.month.key}`} initial={card.remarks} />
      </div>
      <Signatures note="NB : ce bulletin porte sur les compétences 1 (sans les langues nationales), 2, 4 et 5 — total /180 ; langues nationales, compétences 3 et 6 → bulletin trimestriel. / This card covers Competences 1 (excluding national languages), 2, 4 & 5 (total /180); national languages, Competences 3 & 6 appear on the term report card." />
    </div>
  );
}

function CompetenceRows({ c, cotes, lang }: { c: MonthlyCard['competences'][number]; cotes: Cote[]; lang: Lang }) {
  return (
    <>
      <tr className="bg-school-50">
        <td colSpan={7} className="text-[10px] font-bold">
          COMPETENCE {c.number} : {c.title_fr} / {c.title_en}
        </td>
      </tr>
      {c.disciplines.map((d) => (
        <tr key={d.code}>
          <td>{d.label}</td>
          <td className="text-center">{d.max}</td>
          <td className="text-[9px] leading-tight">{d.criteria}</td>
          <td className="text-center font-semibold">{mark(d.note, lang)}</td>
          <td className="text-center">{fmtPct(d.pct, lang, 0)}</td>
          <td className="text-center font-semibold">{d.cote ?? ''}</td>
          <td className="text-[9px]">{coteMeaning(d.cote, cotes)}</td>
        </tr>
      ))}
      <tr className="font-semibold">
        <td>
          Total COMPETENCE {c.number} / COMPETENCE {c.number} total /{c.max}
        </td>
        <td className="text-center">{c.max}</td>
        <td />
        <td className="text-center">{mark(c.note, lang)}</td>
        <td className="text-center">{fmtPct(c.pct, lang, 0)}</td>
        <td className="text-center">{c.cote ?? ''}</td>
        <td className="text-[9px]">{coteMeaning(c.cote, cotes)}</td>
      </tr>
    </>
  );
}

function TermCardView({ data, card, meta, lang }: { data: TermCards; card: TermCard; meta: Meta; lang: Lang }) {
  const cotes: Cote[] = meta.settings.cotes;
  const w = Math.round(meta.settings.academicWeight * 100);
  const months = data.term.uaMonths.map((k) => meta.calendar.months.find((m) => m.key === k));
  const att = card.attendance;
  return (
    <div className="report-card mx-auto mb-6 shadow-lg">
      <CardHeader school={data.school} title="TERM REPORT CARD / BULLETIN TRIMESTRIEL" logoVersion={meta.settings.logoVersion} />
      <IdentityRow
        items={[
          ['Classe / Class:', data.class.name],
          ['Term / Trimestre:', data.term.name],
          ['Code:', card.pupil.studentId],
          ['Noms et prénoms / Names:', card.pupil.name],
        ]}
      />
      <table>
        <thead>
          <tr className="bg-school-800 text-[9.5px] text-white">
            <th className="w-[30%] text-left">DISCIPLINES / SUBJECTS</th>
            <th className="w-[22%] text-left">Critères d&apos;évaluation / Assessment criteria</th>
            {months.map((m, i) => (
              <th key={i} colSpan={2} className="w-[9%]">
                Note UA{i + 1} / UA{i + 1} mark
                <div className="text-[8px] font-normal">{monthLabel(m, 'fr', false)} / {monthLabel(m, 'en', false)}</div>
              </th>
            ))}
            <th colSpan={2} className="w-[10%]">
              Note trimestre / Term mark
            </th>
          </tr>
        </thead>
        <tbody>
          {card.competences.map((c) => (
            <TermCompetenceRows key={c.number} c={c} lang={lang} months={months.length} />
          ))}
          <tr className="bg-school-100 font-bold">
            <td colSpan={2}>TOTAL DES POINTS / TOTAL POINTS /{card.totals.max}</td>
            {card.totals.ua.map((t, i) => (
              <td key={i} colSpan={2} className="text-center">
                {mark(t, lang)}
              </td>
            ))}
            <td colSpan={2} className="text-center">
              {fmtNum(card.totals.term, lang, 1)}
            </td>
          </tr>
          <tr className="font-bold">
            <td colSpan={2}>MOYENNE / AVERAGE /20 (ACADÉMIQUE / ACADEMIC)</td>
            {card.averages.ua.map((a, i) => (
              <td key={i} colSpan={2} className="text-center">
                {n2(a, lang)}
              </td>
            ))}
            <td colSpan={2} className="text-center">
              {n2(card.averages.term, lang)} {card.termCote ?? ''}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>MOYENNE GENERALE DE LA CLASSE /20 — Class general average</td>
            {data.classAverageByMonth.map((a, i) => (
              <td key={i} colSpan={2} className="text-center">
                {n2(a, lang)}
              </td>
            ))}
            <td colSpan={2} className="text-center">
              {n2(data.classAverage, lang)}
            </td>
          </tr>
        </tbody>
      </table>
      <SummaryBoxes
        items={[
          ["PUPIL AVERAGE / MOYENNE DE L'ÉLÈVE (/20)", n2(card.averages.term, lang)],
          ['CLASS AVERAGE / MOYENNE DE LA CLASSE (/20)', n2(data.classAverage, lang)],
          ['DAILY PERFORMANCE AVG — TERM (/10)', n2(card.performanceAverage, lang)],
          ['ATTENDANCE RATE / TAUX DE PRÉSENCE', fmtPct(att.rate, lang)],
        ]}
      />
      <SummaryBoxes
        items={[
          [`OVERALL SCORE /20 — (${w}% ACADEMIC + ${100 - w}% DAILY PERFORMANCE)`, n2(card.overall, lang)],
          ['CLASS RANK / RANG (term)', card.rank === null ? '–' : `${card.rank} / ${data.ranked}`],
          ['OVERALL COTE / APPRÉCIATION', card.overallCote ? `${card.overallCote} — ${coteMeaning(card.overallCote, cotes)}` : '–'],
        ]}
      />
      <div className="mt-1 grid grid-cols-2 gap-2">
        <PerformanceList
          meta={meta}
          lang={lang}
          values={card.performance}
          attendance={`P: ${att.P} · A: ${att.A} · L: ${att.L}`}
          title="DAILY PERFORMANCE — TERM AVERAGES / MOYENNES TRIMESTRIELLES DE VIE DE CLASSE (/10)"
        />
          <table>
          <thead>
            <tr className="bg-school-50 text-[9.5px]">
              <th className="text-left">AUTRES ÉVALUATIONS / OTHER ASSESSMENTS</th>
              {months.map((_, i) => (
                <th key={i} className="w-[12%]">
                  UA{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.attitudes.map((a, i) => (
              <tr key={a.code}>
                <td>
                  {i + 1} — {both(a.label_fr, a.label_en)}
                </td>
                {a.ua.map((g, j) => (
                  <td key={j} className="text-center font-semibold">
                    {g ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5">
        <p className="font-semibold">Appréciations du Conseil de classe / Class council remarks:</p>
        <Remarks pupilId={card.pupil.id} period={`T:${data.term.number}`} initial={card.remarks} />
      </div>
      <Signatures />
    </div>
  );
}

function TermCompetenceRows({ c, lang, months }: { c: TermCard['competences'][number]; lang: Lang; months: number }) {
  return (
    <>
      <tr className="bg-school-50">
        <td colSpan={4 + months * 2} className="text-[9.5px] font-bold">
          COMPETENCE {c.number} : {c.title_fr} / {c.title_en}
        </td>
      </tr>
      {c.disciplines.map((d) => (
        <tr key={d.code}>
          <td className="text-[9.5px] leading-tight">{d.label}</td>
          <td className="text-[8.5px] leading-tight">{d.criteria}</td>
          {d.ua.map((u, i) => (
            <UaCells key={i} note={u.note} cote={u.cote} lang={lang} />
          ))}
          <UaCells note={d.term.note} cote={d.term.cote} lang={lang} strong />
        </tr>
      ))}
    </>
  );
}

function UaCells({ note, cote, lang, strong }: { note: number | null; cote: string | null; lang: Lang; strong?: boolean }) {
  return (
    <>
      <td className={cx('text-center', strong && 'font-bold')}>{note === null ? '' : fmtNum(note, lang, Number.isInteger(note) ? 0 : 1)}</td>
      <td className={cx('text-center text-[9px]', strong && 'font-bold')}>{cote ?? ''}</td>
    </>
  );
}

export default function ReportCards() {
  const meta = useMetaData();
  const { sel } = useSelection();
  const { lang, tr } = useLang();
  const [kind, setKind] = useState<'monthly' | 'term'>('monthly');
  const [pupilId, setPupilId] = useState<number | 'all'>('all');

  // A college class is not reported on the primary cards: it has its own bulletin, printed
  // from the subjects, coefficients and séquences of the class.
  const isCollege = meta.classes.find((c) => c.id === sel.classId)?.cycle === 'college';

  useEffect(() => setPupilId('all'), [sel.classId]);

  const monthly = useQuery({
    queryKey: ['cards-monthly', sel.classId, sel.month],
    queryFn: () => api.get<MonthlyCards>(`/cards/monthly?${qs({ classId: sel.classId, month: sel.month })}`),
    enabled: kind === 'monthly' && !isCollege,
  });
  const term = useQuery({
    queryKey: ['cards-term', sel.classId, sel.term],
    queryFn: () => api.get<TermCards>(`/cards/term?${qs({ classId: sel.classId, term: sel.term })}`),
    enabled: kind === 'term' && !isCollege,
  });
  const q = kind === 'monthly' ? monthly : term;
  const pupils = (kind === 'monthly' ? monthly.data?.cards : term.data?.cards)?.map((c) => c.pupil) ?? [];
  const shown = pupilId === 'all' ? pupils.length : 1;

  if (isCollege) return <Bulletins />;

  return (
    <>
      <div className="no-print">
      <PageHeader
        title={tr('Report cards', 'Bulletins')}
        subtitle={tr('Official bilingual format, print-ready on A4 — one card per page.', 'Format officiel bilingue, prêt à imprimer en A4 — un bulletin par page.')}
        actions={
          <>
            <PrintHint />
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!shown}>
              {pupilId === 'all' ? tr(`Print all (${shown})`, `Tout imprimer (${shown})`) : tr('Print', 'Imprimer')}
            </Button>
          </>
        }
      />
      </div>
      <Toolbar>
        <div className="self-center">
          <Tabs
            value={kind}
            onChange={setKind}
            tabs={[
              { value: 'monthly', label: tr('Monthly card', 'Bulletin mensuel') },
              { value: 'term', label: tr('Term card', 'Bulletin trimestriel') },
            ]}
          />
        </div>
        <ClassSelect />
        {kind === 'monthly' ? <MonthSelect /> : <TermSelect />}
        <Field label={tr('Pupil', 'Élève')}>
          <Select value={pupilId} onChange={(e) => setPupilId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="min-w-64">
            <option value="all">{tr(`All pupils (${pupils.length})`, `Tous les élèves (${pupils.length})`)}</option>
            {pupils.map((p) => (
              <option key={p.id} value={p.id}>
                {p.studentId} — {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </Toolbar>
      {q.isPending ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !pupils.length ? (
        <Card>
          <NoPupils />
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          {kind === 'monthly' && monthly.data
            ? monthly.data.cards
                .filter((c) => pupilId === 'all' || c.pupil.id === pupilId)
                .map((c) => <MonthlyCardView key={c.pupil.id} data={monthly.data} card={c} meta={meta} lang={lang} />)
            : term.data?.cards
                .filter((c) => pupilId === 'all' || c.pupil.id === pupilId)
                .map((c) => <TermCardView key={c.pupil.id} data={term.data} card={c} meta={meta} lang={lang} />)}
        </div>
      )}
    </>
  );
}
