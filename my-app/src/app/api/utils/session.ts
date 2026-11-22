import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Student identity.
 *
 * After Microsoft sign-in the server stores the Microsoft account id in an HMAC-signed, httpOnly
 * cookie. Every ownership check uses the id from this cookie — never an id sent by the browser.
 * The signing key comes from SESSION_SECRET; without it, sessions are refused (fail closed).
 */

export const SESSION_COOKIE = "aiq_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  uid: string; // "ms:<Microsoft account id>"
  name: string;
  email: string;
  exp: number; // epoch seconds
}

function secret(): Buffer | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? Buffer.from(s) : null;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payload: string, key: Buffer): string {
  return b64url(createHmac("sha256", key).update(payload).digest());
}

export function createSessionToken(data: { uid: string; name?: string; email?: string }, now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not configured (min 32 characters).");
  const session: Session = {
    uid: data.uid,
    name: (data.name || "").slice(0, 100),
    email: (data.email || "").slice(0, 200),
    exp: Math.floor(now / 1000) + MAX_AGE_SECONDS,
  };
  const payload = b64url(Buffer.from(JSON.stringify(session)));
  return `${payload}.${sign(payload, key)}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!session.uid || typeof session.exp !== "number" || session.exp * 1000 < now) return null;
    return session;
  } catch {
    return null;
  }
}

export function getSession(req: NextRequest): Session | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(res: NextResponse, token: string, secure: boolean) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax" });
}

/**
 * Reads the student's identity from the ID token returned by Microsoft's token endpoint.
 * The token is received directly from Microsoft over TLS (server-to-server), so it isn't user-supplied;
 * we still check it was issued for this app and hasn't expired. Needs no Graph permission
 * (unlike /me, which requires User.Read).
 */
export function identityFromIdToken(
  idToken: string | undefined | null,
  clientId: string,
  now = Date.now()
): { uid: string; name: string; email: string } | null {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!claims || claims.aud !== clientId) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 5 * 60 * 1000) return null;
    if (typeof claims.iss !== "string" || !/^https:\/\/login\.microsoftonline\.com\//.test(claims.iss)) return null;
    const oid = typeof claims.oid === "string" ? claims.oid.trim() : "";
    if (!oid) return null;
    return {
      uid: `ms:${oid}`, // same value as Graph /me "id"
      name: String(claims.name || ""),
      email: String(claims.email || claims.preferred_username || ""),
    };
  } catch {
    return null;
  }
}

/** Builds the stable user id from a Microsoft Graph /me response. */
export function uidFromGraphProfile(profile: any): string | null {
  const id = typeof profile?.id === "string" ? profile.id.trim() : "";
  return id ? `ms:${id}` : null;
}
