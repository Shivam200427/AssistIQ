import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../utils/db";
import { getSession } from "../../../utils/session";
import { DocError, loadAccessibleDocument, notesLinkFor } from "../../../utils/documents";

export const dynamic = "force-dynamic";

/** Returns a fresh, short-lived, authorized link to a document's notes PDF (links are never stored). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const doc = await loadAccessibleDocument(id, getSession(req));
    const link = await notesLinkFor(doc);
    return NextResponse.json(
      { url: link.url, expiresIn: link.expiresIn, persist: doc.persist_dir || null, title: doc.title || "", notesStatus: doc.notesStatus || null, status: doc.status },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (err instanceof DocError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error("Document link error:", err?.message);
    return NextResponse.json({ message: "Couldn't open this document right now." }, { status: 500 });
  }
}
