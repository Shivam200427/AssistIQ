import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import Document from "../../lib/Document";
import { connectDB } from "../../utils/db";
import { getSession } from "../../utils/session";
import { DocError, loadAccessibleDocument, notesLinkFor } from "../../utils/documents";

// Reading pages, indexing and writing notes can take a few minutes on the Python backend.
export const maxDuration = 300;

/** Step 2 of 2: read the stored PDF's pages, build the search index and write cited notes. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  try {
    const { documentId } = await req.json().catch(() => ({}));
    await connectDB();
    const doc = await loadAccessibleDocument(documentId, session);
    if (!doc.sourceKey) throw new DocError(409, "This document has no stored PDF to process.");

    await Document.updateOne({ _id: doc._id }, { $set: { status: "processing", failure: "" } });
    let result: any;
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload_pdf`, { key: doc.sourceKey }, { timeout: 290000 });
      result = res.data?.pdflink;
      if (!result?.notes_key || !result?.vectorstore) throw new Error("Backend returned an incomplete result");
    } catch (e: any) {
      const backendMessage = e?.response?.data?.error;
      const message =
        backendMessage ||
        (e?.code === "ECONNABORTED"
          ? "Processing took too long. Please try again."
          : e?.response
            ? "The document service couldn't process this PDF."
            : "The document service is unreachable — it may be waking up. Try again in a minute.");
      await Document.updateOne({ _id: doc._id }, { $set: { status: "failed", failure: message } });
      return NextResponse.json({ message, stage: e?.response?.data?.stage || "process", retryable: true }, { status: 502 });
    }

    const updated: any = await Document.findOneAndUpdate(
      { _id: doc._id },
      {
        $set: {
          status: "ready",
          notesKey: result.notes_key,
          persist_dir: result.vectorstore,
          notesStatus: result.notes_status || null,
          pages: result.pages ?? null,
        },
      },
      { new: true }
    ).lean();
    const link = await notesLinkFor(updated);
    return NextResponse.json(
      { documentId: String(doc._id), persist: result.vectorstore, notesStatus: result.notes_status, pages: result.pages, link: link.url },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof DocError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error("PDF process error:", err?.message);
    return NextResponse.json({ message: "Processing failed. Please try again.", stage: "process", retryable: true }, { status: 500 });
  }
}
