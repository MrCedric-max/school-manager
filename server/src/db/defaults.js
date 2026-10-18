// Default reference data, copied from the School_Manager workbook
// (sheets "Lists", "Calendar" and the official report-card layouts) for 2026/2027.

export const DEFAULT_SETTINGS = {
  school_name: 'ÉCOLE AZOBE',
  school_subtitle: 'AZOBE BILINGUAL SCHOOL',
  academic_year: '2026-2027',
  year_start: '2026-09-01',
  year_end: '2027-07-31',
  week1_start: '2026-09-07',
  timezone: 'Africa/Douala',
  /** Overall score = 70% academic average + 30% daily-performance average (rescaled /20). */
  academic_weight: '0.7',
  /** Marking scale: A+ ≥ 90% · A ≥ 75% · ECA/B ≥ 50% · NA < 50% */
  cotes: JSON.stringify([
    { code: 'A+', min: 0.9, en: 'Excellent mastery', fr: 'Maîtrise excellente' },
    { code: 'A', min: 0.75, en: 'Acquired', fr: 'Acquis' },
    { code: 'ECA/B', min: 0.5, en: 'Being acquired', fr: "En cours d'acquisition" },
    { code: 'NA', min: 0, en: 'Not acquired', fr: 'Non acquis' },
  ]),
  demo_mode: '0',
  logo: '',
};

export const DEFAULT_CLASSES = [
  ['SIL', 'SIL'],
  ['CP', 'CP'],
  ['CE1', 'CE1'],
  ['CE2', 'CE2'],
  ['CM1', 'CM1'],
  ['CM2', 'CM2'],
  ['6ème', '6EME'],
  ['5ème', '5EME'],
  ['4ème', '4EME'],
  ['3ème', '3EME'],
  ['2nde', '2ND'],
];

export const DEFAULT_TERMS = [
  { number: 1, name: 'Term 1', start_date: '2026-09-07', end_date: '2026-12-11', ua_months: ['2026-10', '2026-11', '2026-12'] },
  { number: 2, name: 'Term 2', start_date: '2027-01-04', end_date: '2027-03-19', ua_months: ['2027-01', '2027-02', '2027-03'] },
  { number: 3, name: 'Term 3', start_date: '2027-04-05', end_date: '2027-06-25', ua_months: ['2027-04', '2027-05', '2027-06'] },
];

export const DEFAULT_HOLIDAYS = [
  ['2026-12-25', 'Christmas Day / Noël'],
  ['2027-01-01', "New Year's Day / Nouvel An"],
  ['2027-02-11', 'Youth Day / Fête de la Jeunesse'],
  ['2027-03-10', 'Eid al-Fitr / Fête du Ramadan (est.)'],
  ['2027-03-26', 'Good Friday / Vendredi Saint'],
  ['2027-03-29', 'Easter Monday / Lundi de Pâques'],
  ['2027-05-01', 'Labour Day / Fête du Travail'],
  ['2027-05-06', 'Ascension Day / Ascension'],
  ['2027-05-17', 'Eid al-Adha / Fête de la Tabaski (est.)'],
  ['2027-05-20', 'National Day / Fête Nationale'],
];

export const DEFAULT_COMPETENCES = [
  {
    number: 1,
    title_fr: 'Communiquer en français et en anglais et pratiquer au moins une langue nationale',
    title_en: 'Communicate in French and in English and practise at least one national language',
    short_fr: 'Langues',
    short_en: 'Languages',
  },
  {
    number: 2,
    title_fr: 'Utiliser les notions de base en mathématiques, Sciences et Technologies',
    title_en: 'Use basic notions in mathematics, Science and Technology',
    short_fr: 'Maths & Sciences',
    short_en: 'Maths & Sciences',
  },
  {
    number: 3,
    title_fr: 'Pratiquer les valeurs sociales et citoyennes',
    title_en: 'Practise social and citizenship values',
    short_fr: 'Valeurs',
    short_en: 'Values',
  },
  {
    number: 4,
    title_fr: "Démontrer l'autonomie, l'esprit d'initiative, de créativité et d'entrepreneuriat",
    title_en: 'Demonstrate the spirit of autonomy, initiative, creativity and entrepreneurship',
    short_fr: 'Autonomie',
    short_en: 'Autonomy',
  },
  {
    number: 5,
    title_fr: 'Utiliser les concepts de base et les outils des TIC',
    title_en: 'Use basic concepts and tools of ICT',
    short_fr: 'TIC',
    short_en: 'ICT',
  },
  {
    number: 6,
    title_fr: 'Pratiquer les activités physiques, sportives et artistiques',
    title_en: 'Practise physical, sports and artistic activities',
    short_fr: 'Sport & Arts',
    short_en: 'Sport & Arts',
  },
];

