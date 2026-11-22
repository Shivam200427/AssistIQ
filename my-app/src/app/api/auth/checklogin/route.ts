import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSession, setSessionCookie, uidFromGraphProfile } from "../../utils/session";

export const dynamic = "force-dynamic";

/**
 * Reports whether the student is signed in. Students who signed in before sessions existed have
 * only the Microsoft token cookie; for them the session is created here from Graph /me.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (session) {
    return NextResponse.json({ Authorized: true, user: { name: session.name, email: session.email } }, { status: 200 });
  }

  const ms_token = req.cookies.get("ms_tokens")?.value;
  if (!ms_token) {
    return NextResponse.json({ Authorized: false }, { status: 401 });
  }

  try {
    const { access_token } = JSON.parse(ms_token);
    const me = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 8000,
    });
    const uid = uidFromGraphProfile(me.data);
    if (!uid) throw new Error("No account id");
    const name = me.data.displayName || "";
    const email = me.data.mail || me.data.userPrincipalName || "";
    const res = NextResponse.json({ Authorized: true, user: { name, email } }, { status: 200 });
    setSessionCookie(res, createSessionToken({ uid, name, email }), (process.env.CALLBACK_URL || "").startsWith("https://"));
    return res;
  } catch {
    // Expired or invalid Microsoft token: treat as signed out.
    return NextResponse.json({ Authorized: false }, { status: 401 });
  }
}
