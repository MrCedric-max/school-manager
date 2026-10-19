import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bulletin } from '../components/Bulletin';
import { NoPupils } from '../components/Common';
import { PrintHint } from '../components/Layout';
import { TermSelect } from '../components/Selectors';
import { Button, Card, CardHeader, ErrorBox, Field, LoadingBlock, PageHeader, Select, Toolbar, cx } from '../components/ui';
import { api, qs } from '../lib/api';
import { fmtNum } from '../lib/format';
import { useMetaData } from '../lib/hooks';
import { useLang } from '../lib/i18n';
import { useSelection } from '../lib/selection';
import type { CollegeBulletin } from '../lib/types';

/**
 * The bulletin de notes of the college: one page per pupil, in the layout the school
 * prints — subjects in their three groups, the two séquences of the term, ranks, and the
 * pupil's results beside the profile of the class.
 */
export default function Bulletins() {
  const meta = useMetaData();
  const { sel, update } = useSelection();
  const { lang, tr } = useLang();
  const [pupilId, setPupilId] = useState<number | 'all'>('all');

  const collegeClasses = meta.classes.filter((c) => c.cycle === 'college');
  const classId = collegeClasses.some((c) => c.id === sel.classId) ? sel.classId : (collegeClasses[0]?.id ?? sel.classId);

  useEffect(() => setPupilId('all'), [classId]);

  const q = useQuery({
    queryKey: ['college-bulletin', classId, sel.term],
    queryFn: () => api.get<CollegeBulletin>(`/college/bulletin?${qs({ classId, term: sel.term })}`),
    enabled: collegeClasses.length > 0,
  });

  const data = q.data;
  const pupils = data?.pupils ?? [];
  const shown = pupilId === 'all' ? pupils.length : 1;

  if (collegeClasses.length === 0) {
    return (
      <>
        <PageHeader title={tr('Report cards', 'Bulletins')} />
        <Card className="p-5 text-sm text-slate-600">
          {tr(
            'No class is in the college yet, so there is no bulletin to print. Put the classes from 6ème onwards in the college in Settings → Classes.',
            'Aucune classe n’est au collège, il n’y a donc pas de bulletin à imprimer. Placez les classes à partir de la 6ème au collège dans Paramètres → Classes.',
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={tr('Report cards', 'Bulletins')}
          subtitle={tr(
            'The college bulletin: subjects, coefficients, séquences and ranks — one page per pupil, print-ready on A4.',
            'Le bulletin du collège : matières, coefficients, séquences et rangs — une page par élève, prêt à imprimer en A4.',
          )}
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
        <Field label={tr('Class', 'Classe')}>
          <Select value={classId} onChange={(e) => update({ classId: Number(e.target.value) })} className="min-w-40">
            {collegeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.enrolled})
              </option>
            ))}
          </Select>
        </Field>
        <TermSelect />
        <Field label={tr('Pupil', 'Élève')}>
          <Select value={pupilId} onChange={(e) => setPupilId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="min-w-64">
            <option value="all">{tr(`All pupils (${pupils.length})`, `Tous les élèves (${pupils.length})`)}</option>
            {pupils.map((p) => (
              <option key={p.pupilId} value={p.pupilId}>
                {p.classNo} — {p.name}
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
      ) : !data || pupils.length === 0 ? (
        <Card>
          <NoPupils />
          <p className="px-6 pb-6 text-sm text-slate-500">
            {tr(
              'A pupil appears here once a mark has been entered for them in a séquence.',
              'Un élève apparaît ici dès qu’une note a été saisie pour lui dans une séquence.',
            )}
          </p>
        </Card>
      ) : (
        <>
          <Card className="no-print mb-5">
            <CardHeader
              title={tr('Class summary', 'Récapitulatif de la classe')}
              subtitle={`${data.class.name} · ${tr('Term', 'Trimestre')} ${data.term.number}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-3 py-1.5">{tr('Rank', 'Rang')}</th>
                    <th className="px-3 py-1.5">{tr('Name', 'Nom')}</th>
                    <th className="px-3 py-1.5 text-right">{tr('Points', 'Points')}</th>
                    <th className="px-3 py-1.5 text-right">{tr('Average', 'Moyenne')}</th>
                    <th className="px-3 py-1.5">{tr('Mention', 'Mention')}</th>
                    {data.sequences.map((s) => (
                      <th key={s} className="px-3 py-1.5 text-right">
                        Seq. {s}
                      </th>
                    ))}
                    <th className="px-3 py-1.5 text-right">{tr('Conduite', 'Conduite')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pupils]
                    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
                    .map((p) => (
                      <tr key={p.pupilId} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 tabular-nums text-slate-500">{p.rank ?? '–'}</td>
                        <td className="px-3 py-1.5">{p.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(p.points, lang, 2)}</td>
                        <td className={cx('px-3 py-1.5 text-right font-semibold tabular-nums', (p.average ?? 0) < 10 && 'text-red-600')}>
                          {fmtNum(p.average, lang, 2)}
                        </td>
                        <td className="px-3 py-1.5 italic">{p.mention?.[lang === 'fr' ? 'fr' : 'en'] ?? '–'}</td>
                        {data.sequences.map((s) => (
                          <td key={s} className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                            {fmtNum(p.sequenceAverages[s], lang, 2)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{p.conduct === null ? '–' : fmtNum(p.conduct, lang, 2)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 text-xs font-semibold">
                    <td className="px-3 py-1.5" colSpan={3}>
                      {tr('Class average', 'Moyenne de la classe')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(data.classProfile.average, lang, 2)}</td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {tr('Best', 'Premier')} {fmtNum(data.classProfile.best, lang, 2)} · {tr('Last', 'Dernier')}{' '}
                      {fmtNum(data.classProfile.worst, lang, 2)}
                    </td>
                    <td className="px-3 py-1.5" colSpan={data.sequences.length + 1}>
                      {tr('Passing', 'Admis')} {data.classProfile.passing}/{data.classProfile.count}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="overflow-x-auto pb-4">
            {pupils
              .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
              .filter((p) => pupilId === 'all' || p.pupilId === pupilId)
              .map((p) => (
                <div key={p.pupilId} className="report-card mx-auto mb-6 shadow-lg">
                  <Bulletin bulletin={data} pupil={p} logoVersion={meta.settings.logoVersion} />
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );
}
