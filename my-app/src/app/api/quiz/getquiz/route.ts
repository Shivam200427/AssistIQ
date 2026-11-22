import { NextRequest } from "next/server";
import { getQuizForStudent } from "../attempts";
import { withStudent } from "../guard";

export const dynamic = "force-dynamic";

/** Returns the quiz plus the caller's own attempt. Correct answers only after the caller submits. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return withStudent(req, (s) => getQuizForStudent(body?.id, s.uid));
}
