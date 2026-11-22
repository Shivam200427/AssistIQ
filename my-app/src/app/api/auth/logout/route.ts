import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../utils/session";

export async function GET() {
  const res = NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  res.cookies.set("ms_tokens", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax" });
  clearSessionCookie(res);
  return res;
}
