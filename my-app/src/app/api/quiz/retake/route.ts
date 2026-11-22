import { NextRequest } from "next/server";
import { startRetake } from "../attempts";
import { withStudent } from "../guard";

export const dynamic = "force-dynamic";

/** Starts a fresh attempt for the caller; earlier submitted attempts are kept. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return withStudent(req, (s) => startRetake(body?.quizid, s.uid));
}
