import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const env = vi.hoisted(() => {
  process.env.MICROSOFT_CLIENT_ID = "test-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
  process.env.CALLBACK_URL = "https://assistiq.test/api/auth/callback";
  process.env.SCOPES = "openid profile email Mail.Read";
  return { clientId: "test-client-id" };
});

// Microsoft is mocked: the token endpoint answers, and Graph /me refuses (403), as in production.
const http = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({ default: { post: http.post, get: http.get } }));

import { GET as callback } from "../src/app/api/auth/callback/route";
import { GET as checklogin } from "../src/app/api/auth/checklogin/route";
import { identityFromIdToken, SESSION_COOKIE, verifySessionToken } from "../src/app/api/utils/session";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function idToken(claims: Record<string, unknown>) {
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}.signature`;
}
const goodClaims = () => ({
  aud: env.clientId,
  iss: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0",
  exp: Math.floor(Date.now() / 1000) + 3600,
  oid: "00000000-0000-0000-66f3-3332eca7ea81",
  name: "Test Student",
  preferred_username: "student@example.edu",
});
const forbidden = Object.assign(new Error("Request failed with status code 403"), { response: { status: 403 } });

beforeEach(() => {
  http.post.mockReset();
  http.get.mockReset();
});

describe("student identity from the Microsoft ID token", () => {
  it("reads the account id, name and email", () => {
    expect(identityFromIdToken(idToken(goodClaims()), env.clientId)).toEqual({
      uid: "ms:00000000-0000-0000-66f3-3332eca7ea81",
      name: "Test Student",
      email: "student@example.edu",
    });
  });

  it("rejects tokens for another app, expired tokens, other issuers and tokens without an account id", () => {
    expect(identityFromIdToken(idToken({ ...goodClaims(), aud: "someone-else" }), env.clientId)).toBeNull();
    expect(identityFromIdToken(idToken({ ...goodClaims(), exp: Math.floor(Date.now() / 1000) - 3600 }), env.clientId)).toBeNull();
    expect(identityFromIdToken(idToken({ ...goodClaims(), iss: "https://evil.example/" }), env.clientId)).toBeNull();
    expect(identityFromIdToken(idToken({ ...goodClaims(), oid: "" }), env.clientId)).toBeNull();
    expect(identityFromIdToken("not-a-jwt", env.clientId)).toBeNull();
    expect(identityFromIdToken(undefined, env.clientId)).toBeNull();
  });
});

describe("sign-in creates a session even when Graph /me is not allowed", () => {
  function callbackRequest() {
    const state = encodeURIComponent(JSON.stringify({ nonce: "n123", redirectPath: "/quizgenerator" }));
    return new NextRequest("https://assistiq.test/api/auth/callback?code=auth-code&state=n123", {
      headers: { cookie: `ms_oauth_state=${state}` },
    });
  }

  it("sets a valid session cookie from the ID token and returns to the quiz page", async () => {
    http.post.mockResolvedValueOnce({ data: { access_token: "at", refresh_token: "rt", expires_in: 3600, id_token: idToken(goodClaims()) } });
    http.get.mockRejectedValue(forbidden);

    const res = await callback(callbackRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://assistiq.test/quizgenerator");
    const token = res.cookies.get(SESSION_COOKIE)?.value;
    const session = verifySessionToken(token);
    expect(session).toMatchObject({ uid: "ms:00000000-0000-0000-66f3-3332eca7ea81", email: "student@example.edu" });
    expect(http.get).not.toHaveBeenCalled(); // no Graph call needed
  });

  it("falls back to Graph /me only when the ID token is missing", async () => {
    http.post.mockResolvedValueOnce({ data: { access_token: "at", refresh_token: "rt", expires_in: 3600 } });
    http.get.mockResolvedValueOnce({ data: { id: "graph-id-1", displayName: "G", mail: "g@example.edu" } });
    const res = await callback(callbackRequest());
    expect(verifySessionToken(res.cookies.get(SESSION_COOKIE)?.value)?.uid).toBe("ms:graph-id-1");
  });

  it("an existing Outlook login without a session still shows as connected", async () => {
    http.get.mockRejectedValue(forbidden);
    const req = new NextRequest("https://assistiq.test/api/auth/checklogin", {
      headers: { cookie: `ms_tokens=${encodeURIComponent(JSON.stringify({ access_token: "at" }))}` },
    });
    const res = await checklogin(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ Authorized: true, session: false });
  });
});
