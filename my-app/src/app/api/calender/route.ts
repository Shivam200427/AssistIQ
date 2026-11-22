import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { buildGraphEvent } from "./event";

function accessToken(req: NextRequest): string | null {
  const raw = req.cookies.get("ms_tokens")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw).access_token || null;
  } catch {
    return null;
  }
}

/** Lists upcoming calendar events. */
export async function GET(req: NextRequest) {
  const token = accessToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const response = await axios.get("https://graph.microsoft.com/v1.0/me/events", { headers: { Authorization: `Bearer ${token}` } });
    const events = (response.data?.value || []).map((e: any) => ({
      id: e.id,
      subject: e.subject,
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      location: e.location?.displayName,
    }));
    return NextResponse.json(events, { status: 200 });
  } catch (err: any) {
    console.error("Calendar list error:", err?.message);
    return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 500 });
  }
}

/**
 * Creates ONE calendar event — only after the student has seen a preview and confirmed it.
 * The request must include confirmed: true and a complete, valid event; otherwise nothing is written.
 */
export async function POST(req: NextRequest) {
  const token = accessToken(req);
  if (!token) return NextResponse.json({ message: "Connect your Outlook account first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.confirmed !== true) {
    return NextResponse.json({ message: "Review the event and confirm it before it is added to your calendar." }, { status: 400 });
  }
  const { event, error } = buildGraphEvent(body.event, String(body.timeZone || "UTC"));
  if (!event) return NextResponse.json({ message: error }, { status: 400 });

  try {
    const res = await axios.post("https://graph.microsoft.com/v1.0/me/events", event, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: 15000,
    });
    return NextResponse.json({ created: true, id: res.data?.id, webLink: res.data?.webLink }, { status: 201 });
  } catch (err: any) {
    const status = err?.response?.status;
    console.error("Calendar create error:", status, err?.response?.data?.error?.code || err?.message);
    if (status === 401) return NextResponse.json({ message: "Your Outlook session expired. Reconnect and try again." }, { status: 401 });
    if (status === 403) {
      return NextResponse.json(
        { message: "AssistIQ doesn't have permission to add events to your calendar yet. Reconnect Outlook after calendar write access (Calendars.ReadWrite) is enabled." },
        { status: 403 }
      );
    }
    return NextResponse.json({ message: "The event couldn't be added. Nothing was changed in your calendar. Please try again." }, { status: 502 });
  }
}
