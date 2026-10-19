import {
  MONTH_NAMES,
  addDays,
  dayOfWeek,
  diffDays,
  firstOfMonth,
  lastOfMonth,
  nextMonthKey,
} from './dates.js';

/**
 * Week number of a date, counted from the Monday of week 1
 * (workbook: "Weeks are numbered from Monday 7 September 2026").
 * Dates before week 1 have no week number.
 */
export function weekOf(iso, week1Start) {
  const d = diffDays(week1Start, iso);
  if (d < 0) return null;
  return Math.floor(d / 7) + 1;
}

/**
 * Build the whole school calendar — the web equivalent of the Calendar and
 * Lists sheets. Day types: school | weekend | holiday | break.
 *
 * @param {{yearStart:string, yearEnd:string, week1Start:string,
 *          terms:{number:number,name:string,start_date:string,end_date:string,ua_months:string[]}[],
 *          holidays:{date:string,name:string}[],
 *          breaks?:{start:string,end:string,name:string}[]}} input
 *
 * `breaks` are the holiday periods of the national calendar (Christmas, Easter). They fall
 * inside a term — the arrêté splits a term around them — and their weekdays are days off
 * without being public holidays.
 */
export function buildCalendar({ yearStart, yearEnd, week1Start, terms, holidays, breaks = [] }) {
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const sortedTerms = [...terms].sort((a, b) => a.number - b.number);
  const termOf = (iso) => sortedTerms.find((t) => iso >= t.start_date && iso <= t.end_date)?.number ?? null;
  const sortedBreaks = [...breaks].sort((a, b) => a.start.localeCompare(b.start));
  const breakOf = (iso) => sortedBreaks.find((b) => iso >= b.start && iso <= b.end) ?? null;

  const days = [];
  if (yearStart && yearEnd && yearStart <= yearEnd) {
    for (let d = yearStart; d <= yearEnd; d = addDays(d, 1)) {
      const dow = dayOfWeek(d);
      const weekend = dow === 0 || dow === 6;
      const term = termOf(d);
      const onBreak = breakOf(d);
      let type;
      if (holidayByDate.has(d)) type = 'holiday';
      else if (onBreak && !weekend) type = 'break';
      else if (weekend) type = 'weekend';
      else if (term) type = 'school';
      else type = 'break';
      days.push({
        date: d,
        dow,
        week: weekOf(d, week1Start),
        month: d.slice(0, 7),
        term,
        type,
        holiday: holidayByDate.get(d) ?? null,
        breakName: onBreak?.name ?? null,
      });
    }
  }

  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const schoolDays = days.filter((d) => d.type === 'school').map((d) => d.date);

  // Months (Lists sheet: first/last weekday, week range, "UA month of" term)
  const months = [];
  if (days.length) {
    for (let key = yearStart.slice(0, 7); key <= yearEnd.slice(0, 7); key = nextMonthKey(key)) {
      const from = firstOfMonth(key) < yearStart ? yearStart : firstOfMonth(key);
      const to = lastOfMonth(key) > yearEnd ? yearEnd : lastOfMonth(key);
      const weekdays = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const dow = dayOfWeek(d);
        if (dow !== 0 && dow !== 6) weekdays.push(d);
      }
      if (!weekdays.length) continue;
      const firstDay = weekdays[0];
      const lastDay = weekdays[weekdays.length - 1];
      const uaTerm = sortedTerms.find((t) => t.ua_months.includes(key));
      const monthIndex = Number(key.slice(5, 7)) - 1;
      months.push({
        key,
        number: monthIndex + 1,
        year: Number(key.slice(0, 4)),
        name_en: MONTH_NAMES.en[monthIndex],
        name_fr: MONTH_NAMES.fr[monthIndex],
        firstDay,
        lastDay,
        weekFrom: weekOf(firstDay, week1Start) ?? 1,
        weekTo: weekOf(lastDay, week1Start) ?? 1,
        uaTerm: uaTerm?.number ?? null,
        uaIndex: uaTerm ? uaTerm.ua_months.indexOf(key) + 1 : null,
        schoolDays: schoolDays.filter((d) => d >= firstDay && d <= lastDay).length,
      });
    }
  }

  // Weeks (W1 … last week of the year)
  const weeks = [];
  const lastWeek = days.length ? weekOf(yearEnd, week1Start) ?? 0 : 0;
  for (let w = 1; w <= lastWeek; w += 1) {
    const monday = addDays(week1Start, (w - 1) * 7);
    const friday = addDays(monday, 4);
    const weekSchoolDays = schoolDays.filter((d) => d >= monday && d <= friday);
    const termDay = [0, 1, 2, 3, 4].map((i) => dayByDate.get(addDays(monday, i))).find((d) => d?.term);
    weeks.push({
      number: w,
      monday,
      friday,
      term: termDay?.term ?? null,
      schoolDays: weekSchoolDays.length,
    });
  }

  const termInfo = sortedTerms.map((t) => ({
    number: t.number,
    name: t.name,
    start: t.start_date,
    end: t.end_date,
    uaMonths: t.ua_months,
    weekFrom: weekOf(t.start_date, week1Start) ?? 1,
    weekTo: weekOf(t.end_date, week1Start) ?? 1,
    schoolDays: schoolDays.filter((d) => d >= t.start_date && d <= t.end_date).length,
  }));

  const summary = {
    firstSchoolDay: schoolDays[0] ?? null,
    lastSchoolDay: schoolDays[schoolDays.length - 1] ?? null,
    schoolDays: schoolDays.length,
    publicHolidays: days.filter((d) => d.type === 'holiday').length,
    breakWeekdays: days.filter((d) => d.type === 'break').length,
  };

  return { days, dayByDate, schoolDays, months, weeks, terms: termInfo, summary };
}

/** School days between two dates (inclusive). */
export function schoolDaysBetween(calendar, from, to) {
  return calendar.schoolDays.filter((d) => d >= from && d <= to);
}

/** Information about "today": term, week and day type (Dashboard header). */
export function describeDay(calendar, iso) {
  const day = calendar.dayByDate.get(iso);
  if (!day) return { date: iso, week: null, term: null, type: 'outside', holiday: null, month: iso.slice(0, 7) };
  return { date: iso, week: day.week, term: day.term, type: day.type, holiday: day.holiday, month: day.month };
}

/** The most recent school day on or before `iso` (or the first school day). */
export function latestSchoolDay(calendar, iso) {
  let found = null;
  for (const d of calendar.schoolDays) {
    if (d <= iso) found = d;
    else break;
  }
  return found ?? calendar.schoolDays[0] ?? null;
}
