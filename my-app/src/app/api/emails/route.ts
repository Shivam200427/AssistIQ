import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const ms_token = req.cookies.get("ms_tokens")?.value;
  if (!ms_token) {
    return NextResponse.json({ error: "Unauthorized", authorized: false }, { status: 401 });
  }

  let access_token = "";
  try {
    const parsed = JSON.parse(ms_token);
    access_token = parsed.access_token;
  } catch (e) {
    const res = NextResponse.json({ error: "Invalid token format", authorized: false }, { status: 401 });
    res.cookies.delete("ms_tokens");
    return res;
  }

  const authHeaders = {
    Authorization: `Bearer ${access_token}`,
    Prefer: 'outlook.body-content-type="text"',
  };

  try {
    let rawMessages: any[] = [];

    // 1. Identify connected account
    let userIdentifier = "Unknown User";
    try {
      const meRes = await axios.get("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 5000,
      });
      userIdentifier = meRes.data?.mail || meRes.data?.userPrincipalName || meRes.data?.displayName || "Connected User";
    } catch (meErr: any) {
      console.log("[Microsoft Graph] /me check notice:", meErr?.response?.status, meErr.message);
    }

    // 3. Strategy A: Primary Inbox Messages (newest first)
    try {
      const inboxRes = await axios.get(
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc",
        { headers: authHeaders, timeout: 8000 }
      );
      rawMessages = inboxRes.data?.value || [];
      console.log(`[Microsoft Graph] Strategy A (/mailFolders/inbox/messages) returned ${rawMessages.length} messages`);
    } catch (errA: any) {
      console.log("[Microsoft Graph] Strategy A error:", errA?.response?.status, errA?.response?.data?.error?.message || errA.message);
    }

    // 4. Strategy B: Global Messages endpoint (newest first)
    if (rawMessages.length === 0) {
      try {
        const globalRes = await axios.get(
          "https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc",
          { headers: authHeaders, timeout: 8000 }
        );
        rawMessages = globalRes.data?.value || [];
        console.log(`[Microsoft Graph] Strategy B (/me/messages ordered) returned ${rawMessages.length} messages`);
      } catch (errB: any) {
        console.log("[Microsoft Graph] Strategy B error:", errB?.response?.status, errB?.response?.data?.error?.message || errB.message);
      }
    }

    // 5. Strategy C: Plain /me/messages with no orderby (for accounts where receivedDateTime indexing is restricted)
    if (rawMessages.length === 0) {
      try {
        const plainRes = await axios.get(
          "https://graph.microsoft.com/v1.0/me/messages?$top=50",
          { headers: authHeaders, timeout: 8000 }
        );
        rawMessages = plainRes.data?.value || [];
        console.log(`[Microsoft Graph] Strategy C (/me/messages plain) returned ${rawMessages.length} messages`);
      } catch (errC: any) {
        console.log("[Microsoft Graph] Strategy C error:", errC?.response?.status, errC?.response?.data?.error?.message || errC.message);
      }
    }

    // 6. Strategy D: Plain /mailFolders/inbox/messages with no orderby
    if (rawMessages.length === 0) {
      try {
        const plainInboxRes = await axios.get(
          "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50",
          { headers: authHeaders, timeout: 8000 }
        );
        rawMessages = plainInboxRes.data?.value || [];
        console.log(`[Microsoft Graph] Strategy D (plain inbox) returned ${rawMessages.length} messages`);
      } catch (errD: any) {
        console.log("[Microsoft Graph] Strategy D error:", errD?.response?.status, errD?.response?.data?.error?.message || errD.message);
      }
    }

    const emails = rawMessages.map((e: any) => ({
      id: e.id,
      subject: e.subject || "(No subject)",
      from: {
        emailAddress: {
          name: e.from?.emailAddress?.name || e.sender?.emailAddress?.name || "Unknown Sender",
          address: e.from?.emailAddress?.address || e.sender?.emailAddress?.address || "",
        },
      },
      receivedDateTime: e.receivedDateTime || new Date().toISOString(),
      importance: e.importance?.toLowerCase() || "normal",
      hasAttachments: e.hasAttachments || false,
      categories: e.categories || [],
      bodyPreview: e.bodyPreview || "",
      body: {
        contentType: e.body?.contentType || "Text",
        content: e.body?.content || e.bodyPreview || "",
      },
    }));

    
    const response = NextResponse.json(emails, { status: 200 });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-User-Email", userIdentifier);
    return response;

  } catch (err: any) {
    console.error("[Microsoft Graph] Fatal error:", err?.response?.status, err?.message);
    if (err?.response?.status === 401) {
      const res = NextResponse.json({ error: "Session expired. Please reconnect.", authorized: false }, { status: 401 });
      res.cookies.delete("ms_tokens");
      return res;
    }
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
