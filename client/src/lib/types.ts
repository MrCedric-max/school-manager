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
  /** Which cycle the class is evaluated in: `primary` (disciplines) or `college` (subjects). */
  cycle: Cycle;
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

/**
 * One line of a success-rate chart: how many pupils reached the pass mark out of those judged.
 * `evaluated` only counts pupils whose every subject for the line was entered.
 */
export interface SuccessRow {
  key: string;
  /** Competence number (competence lines) or discipline code (subject lines). */
  number?: number;
  code?: string;
  short_en: string;
  short_fr: string;
  label_en?: string;
  label_fr?: string;
  title_en?: string;
  title_fr?: string;
  /** Points a pupil could score for this line — 0 when the monthly card has no subject for it. */
  max: number;
  evaluated: number;
  skipped: number;
  passed: number;
  /** Share of the pupils judged who reached the pass mark (0–1), null when nobody could be judged. */
  rate: number | null;
  averagePct: number | null;
  /** How many of the pupils judged had weekly controls folded in (competences with controls). */
  controlsIncluded?: number;
}

export interface SuccessScope {
  competences: SuccessRow[];
  competencesWithControls: SuccessRow[];
  subjects: SuccessRow[];
}

export interface MonthlySuccess {
  month: MonthInfo;
  passMark: number;
  passCote: string | null;
  controlWeight: number;
  /** Competences that have no subject on the monthly card, so they can never have a rate. */
  notEvaluated: number[];
  class: SuccessScope;
  school: SuccessScope;
}

