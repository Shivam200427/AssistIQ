import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import s3 from "../utils/s3";
import Document from "../lib/Document";
import { connectDB } from "../utils/db";
import { safeKeySegment, validatePdf } from "../utils/upload";
import { getSession } from "../utils/session";

/**
 * Step 1 of 2: store the uploaded PDF and create its document record.
 * Step 2 (/api/uploadpdf/process) reads the pages, builds the index and writes the notes.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    const formdata = await req.formData();
    const file = formdata.get("pdf");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No PDF file was uploaded.", stage: "upload" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const invalid = validatePdf(file, buffer);
    if (invalid) {
      return NextResponse.json({ message: invalid, stage: "upload" }, { status: 400 });
    }

    const owner = session?.uid || null;
    const key = `pdf/uplaod_pdf/${safeKeySegment(owner || "guest", "guest")}/${Date.now()}/${safeKeySegment(file.name, "document.pdf")}`;
    try {
      await s3.send(new PutObjectCommand({ Key: key, Bucket: process.env.AWS_S3_BUCKET, Body: buffer, ContentType: "application/pdf" }));
    } catch (e: any) {
      console.error("PDF store failed:", e?.message);
      return NextResponse.json({ message: "Your PDF couldn't be stored. Please try again.", stage: "upload", retryable: true }, { status: 502 });
    }

    await connectDB();
    const doc = await Document.create({
      userID: safeKeySegment(owner || "guest", "guest"),
      ownerId: owner,
      title: file.name.replace(/\.pdf$/i, "").slice(0, 200),
      sourceKey: key,
      status: "uploaded",
    });
    return NextResponse.json({ documentId: String(doc._id), status: "uploaded" }, { status: 200 });
  } catch (err: any) {
    console.error("PDF upload error:", err?.message);
    return NextResponse.json({ message: "PDF upload failed. Please try again.", stage: "upload", retryable: true }, { status: 500 });
  }
}

/** Legacy lookup used by links saved before document ids existed: notes link -> vector index id. */
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const pdfurl = searchParams.get("pdfurl");
    if (!pdfurl || pdfurl.length > 4096) {
      return NextResponse.json({ message: "Missing pdfurl" }, { status: 400 });
    }
    const clean = pdfurl.split("?")[0];
    const doc: any = await Document.findOne({ $or: [{ pdf_link: pdfurl }, { pdf_link: { $regex: `^${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } }] }).lean();
    if (doc?.persist_dir && !doc.ownerId) {
      return NextResponse.json({ persist: doc.persist_dir, documentId: String(doc._id) }, { status: 200 });
    }
    return NextResponse.json({ message: "Document not found" }, { status: 404 });
  } catch (err: any) {
    console.error("Document fetch error:", err?.message);
    return NextResponse.json({ message: "Could not look up document" }, { status: 500 });
  }
}
