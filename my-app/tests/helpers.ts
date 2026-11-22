import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../src/app/api/utils/session";

export const STUDENT_A = "ms:student-a-0000";
export const STUDENT_B = "ms:student-b-1111";

export function sessionCookie(uid: string) {
  return `${SESSION_COOKIE}=${createSessionToken({ uid, name: uid, email: `${uid}@example.edu` })}`;
}

export function post(path: string, body: unknown, opts: { uid?: string; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(opts.headers || {}) };
  const cookie = opts.cookie ?? (opts.uid ? sessionCookie(opts.uid) : undefined);
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers });
}

export function get(path: string, opts: { uid?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.uid) headers.cookie = sessionCookie(opts.uid);
  return new NextRequest(`http://localhost${path}`, { method: "GET", headers });
}

export async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}
