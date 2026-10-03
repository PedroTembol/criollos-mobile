export const EVENT_TIME_ZONE = 'America/Puerto_Rico';

type CalendarEvent = {
  title: string;
  date?: string | null;
  endDate?: string | null;
  datePrecision?: 'date' | 'datetime';
  description?: string;
  location?: string | null;
  sourceUrl?: string | null;
};

function validDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

function parseTime(value: string): Date | null {
  // A local time in the source belongs to Puerto Rico, regardless of device timezone.
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}-04:00`;
  const date = new Date(withZone);
  return Number.isFinite(date.getTime()) ? date : null;
}

function calendarTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildEventCalendarUrl(event: CalendarEvent): string | null {
  const value = event.date?.trim();
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !validDay(value.slice(0, 10))) return null;

  // Existing scraped events represent a date as midnight UTC. Preserve that calendar day.
  const allDay = event.datePrecision === 'date' || (!event.datePrecision &&
    (/^\d{4}-\d{2}-\d{2}$/.test(value) || /T00:00:00(?:\.0+)?Z$/.test(value)));
  let dates: string;
  if (allDay) {
    const start = value.slice(0, 10);
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    dates = `${start.replace(/-/g, '')}/${end.toISOString().slice(0, 10).replace(/-/g, '')}`;
  } else {
    const start = parseTime(value);
    const end = event.endDate ? parseTime(event.endDate) : start;
    if (!start || !end || end.getTime() < start.getTime()) return null;
    // An unknown end time stays unset in practice (zero duration); the user can choose it.
    dates = `${calendarTime(start)}/${calendarTime(end)}`;
  }

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.title);
  url.searchParams.set('dates', dates);
  url.searchParams.set('ctz', EVENT_TIME_ZONE);
  url.searchParams.set('details', [event.description, event.sourceUrl && `Fuente: ${event.sourceUrl}`,
    !allDay && !event.endDate && 'Hora de finalización no publicada; confirma la duración.'].filter(Boolean).join('\n\n'));
  url.searchParams.set('location', event.location || 'Caguas, PR');
  return url.toString();
}
