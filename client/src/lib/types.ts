export type Lang = 'en' | 'fr';
export type DayType = 'school' | 'weekend' | 'holiday' | 'break' | 'outside';
export type RollMark = 'P' | 'A' | 'L' | 'E';

export interface Cote {
  code: string;
  min: number;
  en: string;
  fr: string;
}

export interface Settings {
  schoolName: string;
  schoolSubtitle: string;
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  week1Start: string;
  timezone: string;
  academicWeight: number;
  cotes: Cote[];
  demoMode: boolean;
  hasLogo: boolean;
  logoVersion: string;
}

export interface ClassInfo {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  enrolled: number;
  registered: number;
}

export interface Competence {
  number: number;
  title_fr: string;
  title_en: string;
  short_fr: string;
  short_en: string;
  max: number;
  monthlyMax: number;
}

export interface Discipline {
  code: string;
  competence: number;
  label: string;
  short_fr: string;
  short_en: string;
  max: number;
  criteria: string;
  on_monthly_card: boolean;
}

export interface Attitude {
  code: string;
  label_fr: string;
  label_en: string;
}

export interface Subject {
  code: string;
  label_fr: string;
  label_en: string;
  short_fr: string;
  short_en: string;
  max: number;
}

export interface Area {
  code: string;
  label_fr: string;
  label_en: string;
  max: number;
}

export interface Framework {
  competences: Competence[];
  disciplines: Discipline[];
  monthlyDisciplines: Discipline[];
  attitudes: Attitude[];
  subjects: Subject[];
  areas: Area[];
  totalMax: number;
  monthlyMax: number;
}

export interface MonthInfo {
  key: string;
  number: number;
  year: number;
  name_en: string;
  name_fr: string;
  firstDay: string;
  lastDay: string;
  weekFrom: number;
  weekTo: number;
  uaTerm: number | null;
  uaIndex: number | null;
  schoolDays: number;
}

export interface WeekInfo {
  number: number;
  monday: string;
  friday: string;
  term: number | null;
  schoolDays: number;
}

export interface TermInfo {
  number: number;
  name: string;
  start: string;
  end: string;
  uaMonths: string[];
  weekFrom: number;
  weekTo: number;
  schoolDays: number;
}

export interface CalendarSummary {
  firstSchoolDay: string | null;
  lastSchoolDay: string | null;
  schoolDays: number;
  publicHolidays: number;
  breakWeekdays: number;
}