// code, competence, label (as printed on the report card), short FR, short EN, max, criteria, on monthly card
export const DEFAULT_DISCIPLINES = [
  ['1A', 1, 'Communiquer en Français (40 points)', 'Français', 'French', 40,
    '1: Orale 10 pts ; 2: Écrite 15 pts (15 pts pour le savoir-être)', 1],
  ['1B', 1, 'Communicate in English (40 marks)', 'Anglais', 'English', 40,
    '1: Oral 20 marks ; 2: Written 15 marks (5 marks for attitudes)', 1],
  ['1C', 1, 'Pratiquer une langue nationale / Use a national language (20 points)', 'Langue nationale', 'Nat. language', 20,
    '1: Orale 10 pts ; 2: Écrite 7 pts ; 3: Pratique 3 pts', 0],
  ['2A', 2, 'Utiliser les notions de base en mathématiques / Use basic notions in mathematics (30 points)', 'Mathématiques', 'Mathematics', 30,
    '1: Orale 5 pts ; 2: Écrite 20 pts (5 pts pour le savoir-être)', 1],
  ['2B', 2, 'Utiliser les notions de base en Sciences et Technologies / Use basic notions in science and technology (30 points)', 'Sciences & Tech.', 'Sci & Tech', 30,
    '1: Orale 5 pts ; 2: Écrite 5 pts ; 3: Pratique 15 pts (5 pts pour le savoir-être)', 1],
  ['3A', 3, 'Pratiquer les valeurs sociales / Practice of social values (20 points)', 'Valeurs sociales', 'Social values', 20,
    '1: Orale 3 pts ; 2: Écrite 3 pts ; 3: Pratique 10 pts (4 pts pour le savoir-être)', 0],
  ['3B', 3, 'Pratiquer les valeurs citoyennes / Practice of citizenship values (20 points)', 'Valeurs citoyennes', 'Citizenship', 20,
    '1: Orale 5 pts ; 2: Écrite 5 pts ; 3: Pratique 8 pts (2 pts pour le savoir-être)', 0],
  ['4A', 4, "Démontrer l'autonomie, l'esprit d'initiative, de créativité et d'entrepreneuriat / Demonstrate autonomy, initiative, creativity and entrepreneurship (20 points)", 'Autonomie & initiative', 'Autonomy & entr.', 20,
    '1: Orale 5 pts ; 2: Écrite 3 pts ; 3: Pratique 10 pts (2 pts pour le savoir-être)', 1],
  ['5A', 5, 'Utiliser les concepts de base et les outils des TIC / Using basic concepts and tools of ICT (20 points)', 'TIC', 'ICT', 20,
    '1: Orale 3 pts ; 2: Écrite 3 pts ; 3: Pratique 10 pts (4 pts pour le savoir-être)', 1],
  ['6A1', 6, 'Pratiquer les activités physiques et sportives / Practise physical sports (20 points)', 'Sport', 'Phys. & sport', 20,
    '1: Orale 3 pts ; 2: Écrite 3 pts ; 3: Pratique 10 pts (4 pts pour le savoir-être)', 0],
  ['6B', 6, 'Pratiquer les activités artistiques / Practise artistic activities (20 points)', 'Arts', 'Arts', 20,
    '1: Orale 4 pts ; 2: Écrite 3 pts ; 3: Pratique 10 pts (3 pts pour le savoir-être)', 0],
];

// Term_Card_Entry "ATTITUDES & SCHOOL LIFE (A+ to C)" — printed as "AUTRES ÉVALUATIONS" on the term card
export const DEFAULT_ATTITUDES = [
  ['religion', 'Religion', 'Religion'],
  ['spanish', 'Espagnol', 'Spanish'],
  ['virtue', 'Vertu du mois', 'Virtue of the month'],
  ['punctuality', 'Ponctualité', 'Punctuality'],
  ['homework', 'Devoirs à la maison', 'Homework'],
  ['participation', 'Participation aux leçons', 'Class participation'],
  ['teamwork', "Esprit d'équipe", 'Team spirit'],
  ['instructions', 'Respect des consignes', 'Respect of instructions'],
];

export const ATTITUDE_GRADES = ['A+', 'A', 'B', 'C'];

// Weekly_Controls subjects (/20): code, label FR, label EN, short FR, short EN, competence
// (the competence a control of this subject counts towards in the monthly success rates)
export const DEFAULT_CONTROL_SUBJECTS = [
  ['english', 'Anglais', 'English Language', 'Ang.', 'Eng.', 1],
  ['maths', 'Mathématiques', 'Mathematics', 'Maths', 'Maths', 2],
  ['french', 'Français', 'French Language', 'Fran.', 'Fren.', 1],
  ['scitech', 'Sciences & Technologies', 'Science & Technology', 'Sci&T', 'Sci&T', 2],
];

// Daily_Performance areas (/10): code, label FR, label EN
export const DEFAULT_PERFORMANCE_AREAS = [
  ['assignments', 'Devoirs', 'Assignments'],
  ['participation', 'Participation en classe', 'Class participation'],
  ['order', 'Ordre', 'Order'],
  ['discipline', 'Discipline', 'Discipline'],
  ['cleanliness', 'Propreté', 'Cleanliness'],
  ['respect', 'Respect', 'Respect'],
  ['obedience', 'Obéissance', 'Obedience'],
];

export const PUPIL_STATUSES = ['Active', 'Transferred', 'Suspended', 'Expelled', 'Graduated'];
export const ROLL_MARKS = ['P', 'A', 'L', 'E'];
