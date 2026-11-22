import { readFileSync } from "fs";
import path from "path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

// --- Mocks: Microsoft Graph, the Python backend, S3 uploads and the AI are never really called. ---
const http = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({ default: { post: http.post, get: http.get } }));
const s3 = vi.hoisted(() => ({ sent: [] as any[] }));
vi.mock("../src/app/api/utils/s3", async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: "ap-southeast-2", credentials: { accessKeyId: "test-access-key-id", secretAccessKey: "x" } });
  // Presigning is local; only uploads (send) are intercepted.
  client.send = (async (cmd: any) => {
    s3.sent.push(cmd.input);
    return {};
  }) as any;
  return { default: client };
});
vi.mock("../src/app/api/utils/ai", () => ({
  getGroqKey: () => "test",
  groqChat: vi.fn(async () => JSON.stringify({ subject: "Project review", date: "2026-11-28", startTime: "15:00", endTime: "16:00", location: "Room 204", allDay: false })),
}));

import { connectDB } from "../src/app/api/utils/db";
import Document from "../src/app/api/lib/Document";
import { GET as docLink } from "../src/app/api/documents/[id]/link/route";
import { POST as uploadPdf } from "../src/app/api/uploadpdf/route";
import { POST as processPdf } from "../src/app/api/uploadpdf/process/route";
import { POST as createEvent } from "../src/app/api/calender/route";
import { POST as draftEvent } from "../src/app/api/calender/draft/route";
import { MAX_PDF_BYTES } from "../src/app/api/utils/upload";
import { backfillDocumentKeys } from "../scripts/backfill-document-keys.mjs";
import { STUDENT_A, STUDENT_B, get, post, sessionCookie } from "./helpers";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const MS_COOKIE = `ms_tokens=${encodeURIComponent(JSON.stringify({ access_token: "fake-ms-token" }))}`;

function linkParams(url: string) {
  const u = new URL(url);
  return { path: decodeURIComponent(u.pathname), expires: Number(u.searchParams.get("X-Amz-Expires")), date: u.searchParams.get("X-Amz-Date") };
}
function amzDateToMs(d: string) {
  return Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13), +d.slice(13, 15));
}