export interface TodayInfo {
  date: string;
  week: number | null;
  term: number | null;
  type: DayType;
  holiday: string | null;
  month: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface Meta {
  settings: Settings;
  classes: ClassInfo[];
  framework: Framework;
  calendar: {
    months: MonthInfo[];
    weeks: WeekInfo[];
    terms: TermInfo[];
    summary: CalendarSummary;
    schoolDays: string[];
  };
  holidays: Holiday[];
  today: TodayInfo;
  selections: { week: number; month: string; term: number; uaMonth: string; date: string };
  statuses: string[];
  rollMarks: RollMark[];
  attitudeGrades: string[];
}

export interface PupilRow {
  id: number;
  studentId: string;
  name: string;
  status: string;
  classNo: number;
}

export interface Pupil {
  id: number;
  student_id: string;
  class_id: number;
  class_name: string;
  class_code: string;
  class_no: number;
  full_name: string;
  gender: 'M' | 'F' | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  guardian: string | null;
  phone: string | null;
  address: string | null;
  status: string;
}

export interface AttendanceSummary {
  P: number;
  A: number;
  L: number;
  E: number;
  marked: number;
  rate: number | null;
}

export interface Stats {
  avg: number | null;
  max: number | null;
  min: number | null;
  count: number;
}

export type Values = Record<string, Record<string, number>>;

export interface WeeklyReport {
  class: ClassInfo;
  week: WeekInfo & { dates: string[] };
  rows: Array<{
    n: number;
    pupilId: number;
    studentId: string;
    name: string;
    status: string;
    controls: Record<string, number | null>;
    controlsAverage: number | null;
    controlsCote: string | null;
    performance: Record<string, number | null>;
    performanceAverage: number | null;
    attendance: AttendanceSummary;
    rank: number | null;
  }>;
  footer: {
    controls: Record<string, Stats>;
    controlsAverage: Stats;
    performance: Record<string, Stats>;
    performanceAverage: Stats;
    attendanceRate: Stats;
  };
  counts: { schoolDays: number; controlsLogged: number; performanceEntries: number; rollMarks: number; ranked: number };
}

interface PeriodRowBase {
  n: number;
  pupilId: number;
  studentId: string;
  name: string;
  status: string;
  competences: Record<string, number | null>;
  total: number | null;
  average: number | null;
  cote: string | null;
  controls: Record<string, number | null>;
  performance: Record<string, number | null>;
  performanceAverage: number | null;
  attendance: AttendanceSummary;
  overall: number | null;
  overallCote: string | null;
  rank: number | null;
}

interface PeriodFooter {
  competences: Record<string, Stats>;
  total: Stats;
  average: Stats;
  controls: Record<string, Stats>;
  performanceAverage: Stats;
  attendance: { P: Stats; A: Stats; L: Stats; rate: Stats };
  overall: Stats;
}

export interface MonthlyReport {
  class: ClassInfo;
  month: MonthInfo & { dates: string[]; weeks: number[] };
  rows: Array<PeriodRowBase & { notes: Record<string, number | null>; entered: number; complete: boolean }>;
  footer: PeriodFooter;
  counts: {
    schoolDays: number;
    studentsEvaluated: number;
    controlsLogged: number;
    performanceEntries: number;
    classAverage: number | null;
    ranked: number;
  };
}

export interface TermReport {
  class: ClassInfo;
  term: TermInfo & { dates: string[]; weeks: number[] };
  rows: Array<PeriodRowBase & { monthsEvaluated: number }>;
  footer: PeriodFooter;
  counts: {
    schoolDays: number;
    studentsEvaluated: number;
    controlsLogged: number;
    performanceEntries: number;
    classAverage: number | null;
    classAverageByMonth: Array<number | null>;
    ranked: number;
  };
}

export interface NoteCote {
  note: number | null;
  pct: number | null;
  cote: string | null;
}

export interface SchoolHeader {
  name: string;
  subtitle: string;
  academicYear: string;
  logo: string;
}

export interface MonthlyCard {
  pupil: { id: number; studentId: string; name: string };
  competences: Array<
    NoteCote & {
      number: number;
      title_fr: string;
      title_en: string;
      max: number;
      disciplines: Array<NoteCote & { code: string; label: string; max: number; criteria: string }>;
    }
  >;
  total: NoteCote & { max: number };
  average: number | null;
  complete: boolean;
  performance: Record<string, number | null>;
  performanceAverage: number | null;
  attendance: AttendanceSummary;
  overall: number | null;
  overallCote: string | null;
  rank: number | null;
  remarks: string;
}

export interface MonthlyCards {
  school: SchoolHeader;
  class: ClassInfo;
  month: MonthInfo;
  classAverage: number | null;
  ranked: number;
  pupilsInClass: number;
  cards: MonthlyCard[];
}

export interface TermCard {
  pupil: { id: number; studentId: string; name: string };
  competences: Array<{
    number: number;
    title_fr: string;
    title_en: string;
    max: number;
    disciplines: Array<{ code: string; label: string; max: number; criteria: string; ua: NoteCote[]; term: NoteCote }>;
  }>;
  totals: { ua: Array<number | null>; term: number | null; max: number };
  averages: { ua: Array<number | null>; term: number | null };
  termCote: string | null;
  performance: Record<string, number | null>;
  performanceAverage: number | null;
  attendance: AttendanceSummary;
  overall: number | null;
  overallCote: string | null;
  rank: number | null;
  attitudes: Array<{ code: string; label_fr: string; label_en: string; ua: Array<string | null> }>;
  remarks: string;
}

export interface TermCards {
  school: SchoolHeader;
  class: ClassInfo;
  term: TermInfo;
  classAverage: number | null;
  classAverageByMonth: Array<number | null>;
  ranked: number;
  pupilsInClass: number;
  cards: TermCard[];
}

export interface Dashboard {
  today: TodayInfo;
  totals: {
    enrolled: number;
    registered: number;
    classes: number;
    generalAverage: number | null;
    attendanceRate: number | null;
    schoolDays: number;
    schoolDaysElapsed: number;
    monthlyEvaluations: number;
  };
  perClass: Array<{
    id: number;
    name: string;
    code: string;
    enrolled: number;
    evaluationAverage: number | null;
    controlsAverage: number | null;
    attendanceRate: number | null;
    studentsEvaluated: number;
    rollToday: number;
  }>;
  subjectAverages: Array<{ code: string; label_en: string; label_fr: string; average: number | null }>;
  areaAverages: Array<{ code: string; label_en: string; label_fr: string; average: number | null }>;
  coteDistribution: Array<{ code: string; en: string; fr: string; count: number }>;
  rollMarks: Record<RollMark, number>;
}

export interface Statistics {
  class: ClassInfo;
  week: WeekInfo;
  month: MonthInfo;
  performanceByArea: Array<{ code: string; label_en: string; label_fr: string; average: number | null }>;
  controlsBySubject: Array<{ code: string; label_en: string; label_fr: string; average: number | null }>;
  disciplines: Array<{ code: string; short_en: string; short_fr: string; max: number; average: number | null; pct: number | null }>;
  competences: Array<{ number: number; short_en: string; short_fr: string; max: number; average: number | null; pct: number | null }>;
  attendance: {
    counts: Record<RollMark, number>;
    rate: number | null;
    trend: Array<{ key: string; name_en: string; name_fr: string; rate: number | null }>;
  };
}

export interface CalendarDay {
  date: string;
  dow: number;
  week: number | null;
  month: string;
  term: number | null;
  type: DayType;
  holiday: string | null;
}

export interface CalendarData {
  year: { yearStart: string; yearEnd: string; week1Start: string };
  days: CalendarDay[];
  months: MonthInfo[];
  weeks: WeekInfo[];
  terms: TermInfo[];
  summary: CalendarSummary;
  holidays: Holiday[];
  today: TodayInfo;
}

export interface ImportSummary {
  sheets: string[];
  school: { name: string | null; subtitle: string | null; academicYear: string | null };
  calendar: null | {
    yearStart: string;
    yearEnd: string;
    week1Start: string;
    terms: Array<{ number: number; name: string; start: string; end: string; uaMonths: string[] }>;
    holidays: number;
  };
  classes: Array<{ name: string; code: string; pupils: number }>;
  counts: { pupils: number; attendance: number; controls: number; performance: number; marks: number; attitudes: number };
  warnings: string[];
  warningCount: number;
}
