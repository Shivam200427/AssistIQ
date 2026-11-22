import { NextRequest } from "next/server";
import { listMistakes } from "../attempts";
import { withStudent } from "../guard";

export const dynamic = "force-dynamic";

/** The signed-in student's mistakes notebook: wrong answers from their latest attempt of each quiz. */
export async function GET(req: NextRequest) {
  return withStudent(req, (s) => listMistakes(s.uid));
}
