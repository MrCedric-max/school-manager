import { useEffect, useState } from 'react';
import { SchoolLogo } from './SchoolLogo';
import { useLang } from '../lib/i18n';
import { both, fmtDate, fmtNum } from '../lib/format';
import { api } from '../lib/api';
import type { CollegeBulletin, BulletinPupil, Lang } from '../lib/types';
import { Input } from './ui';

const n2 = (v: number | null | undefined, lang: Lang) => (v === null || v === undefined ? '' : fmtNum(v, lang, 2));

/**
 * The bulletin de notes of the college: the layout the school prints, with the ministry on
 * the left in French and on the right in English, the subjects in their three groups, and
 * the pupil's results beside the profile of the class.
 */
export function Bulletin({
  bulletin,
  pupil,
  logoVersion,
  printAll,
}: {
  bulletin: CollegeBulletin;
  pupil: BulletinPupil;
  logoVersion: string;
  printAll?: boolean;
}) {
  const { lang } = useLang();
  const { sequences, subjects, groups } = bulletin;
  const groupOf = (no: number) => groups.find((g) => g.groupNo === no) ?? null;
  const rowOf = (code: string) => pupil.subjects.find((s) => s.code === code) ?? null;

  return (
    <div className={printAll ? 'bulletin-page' : ''}>
      <Letterhead
        schoolName={bulletin.school.name}
        subtitle={bulletin.school.subtitle}
        academicYear={bulletin.school.academicYear}
        term={bulletin.term.number}
        logoVersion={logoVersion}
      />

      <div className="mb-1.5 grid grid-cols-2 gap-x-5 gap-y-0.5 rounded border border-slate-400 px-2 py-1 text-[11px]">
        <Field label="Nom(S) et Prénom(S) / Name" value={pupil.name} />
        <Field label="Année scolaire / School year" value={bulletin.school.academicYear} />
        <Field label="Date et lieu de naissance / Date and place of birth" value={birth(pupil, lang)} />
        <Field label="Classe / Class" value={bulletin.class.name} />
        <Field label="Adresse des parents ou tuteur / Address" value={pupil.address || ''} />
        <Field label="Trimestre / Term" value={String(bulletin.term.number)} />
        <Field label="Numéro de classe / Class number" value={String(pupil.classNo)} />
        <Field label="Effectif / Enrolment" value={String(bulletin.classProfile.count)} />
      </div>

      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-school-50 text-school-900">
            <Th className="text-left">Disciplines / Subjects</Th>
            <Th>Coef.</Th>
            {sequences.map((s) => (
              <Th key={s}>Seq. {s}</Th>
            ))}
            <Th>Trim. / Term {bulletin.term.number}</Th>
            <Th>Rang / Rank</Th>
            <Th className="text-left">Appréciation / Remark</Th>
            <Th>Moy. Gén. / Average</Th>
            <Th className="text-left">Enseignants / Teachers</Th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((no) => {
            const members = subjects.filter((s) => s.groupNo === no);
            if (!members.length) return null;
            const groupRow = pupil.groups.find((g) => g.groupNo === no) ?? null;
            const group = groupOf(no);
            return [
              ...members.map((s) => {
                const row = rowOf(s.code);
                return (
                  <tr key={s.code} className="border-b border-slate-200">
                    <Td className="text-left">{both(s.label, s.labelEn)}</Td>
                    <Td>{s.coefficient}</Td>
                    {sequences.map((n) => (
                      <Td key={n}>{n2(row?.seq[n], lang)}</Td>
                    ))}
                    <Td className="font-semibold">{n2(row?.trim, lang)}</Td>
                    <Td>{row?.rank ?? ''}</Td>
                    <Td className="text-left italic">{row?.trim === null || row?.trim === undefined ? '' : mention(row.trim, lang)}</Td>
                    <Td>{n2(s.classAverage, lang)}</Td>
                    <Td className="text-left text-[9.5px]">{s.teacher}</Td>
                  </tr>
                );
              }),
              <tr key={`g${no}`} className="border-b-2 border-school-300 bg-school-50/70 font-bold">
                <Td className="text-left">{group ? both(group.label, group.labelEn) : `Moy. ${no}e Groupe / Group ${no} average`}</Td>
                <Td>{groupRow?.coefficient ?? group?.coefficient ?? ''}</Td>
                {sequences.map((n) => (
                  <Td key={n}>{n2(groupRow?.seq?.[n], lang)}</Td>
                ))}
                <Td>{n2(groupRow?.trim, lang)}</Td>
                <Td>{groupRow?.rank ?? ''}</Td>
                <Td className="text-left italic">{groupRow?.trim ? mention(groupRow.trim, lang) : ''}</Td>
                <Td>{n2(group?.classAverage, lang)}</Td>
                <Td>{''}</Td>
              </tr>,
            ];
          })}
        </tbody>
      </table>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10.5px]">
        <Block title="Résultats de l'élève / Pupil's results">
          <Line label="Points" value={n2(pupil.points, lang)} />
          <Line label="Coef" value={String(pupil.coefficient)} />
          <Line label="Moy. Académique / Academic average /20" value={n2(pupil.average, lang)} strong />
          <Line label="Note de Conduite / Conduct /20" value={<Conduct pupilId={pupil.pupilId} period={`T:${bulletin.term.number}`} value={pupil.conduct} />} />
          <Line label="Appréciation / Mention" value={pupil.average === null ? '' : mention(pupil.average, lang)} />
          <Line label="Rang / Rank" value={`${pupil.rank ?? '–'} / ${bulletin.classProfile.count}`} />
        </Block>
        <Block title="Profil de la classe / Class profile">
          <Line label="Moy. Gén. / Average" value={n2(bulletin.classProfile.average, lang)} />
          <Line label="Moy. Premier / Best" value={n2(bulletin.classProfile.best, lang)} />
          <Line label="Moy. Dernier / Last" value={n2(bulletin.classProfile.worst, lang)} />
          <Line label="Admis / Passing" value={`${bulletin.classProfile.passing} / ${bulletin.classProfile.count}`} />
        </Block>
        <Block title="Rappel / Reminder">
          {sequences.map((n) => (
            <Line key={n} label={`Moy. Seq. ${n} / Seq. ${n} average`} value={n2(pupil.sequenceAverages[n], lang)} />
          ))}
          <Line label="Absence Just. / Excused" value={String(pupil.attendance.justified)} />
          <Line label="Absence N. Just. / Unexcused" value={String(pupil.attendance.unjustified)} />
          <Line label="Retards / Late" value={String(pupil.attendance.late)} />
        </Block>
      </div>

      {pupil.remark && (
        <p className="mt-2 rounded border border-slate-300 px-2 py-1 text-[10.5px]">
          <span className="text-slate-500">Appréciation du conseil de classe / Class council: </span>
          {pupil.remark}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-4 text-center text-[10px]">
        {[
          ['Visa du parent / Tuteur', "Parent's or guardian's signature"],
          ['Visa du Titulaire', 'Form teacher'],
          ['Visa du Directeur', 'Head teacher'],
        ].map(([fr, en]) => (
          <div key={fr}>
            <p className="font-semibold">{fr}</p>
            <p className="text-slate-400">{en}</p>
            <div className="mt-6 border-t border-dashed border-slate-400 pt-0.5">&nbsp;</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-right text-[10px] text-slate-500">Fait à / Done at ____________ le / on {fmtDate(bulletin.term.end, lang)}</p>
    </div>
  );
}

/** The bilingual letterhead of the secondary system: ministry, then the college. */
function Letterhead({
  schoolName,
  subtitle,
  academicYear,
  term,
  logoVersion,
}: {
  schoolName: string;
  subtitle: string;
  academicYear: string;
  term: number;
  logoVersion: string;
}) {
  return (
    <div className="mb-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div className="text-center text-[9.5px] font-semibold leading-tight">
          <p className="text-[11px] font-extrabold">REPUBLIQUE DU CAMEROUN</p>
          <p className="italic">Paix – Travail – Patrie</p>
          <p className="my-0.5 text-[8px]">*****</p>
          <p className="text-[10px] font-bold uppercase">Ministère de l'Enseignement Secondaire</p>
          <p className="text-[9px]">{schoolName.startsWith('Collège') ? schoolName : `Collège ${schoolName}`}</p>
          {subtitle ? <p className="text-[8.5px] italic">{subtitle}</p> : null}
        </div>
        <SchoolLogo version={logoVersion} fallback={schoolName} className="h-16 w-16 object-contain" />
        <div className="text-center text-[9.5px] font-semibold leading-tight">
          <p className="text-[11px] font-extrabold">REPUBLIC OF CAMEROON</p>
          <p className="italic">Peace – Work – Fatherland</p>
          <p className="my-0.5 text-[8px]">*****</p>
          <p className="text-[10px] font-bold uppercase">Ministry of Secondary Education</p>
          <p className="text-[9px]">{schoolName.startsWith('Collège') ? schoolName : `Collège ${schoolName}`.replace('Collège', 'College')}</p>
          {subtitle ? <p className="text-[8.5px] italic">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-1 border-b-2 border-school-800 pb-0.5 text-center">
        <p className="text-[13px] font-extrabold uppercase tracking-wide">Bulletin de notes / Report card</p>
        <p className="text-[11px] font-bold">
          Trimestre {term} · Année scolaire / School year {academicYear}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="truncate">
      <span className="text-slate-500">{label}: </span>
      <strong>{value || '—'}</strong>
    </p>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`border border-slate-400 px-1 py-0.5 text-[9.5px] font-bold ${className ?? ''}`}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-slate-300 px-1 py-[1px] text-center tabular-nums ${className ?? ''}`}>{children}</td>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-400">
      <p className="border-b border-slate-300 bg-school-50 px-1.5 py-0.5 text-[9.5px] font-bold text-school-900">{title}</p>
      <div className="space-y-0.5 px-1.5 py-1">{children}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold' : ''}`}>{value === '' || value === null ? '—' : value}</span>
    </p>
  );
}

function birth(pupil: BulletinPupil, lang: Lang) {
  const when = pupil.dateOfBirth ? fmtDate(pupil.dateOfBirth, lang) : '';
  return [when, pupil.placeOfBirth].filter(Boolean).join(' à / at ');
}

/** The mention printed for a mark, in both languages: Assez Bien / Fairly good… */
export function mention(average: number, _lang: Lang) {
  if (average >= 16) return 'Très Bien / Very good';
  if (average >= 14) return 'Bien / Good';
  if (average >= 12) return 'Assez Bien / Fairly good';
  if (average >= 10) return 'Passable / Pass';
  return 'Insuffisant / Insufficient';
}

/** Conduite /20: typed once a term and printed under the pupil's results. */
function Conduct({ pupilId, period, value }: { pupilId: number; period: string; value: number | null }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  return (
    <Input
      value={text}
      type="number"
      step="0.5"
      min={0}
      max={20}
      placeholder="20"
      className="no-print h-5 w-14 px-1 text-right text-[10.5px]"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim() === '' ? null : Number(text);
        if (next === value) return;
        void api.put('/college/conduct', { pupilId, period, value: next });
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
