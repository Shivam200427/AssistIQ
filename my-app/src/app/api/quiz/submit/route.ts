import { NextRequest } from "next/server";
import { submitAttempt } from "../attempts";
import { withStudent } from "../guard";

export const dynamic = "force-dynamic";

/** Submits the caller's attempt; the score is computed on the server. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return withStudent(req, (s) => submitAttempt(body?.quizid, s.uid));
}
