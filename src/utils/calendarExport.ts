import { parseIsoDate } from './weightCalculations';

export interface WorkoutReminder {
  /** Local workout date, YYYY-MM-DD. */
  date: string;
  /** Event title, e.g. "אימון A - MacroLift". */
  title: string;
  description?: string;
  /** Hour of day (local, 0-23) the built-in alert fires on the workout day. */
  alarmHour?: number;
}

const CRLF = '\r\n';

function toIcsDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function toIcsUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** RFC 5545 text escaping. */
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to 75 octets (UTF-8 aware, never splitting a character); continuation lines start with a space. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = 74; // continuation lines lose one octet to the leading space
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/**
 * An iCalendar (.ics) file with one all-day workout event and a built-in alarm at `alarmHour` (default 09:00) on the day.
 * Calendar apps (Apple Calendar on iOS included) raise the alert natively, so no server or push infrastructure is needed.
 */
export function buildWorkoutIcs({ date, title, description, alarmHour = 9 }: WorkoutReminder, now: Date = new Date()): string {
  const start = parseIsoDate(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MacroLift//Workout Reminder//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@macrolift.app`,
    `DTSTAMP:${toIcsUtcStamp(now)}`,
    `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
    `DTEND;VALUE=DATE:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(title)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    // Positive offset from the start of the all-day event = that hour on the workout day.
    `TRIGGER;RELATED=START:PT${alarmHour}H`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * Hands the reminder to the phone's calendar: the native share sheet where it supports files (iOS offers "Add to Calendar"),
 * otherwise a normal .ics download. Returns false if the user dismissed the share sheet.
 */
export async function shareWorkoutReminder(reminder: WorkoutReminder): Promise<boolean> {
  const content = buildWorkoutIcs(reminder);
  const filename = `macrolift-workout-${reminder.date}.ics`;
  const file = new File([content], filename, { type: 'text/calendar;charset=utf-8' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: reminder.title });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // Any other share failure falls through to a plain download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
