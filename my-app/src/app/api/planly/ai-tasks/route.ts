import { NextRequest, NextResponse } from "next/server";
import { getGroqKey, groqChat } from "../../utils/ai";

export const dynamic = "force-dynamic";

const DIFFICULTIES = ["easy", "medium", "hard"];

/** Adds days to a YYYY-MM-DD date (the user's local "today"), independent of the server's time zone. */
function isoDay(offsetDays: number, base?: string): string {
  const d = base ? new Date(`${base}T00:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Turns a goal like "prepare for my DBMS exam next Friday" into a list of concrete tasks. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = String(body?.goal || "").trim().slice(0, 1000);
    const context = String(body?.assignment || "").trim().slice(0, 100);
    const count = Math.min(Math.max(Number(body?.count) || 6, 1), 12);
    const today = String(body?.today || "").match(/^\d{4}-\d{2}-\d{2}$/) ? body.today : isoDay(0);

    if (!goal) {
      return NextResponse.json({ message: "Describe what you want to get done." }, { status: 400 });
    }
    if (!getGroqKey()) {
      return NextResponse.json({ message: "AI is not configured on the server." }, { status: 503 });
    }

    const prompt = `You are a study planner. Break the student's goal into ${count} concrete, actionable tasks.
Today's date is ${today}.${context ? ` The tasks belong to the assignment/project "${context}".` : ""}

Goal: """${goal}"""

Respond with JSON only, exactly in this shape:
{
  "tasks": [
    {
      "title": "short imperative task title (max 80 chars)",
      "notes": "one sentence with helpful detail",
      "difficulty": "easy" | "medium" | "hard",
      "dueInDays": integer number of days from today (0 = today), spread sensibly before any deadline in the goal,
      "tags": ["one or two short lowercase tags"]
    }
  ]
}`;

    const raw = await groqChat(prompt, { temperature: 0.4, json: true, timeout: 20000 });
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw || "{}");
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const list: any[] = Array.isArray(parsed?.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : [];
    const tasks = list.slice(0, count).map((t) => {
      const days = Math.round(Number(t?.dueInDays));
      return {
        title: String(t?.title || "").trim().slice(0, 120),
        notes: String(t?.notes || "").trim().slice(0, 400),
        difficulty: DIFFICULTIES.includes(t?.difficulty) ? t.difficulty : "medium",
        due: Number.isFinite(days) && days >= 0 && days <= 365 ? isoDay(days, today) : null,
        tags: (Array.isArray(t?.tags) ? t.tags : [])
          .map((x: any) => String(x).toLowerCase().trim().slice(0, 24))
          .filter(Boolean)
          .slice(0, 3),
      };
    }).filter((t) => t.title);

    if (tasks.length === 0) {
      return NextResponse.json({ message: "The AI didn't return any tasks. Try rephrasing your goal." }, { status: 502 });
    }
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (err: any) {
    console.error("Planly AI tasks error:", err?.message);
    return NextResponse.json({ message: "Could not generate tasks right now." }, { status: 500 });
  }
}
