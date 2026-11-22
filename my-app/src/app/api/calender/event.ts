/** Validation for the "Add to calendar" write. Nothing is written unless every field checks out. */

export interface EventInput {
  subject: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (omit for all-day)
  endTime?: string; // HH:mm
  location?: string;
  notes?: string;
  allDay?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Returns the Microsoft Graph event body, or an error message. */
export function buildGraphEvent(input: any, timeZone: string): { event?: any; error?: string } {
  const subject = String(input?.subject || "").trim();
  const date = String(input?.date || "").trim();
  const allDay = !!input?.allDay;
  const startTime = String(input?.startTime || "").trim();
  const endTime = String(input?.endTime || "").trim();

  if (!subject) return { error: "The event needs a title." };
  if (subject.length > 255) return { error: "The title is too long." };
  if (!DATE_RE.test(date) || isNaN(Date.parse(`${date}T00:00:00Z`))) return { error: "Pick a valid date." };
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$|^UTC$/.test(timeZone)) return { error: "Unknown time zone." };

  const common = {
    subject,
    body: { contentType: "text", content: String(input?.notes || "Added from AssistIQ Email Summary").slice(0, 2000) },
    location: input?.location ? { displayName: String(input.location).slice(0, 255) } : undefined,
  };

  if (allDay) {
    return {
      event: { ...common, isAllDay: true, start: { dateTime: `${date}T00:00:00`, timeZone }, end: { dateTime: `${addDays(date, 1)}T00:00:00`, timeZone } },
    };
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return { error: "Enter a start and end time (HH:MM), or mark the event as all-day." };
  if (endTime <= startTime) return { error: "The end time must be after the start time." };
  return {
    event: { ...common, isAllDay: false, start: { dateTime: `${date}T${startTime}:00`, timeZone }, end: { dateTime: `${date}T${endTime}:00`, timeZone } },
  };
}