export interface Statistics {
  class: ClassInfo;
  week: WeekInfo;
  month: MonthInfo;
  success: MonthlySuccess;
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
  /** The holiday period this day falls in, when it is one (Christmas, Easter…). */
  breakName?: string | null;
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

// ---- The national calendar and the reminders ---------------------------------

export type EventCategory = 'official' | 'break' | 'holiday' | 'exam' | 'deadline' | 'event';
export type EventSource = 'national' | 'import' | 'manual';

/** A date of the school year: an official one, or one of the school's own. */
/** Which part of the school an event concerns: '' is the whole school. */
export type EventCycle = '' | 'primary' | 'college';

export interface CalendarEvent {
  id: number;
  date: string;
  endDate: string | null;
  title: string;
  category: EventCategory;
  /** primary and college do not sit the same exams on the same days (MINEDUB vs MINESEC). */
  cycle: EventCycle;
  source: EventSource;
  schoolYearId: number | null;
  remind: boolean;
}

/** One part of a term, on either side of a holiday. */
export interface TermSegment {
  start: string;
  end: string;
}

/**
 * The official dates of a school year, as published by MINEDUB/MINESEC: the backbone the
 * app synchronises to.
 */
export interface Backbone {
  reference: string;
  yearStart: string;
  yearEnd: string;
  week1Start: string;
  anchors: Partial<Record<'adminReturn' | 'teacherReturn' | 'pupilReturn' | 'classesEnd' | 'yearEnd', string>>;
  terms: Array<{ number: number; name: string; segments: TermSegment[] }>;
  breaks: Array<{ name: string; start: string; end: string }>;
  exams: Array<{ name: string; start: string; end: string }>;
  holidays: Array<{ date: string; name: string; movable?: boolean }>;
}

export interface SchoolYear {
  id: number;
  label: string;
  status: 'active' | 'draft' | 'archived';
  startDate: string;
  endDate: string;
  week1Start: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  backbone: Backbone;
  plan: {
    terms: Array<{ number: number; name: string; start: string; end: string; segments: TermSegment[]; uaMonths: string[]; schoolDays: number }>;
    holidays: Array<{ date: string; name: string }>;
    events: Array<{ date: string; end_date: string | null; title: string; category: EventCategory }>;
  };
}

export interface SchoolYearsData {
  years: SchoolYear[];
  activeId: number | null;
  hasOfficial: boolean;
  events: CalendarEvent[];
  eventSources: Record<string, number>;
  categories: EventCategory[];
}

/** What applying a year's official dates would change. */
export interface YearDiff {
  terms: Array<{
    number: number;
    name: string;
    from: { start: string; end: string; uaMonths: string[] } | null;
    to: { start: string; end: string; uaMonths: string[] } | null;
    changed: boolean;
    schoolDays: number;
  }>;
  holidays: {
    added: Array<{ date: string; name: string }>;
    removed: Array<{ date: string; name: string }>;
    renamed: Array<{ date: string; name: string; was: string }>;
  };
  /** The official dates applying the year would add or drop — the two cycles differ here. */
  events: {
    added: Array<{ date: string; endDate: string | null; title: string; category: EventCategory; cycle: EventCycle }>;
    removed: Array<{ date: string; endDate: string | null; title: string; category: EventCategory; cycle: EventCycle }>;
    total: number;
  };
  schoolDays: number;
}

export interface PlannerSummary {
  title: string | null;
  sheets: string[];
  skipped: string[];
  count: number;
  byCategory: Record<string, number>;
  months: Array<{ month: string; count: number }>;
  from: string | null;
  to: string | null;
  sample: Array<{ date: string; title: string; category: EventCategory }>;
}

export interface PlannerPreview {
  importId: string;
  fileName: string;
  summary: PlannerSummary;
  alreadyImported: number;
}

// ---- Reminders ---------------------------------------------------------------

export interface ReminderSettings {
  enabled: boolean;
  leadDays: number[];
  categories: EventCategory[];
  hour: number;
  autoPrepare: boolean;
  prepareDays: number;
  lastRun: string;
}

export interface MailStatus {
  configured: boolean;
  dryRun: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  missing: string[];
  reason: string;
}

export interface Subscriber {
  id: number;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface AccountEmail {
  id: number;
  username: string;
  email: string;
  demo: boolean;
}

export interface Recipient {
  email: string;
  name: string;
  source: 'user' | 'subscriber';
}

export interface ReminderGroup {
  date: string;
  lead: number;
  sendOn: string;
  due: boolean;
  subject: string;
  text: string;
  items: Array<{ key: string; title: string; category: EventCategory; source?: EventSource; endDate?: string | null }>;
}

export interface ReminderPreview {
  today: string;
  horizon: number;
  enabled: boolean;
  leadDays: number[];
  categories: EventCategory[];
  recipients: Recipient[];
  mail: MailStatus;
  groups: ReminderGroup[];
}

export interface OutboxMessage {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  ics: string;
  status: 'sent' | 'dry-run' | 'failed';
  detail: string;
  createdAt: string;
}

export interface ReminderLogEntry {
  id: number;
  key: string;
  date: string;
  lead: number;
  recipient: string;
  status: string;
  detail: string;
  sentAt: string;
  eventTitle: string;
}

export interface RemindersData {
  settings: ReminderSettings;
  mail: MailStatus;
  subscribers: Subscriber[];
  accounts: AccountEmail[];
  recipients: Recipient[];
  preview: ReminderPreview;
  outbox: OutboxMessage[];
  log: ReminderLogEntry[];
  today: string;
}

// ---- The two cycles: primary and college ---------------------------------------

/** The primary is marked by discipline; the college by subject, coefficient and séquence. */
export type Cycle = 'primary' | 'college';

export interface CollegeSubject {
  id: number;
  classId: number;
  code: string;
  label: string;
  labelEn: string;
  groupNo: number;
  coefficient: number;
  teacher: string;
}

/** One of the six séquences of the year: a term's teaching weeks cut in two. */
export interface Sequence {
  number: number;
  term: number;
  part: number;
  label: string;
  start: string;
  end: string;
  weeks: number[];
  schoolDays: number;
}

export interface SequenceSheetData {
  class: { id: number; name: string; code: string; cycle: Cycle };
  sequence: Sequence;
  sequences: Sequence[];
  subjects: CollegeSubject[];
  kinds: string[];
  pupils: Array<{
    pupilId: number;
    studentId: string;
    classNo: number;
    name: string;
    status: string;
    marks: Array<{ code: string; interro: number | null; devoir: number | null; mark: number | null }>;
  }>;
  entered: number;
  expected: number;
}

export interface Mention {
  code: string;
  fr: string;
  en: string;
}

/** One line of the bulletin: a subject, its two séquences, its term mark and its rank. */
export interface BulletinSubject {
  code: string;
  label: string;
  labelEn: string;
  groupNo: number;
  coefficient: number;
  teacher: string;
  seq: Record<number, number | null>;
  trim: number | null;
  rank: number | null;
  classAverage?: number | null;
}

export interface BulletinGroup {
  groupNo: number;
  label: string;
  labelEn: string;
  coefficient: number;
  classAverage: number | null;
}

export interface BulletinPupil {
  pupilId: number;
  studentId: string;
  classNo: number;
  name: string;
  gender: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  address: string | null;
  guardian: string | null;
  status: string;
  subjects: BulletinSubject[];
  groups: Array<{ groupNo: number; label: string; coefficient: number; seq: Record<number, number | null>; trim: number | null; rank: number | null }>;
  points: number | null;
  coefficient: number;
  average: number | null;
  mention: Mention | null;
  sequenceAverages: Record<number, number | null>;
  conduct: number | null;
  remark: string;
  attendance: { justified: number; unjustified: number; late: number; present: number };
  rank: number | null;
}

export interface CollegeBulletin {
  cycle: Cycle;
  class: { id: number; name: string; code: string; cycle: Cycle };
  term: { number: number; name: string; start: string; end: string };
  sequences: number[];
  sequenceGrid: Sequence[];
  subjects: Array<BulletinSubject & { classAverage: number | null }>;
  groups: BulletinGroup[];
  pupils: BulletinPupil[];
  classProfile: { count: number; average: number | null; best: number | null; worst: number | null; passMark: number; passing: number };
  school: { name: string; subtitle: string; academicYear: string; cycle: Cycle };
}
