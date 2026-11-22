import { NextRequest, NextResponse } from "next/server";
import { getGroqKey, groqChat } from "../../utils/ai";

/**
 * Proposes an event from an email's extracted dates. This NEVER writes to the calendar — the student
 * edits and confirms the proposal in a preview, and only then calls POST /api/calender.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const subject = String(body?.subject || "").slice(0, 200);
  const events = String(body?.events || "").slice(0, 3000);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.today)) ? body.today : new Date().toISOString().slice(0, 10);
  const blank = { subject: subject || "Event", date: "", startTime: "", endTime: "", location: "", allDay: false };

  if (!events.trim() || !getGroqKey()) {
    return NextResponse.json({ draft: blank, complete: false, message: "Fill in the date and time before adding it." }, { status: 200 });
  }
  try {
    const raw = await groqChat(
      `From this text, extract the single most important event as JSON only:
{"subject": string, "date": "YYYY-MM-DD" or "", "startTime": "HH:MM" (24h) or "", "endTime": "HH:MM" or "", "location": string, "allDay": boolean}
Today's date is ${today}; resolve relative dates like "Friday" to the next such date. Leave a field empty if it is not stated — do not guess times.
Email subject: ${subject}
Extracted details:
${events}`,
      { temperature: 0, json: true, timeout: 15000 }
    );
    const d = JSON.parse(raw || "{}");
    const draft = {
      subject: String(d.subject || blank.subject).slice(0, 200),
      date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
      startTime: /^\d{2}:\d{2}$/.test(d.startTime) ? d.startTime : "",
      endTime: /^\d{2}:\d{2}$/.test(d.endTime) ? d.endTime : "",
      location: String(d.location || "").slice(0, 200),
      allDay: !!d.allDay,
    };
    const complete = !!draft.date && (draft.allDay || (!!draft.startTime && !!draft.endTime));
    return NextResponse.json({ draft, complete, message: complete ? "" : "Some details weren't in the email — fill them in before adding." }, { status: 200 });
  } catch (e: any) {
    console.error("Calendar draft error:", e?.message);
    return NextResponse.json({ draft: blank, complete: false, message: "Couldn't read the details automatically — fill them in yourself." }, { status: 200 });
  }
}
