import axios from "axios";
import { randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const client_id = process.env.MICROSOFT_CLIENT_ID!;
const client_secret = process.env.MICROSOFT_CLIENT_SECRET!;
const redirect_url = process.env.CALLBACK_URL!;
const Scope = process.env.SCOPES!;

const STATE_COOKIE = "ms_oauth_state";
const DEFAULT_REDIRECT = "/EmailSummarizer";
// Mark cookies Secure whenever the app is served over HTTPS (keeps plain-http local setups working).
const secureCookies = (redirect_url || "").startsWith("https://");

// Only allow same-site relative paths ("/foo"), never "//host" or "/\host" which browsers treat as external.
function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

function statesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  const error_description = url.searchParams.get("error_description");

  if (error) {
    console.error("Microsoft Auth Error:", error, error_description);
    return new NextResponse(`Microsoft Auth Error: ${error_description || error}`, {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  if (!code) {
    // Start the login: bind a random state to this browser so the callback cannot be forged (login CSRF).
    const nonce = randomBytes(16).toString("hex");
    const redirectPath = safeRedirectPath(url.searchParams.get("redirect"));
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(client_id)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect_url)}&response_mode=query` +
      `&scope=${encodeURIComponent(Scope)}&prompt=select_account&state=${nonce}`;

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(STATE_COOKIE, JSON.stringify({ nonce, redirectPath }), {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 600,
    });
    return res;
  }

  let expected: { nonce?: string; redirectPath?: string } = {};
  try {
    expected = JSON.parse(req.cookies.get(STATE_COOKIE)?.value || "{}");
  } catch {
    expected = {};
  }
  if (!expected.nonce || !statesMatch(expected.nonce, returnedState)) {
    return new NextResponse("Login session expired or invalid. Please try connecting again.", {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", client_id);
    params.append("client_secret", client_secret);
    params.append("code", code);
    params.append("redirect_uri", redirect_url);
    params.append("grant_type", "authorization_code");
    params.append("scope", Scope);

    const tokenResponse = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const destination = new URL(safeRedirectPath(expected.redirectPath || null), url.origin);
    const res = NextResponse.redirect(destination);

    res.cookies.set("ms_tokens",
      JSON.stringify({
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000
    }),{
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: expires_in || 3600,
    });
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth" });

    return res;

  } catch (err: any) {
    console.error("Token exchange failed:", err?.response?.data?.error || err.message);
    return new NextResponse("Token exchange failed. Please try connecting again.", { status: 500 });
  }
}
