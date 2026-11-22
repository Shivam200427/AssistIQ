import { NextRequest } from "next/server";
import { recordAnswer } from "../attempts";
import { withStudent } from "../guard";

export const dynamic = "force-dynamic";

/** Saves one answer into the caller's own open attempt (never onto the shared quiz). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return withStudent(req, async (s) => {
    await recordAnswer(body?.quizid, body?.questionId, body?.choosenAnswer, s.uid);
    return { saved: true };
  });
}
