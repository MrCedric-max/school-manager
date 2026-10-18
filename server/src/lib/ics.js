// Building .ics files: the attachment that turns a reminder e-mail into something that
// lands in the recipient's own calendar (Google Calendar, Outlook, Apple Calendar all
// answer the attachment with "Add to calendar").

const CRLF = '\r\n';

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 folds content lines at 75 octets, continuing them with a leading space. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // never split in the middle of a UTF-8 character
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return out.join(`${CRLF} `);
}

const stamp = (date) => `${date.replace(/-/g, '')}`;

/**
 * An all-day event runs from its date to the day after (iCal ends are exclusive).
 * An event with an end date runs through that day.
 */
function dateRange(item) {
  const start = stamp(item.date);
  const end = item.endDate && item.endDate > item.date ? stamp(addOne(item.endDate)) : stamp(addOne(item.date));
  return { start, end };
}

function addOne(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowStamp(now = new Date()) {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/**
 * @param {{items: Array<{date:string,endDate?:string|null,title:string,category?:string}>,
 *          schoolName?: string, location?: string, organizer?: string, attendee?: string,
 *          reminderMinutes?: number[], now?: Date, uidSalt?: string}} input
 */
export function buildIcs({
  items,
  schoolName = 'School Manager',
  location = '',
  organizer = '',
  attendee = '',
  reminderMinutes = [60 * 24],
  now = new Date(),
  uidSalt = 'school',
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//School Manager//School Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    `X-WR-CALNAME:${escapeText(schoolName)}`,
  ];

  items.forEach((item, index) => {
    const { start, end } = dateRange(item);
    const uid = `${uidSalt}-${start}-${index}-${String(item.title).length}@school-manager`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStamp(now)}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(item.title)}`,
    );
    const description = [item.category ? { official: 'Official date', break: 'Holiday period', holiday: 'Public holiday', exam: 'Examinations', deadline: 'Deadline', event: 'School event' }[item.category] ?? '' : '', schoolName]
      .filter(Boolean)
      .join(' · ');
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    if (organizer) lines.push(`ORGANIZER;CN=${escapeText(schoolName)}:mailto:${organizer}`);
    if (attendee) lines.push(`ATTENDEE;CN=${escapeText(attendee)};RSVP=FALSE:mailto:${attendee}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:TRANSPARENT', `SEQUENCE:${now.getUTCFullYear()}`);
    for (const minutes of reminderMinutes) {
      const trigger = minutes % (60 * 24) === 0 ? `-P${minutes / (60 * 24)}D` : `-PT${minutes}M`;
      lines.push('BEGIN:VALARM', `TRIGGER:${trigger}`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(item.title)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}

/** A single event, for the "add this one date" button. */
export function buildEventIcs(item, options = {}) {
  return buildIcs({ items: [item], ...options });
}
