import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../utils/db";
import { getSession, type Session } from "../utils/session";
import { QuizError } from "./attempts";

/** Runs a quiz handler for the signed-in student; maps errors to clean JSON responses. */
export async function withStudent(req: NextRequest, handler: (session: Session) => Promise<unknown>) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ message: "Sign in with Microsoft to save and view your quiz attempts.", code: "SIGN_IN_REQUIRED" }, { status: 401 });
  }
  try {
    await connectDB();
    const data = await handler(session);
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    if (err instanceof QuizError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error("Quiz route error:", err?.message);
    return NextResponse.json({ message: "Something went wrong with this quiz. Please try again." }, { status: 500 });
  }
}