beforeAll(async () => {
  await connectDB();
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend.test";
});
beforeEach(async () => {
  await Document.deleteMany({});
  http.post.mockReset();
  http.get.mockReset();
  s3.sent = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("saved notes get fresh authorized links", () => {
  const legacyLink =
    "https://edumatebucket01.s3.amazonaws.com/pdfs/0086a81c-2bff-4f32-8a24-feaa6f5d4b34.pdf?AWSAccessKeyId=AKIAEXAMPLE&Signature=abc%3D&Expires=1700000000";

  it("opens an old note whose stored link expired long ago, via a freshly generated link", async () => {
    const doc = await Document.create({ userID: "demo", pdf_link: legacyLink, persist_dir: "./vectorstores/0086a81c-2bff-4f32-8a24-feaa6f5d4b34" });
    // Jump well past the old one-day expiry window.
    const later = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(later);

    const res = await docLink(get(`/api/documents/${doc._id}/link`), ctx(String(doc._id)));
    const body = await res.json();
    expect(res.status).toBe(200);
    const p = linkParams(body.url);
    expect(p.path).toBe("/pdfs/0086a81c-2bff-4f32-8a24-feaa6f5d4b34.pdf");
    expect(p.expires).toBe(3600);
    // Signed "now" (the later time), so it is valid for the next hour — unlike the stored link.
    expect(Math.abs(amzDateToMs(p.date!) - later.getTime())).toBeLessThan(60_000);
  });

  it("each open produces a new link; nothing expiring is stored", async () => {
    const doc = await Document.create({ userID: "x", notesKey: "pdfs/abc.pdf" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const a = (await (await docLink(get(`/api/documents/${doc._id}/link`), ctx(String(doc._id)))).json()).url;
    vi.setSystemTime(new Date("2027-01-05T00:00:00Z"));
    const b = (await (await docLink(get(`/api/documents/${doc._id}/link`), ctx(String(doc._id)))).json()).url;
    expect(a).not.toBe(b);
    const stored: any = await Document.findById(doc._id).lean();
    expect(stored.pdf_link).toBeUndefined();
  });

  it("only the owner can get links to a document uploaded while signed in", async () => {
    const doc = await Document.create({ userID: "x", ownerId: STUDENT_A, notesKey: "pdfs/owned.pdf" });
    expect((await docLink(get(`/api/documents/${doc._id}/link`, { uid: STUDENT_B }), ctx(String(doc._id)))).status).toBe(403);
    expect((await docLink(get(`/api/documents/${doc._id}/link`), ctx(String(doc._id)))).status).toBe(403);
    expect((await docLink(get(`/api/documents/${doc._id}/link`, { uid: STUDENT_A }), ctx(String(doc._id)))).status).toBe(200);
  });

  it("backfills keys for existing documents from their old links (dry run first, idempotent)", async () => {
    await Document.create({ userID: "demo", pdf_link: legacyLink });
    await Document.create({ userID: "demo", pdf_link: "not a url" });
    const db = mongoose.connection.db!;
    const dry = await backfillDocumentKeys(db, { dryRun: true, log: () => {} });
    expect(dry).toMatchObject({ candidates: 2, updated: 1, unrecoverable: 1 });
    expect(await Document.countDocuments({ notesKey: { $ne: null } })).toBe(0);
    await backfillDocumentKeys(db, { log: () => {} });
    const fixed: any = await Document.findOne({ pdf_link: legacyLink }).lean();
    expect(fixed.notesKey).toBe("pdfs/0086a81c-2bff-4f32-8a24-feaa6f5d4b34.pdf");
    const again = await backfillDocumentKeys(db, { log: () => {} });
    expect(again.updated).toBe(0);
  });
});

describe("PDF upload and processing", () => {
  function uploadReq(bytes: Buffer, uid?: string, name = "notes.pdf") {
    const fd = new FormData();
    fd.append("pdf", new File([new Uint8Array(bytes)], name, { type: "application/pdf" }));
    return new NextRequest("http://localhost/api/uploadpdf", { method: "POST", body: fd, headers: uid ? { cookie: sessionCookie(uid) } : {} });
  }
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100, 32)]);

  it("rejects an over-limit file with the same 4 MB limit the UI shows, before storing anything", async () => {
    const res = await uploadPdf(uploadReq(Buffer.concat([pdf, Buffer.alloc(MAX_PDF_BYTES)])));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("PDF is too large (max 4 MB).");
    expect(s3.sent).toHaveLength(0);
  });

  it("rejects files that aren't really PDFs", async () => {
    const res = await uploadPdf(uploadReq(Buffer.from("hello, not a pdf")));
    expect(res.status).toBe(400);
  });

  it("stores the original, then processes it and saves keys (not links)", async () => {
    const up = await (await uploadPdf(uploadReq(pdf, STUDENT_A))).json();
    expect(up.documentId).toBeTruthy();
    expect(s3.sent[0].Key).toMatch(/^pdf\/uplaod_pdf\//);

    http.post.mockResolvedValueOnce({ data: { pdflink: { notes_key: "pdfs/n.pdf", vectorstore: "./vectorstores/x", notes_status: "ai", pages: 3 } } });
    const res = await processPdf(post("/api/uploadpdf/process", { documentId: up.documentId }, { uid: STUDENT_A }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.link).toContain("pdfs/n.pdf");
    const doc: any = await Document.findById(up.documentId).lean();
    expect(doc).toMatchObject({ status: "ready", notesKey: "pdfs/n.pdf", ownerId: STUDENT_A, pages: 3 });
    expect(http.post.mock.calls[0][1]).toEqual({ key: doc.sourceKey }); // backend reads the ORIGINAL pdf
  });

  it("reports a processing failure with a retryable error and keeps the upload for a retry", async () => {
    const up = await (await uploadPdf(uploadReq(pdf))).json();
    http.post.mockRejectedValueOnce(Object.assign(new Error("down"), { code: "ECONNREFUSED" }));
    const res = await processPdf(post("/api/uploadpdf/process", { documentId: up.documentId }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ retryable: true, stage: "process" });
    expect(body.message).toMatch(/unreachable/);
    const doc: any = await Document.findById(up.documentId).lean();
    expect(doc.status).toBe("failed");
    expect(doc.sourceKey).toBeTruthy();
  });

  it("another student can't process someone else's document", async () => {
    const up = await (await uploadPdf(uploadReq(pdf, STUDENT_A))).json();
    const res = await processPdf(post("/api/uploadpdf/process", { documentId: up.documentId }, { uid: STUDENT_B }));
    expect(res.status).toBe(403);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("the upload UI copy and the server limit agree", () => {
    for (const page of ["src/app/pdfNotesExtractor/page.tsx", "src/app/quizgenerator/page.tsx"]) {
      const src = readFileSync(path.join(process.cwd(), page), "utf8");
      expect(src).not.toMatch(/100\s?MB/i);
    }
    expect(readFileSync(path.join(process.cwd(), "src/app/pdfNotesExtractor/page.tsx"), "utf8")).toContain("MAX_PDF_BYTES");
    expect(MAX_PDF_BYTES).toBe(4 * 1024 * 1024);
    expect(readFileSync(path.join(process.cwd(), "src/app/quizgenerator/page.tsx"), "utf8")).toContain("MAX_PDF_BYTES");
  });
});

describe("add to calendar: preview first, write only on confirmation (mocked Graph)", () => {
  const event = { subject: "Project review", date: "2026-11-28", startTime: "15:00", endTime: "16:00", location: "Room 204" };

  it("the draft endpoint proposes an event without writing anything", async () => {
    const res = await draftEvent(post("/api/calender/draft", { subject: "Review", events: "Friday 3pm Room 204", today: "2026-11-22" }));
    const body = await res.json();
    expect(body.draft).toMatchObject({ date: "2026-11-28", startTime: "15:00" });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("refuses to write without explicit confirmation", async () => {
    const res = await createEvent(post("/api/calender", { event }, { headers: { cookie: MS_COOKIE } }));
    expect(res.status).toBe(400);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("refuses incomplete or invalid events even when confirmed", async () => {
    for (const bad of [{ ...event, date: "" }, { ...event, endTime: "14:00" }, { ...event, subject: " " }, { ...event, startTime: "25:00" }]) {
      const res = await createEvent(post("/api/calender", { confirmed: true, event: bad, timeZone: "Asia/Kolkata" }, { headers: { cookie: MS_COOKIE } }));
      expect(res.status).toBe(400);
    }
    expect(http.post).not.toHaveBeenCalled();
  });

  it("requires a connected Outlook account", async () => {
    const res = await createEvent(post("/api/calender", { confirmed: true, event, timeZone: "UTC" }));
    expect(res.status).toBe(401);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("writes exactly one event after confirmation", async () => {
    http.post.mockResolvedValueOnce({ data: { id: "evt-1", webLink: "https://outlook.example/evt-1" } });
    const res = await createEvent(post("/api/calender", { confirmed: true, event, timeZone: "Asia/Kolkata" }, { headers: { cookie: MS_COOKIE } }));
    expect(res.status).toBe(201);
    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body, opts] = http.post.mock.calls[0];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/events");
    expect(body).toMatchObject({
      subject: "Project review",
      start: { dateTime: "2026-11-28T15:00:00", timeZone: "Asia/Kolkata" },
      end: { dateTime: "2026-11-28T16:00:00", timeZone: "Asia/Kolkata" },
      location: { displayName: "Room 204" },
    });
    expect(opts.headers.Authorization).toBe("Bearer fake-ms-token");
  });

  it("explains a missing calendar write permission instead of failing silently", async () => {
    http.post.mockRejectedValueOnce({ response: { status: 403, data: { error: { code: "ErrorAccessDenied" } } } });
    const res = await createEvent(post("/api/calender", { confirmed: true, event, timeZone: "UTC" }, { headers: { cookie: MS_COOKIE } }));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/Calendars\.ReadWrite/);
  });
});
