import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../utils/s3";
import axios from "axios";
import Document from "../lib/Document";
import { NextResponse } from "next/server";
import { connectDB } from "../utils/db";
import { safeKeySegment, validatePdf } from "../utils/upload";

// Building notes + a vector store on the Python backend can take a few minutes.
export const maxDuration = 300;

function extractPdfPayload(payload: any) {
    const rawPayload = payload?.pdflink ?? payload;
    const normalized = Array.isArray(rawPayload) ? rawPayload[0] : rawPayload;

    if (normalized?.pdf_url && normalized?.vectorstore) {
        return normalized as { pdf_url: string; vectorstore: string };
    }

    return null;
}

function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: Request) {
    try {
        const formdata = await req.formData();
        const userID = safeKeySegment(formdata.get("userID"), "demo");
        const file = formdata.get('pdf');
        if (!(file instanceof File)) {
            return NextResponse.json({ message: "No PDF file was uploaded." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const invalid = validatePdf(file, buffer);
        if (invalid) {
            return NextResponse.json({ message: invalid }, { status: 400 });
        }
        await connectDB();

        const key = `pdf/uplaod_pdf/${userID}/${Date.now()}/${safeKeySegment(file.name, "document.pdf")}`;
        const bucket = process.env.AWS_S3_BUCKET;

        await s3.send(new PutObjectCommand({
            Key: key,
            Bucket: bucket,
            Body: buffer,
            ContentType: "application/pdf"
        }));

        const res = await axios.post(process.env.NEXT_PUBLIC_BACKEND_URL + "/upload_pdf", { key, userID }, { timeout: 290000 });
        const response = extractPdfPayload(res.data);
        if (!response) {
            throw new Error("Backend did not return a valid PDF notes payload.");
        }
        const pdf_url = response.pdf_url;
        const persist_dir = response.vectorstore;

        await Document.create({
            userID,
            pdf_link: pdf_url,
            persist_dir: persist_dir,
        });

        return NextResponse.json({ link: pdf_url, persist: persist_dir }, { status: 200 });

    } catch (err: any) {
        console.error("PDF upload error:", err?.response?.data || err?.message);
        return NextResponse.json({ message: "PDF upload failed. Please try again." }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const pdfurl = searchParams.get("pdfurl");
        if (!pdfurl || pdfurl.length > 4096) {
            return NextResponse.json({ message: "Missing pdfurl" }, { status: 400 });
        }

        const exactDoc = await Document.findOne({ pdf_link: pdfurl });
        if (exactDoc?.persist_dir) {
            return NextResponse.json({ persist: exactDoc.persist_dir }, { status: 200 });
        }

        const cleanUrl = pdfurl.split("?")[0];
        const match = cleanUrl.match(/(?:pdfs\/|uploadfiles\/|pdf\/uplaod_pdf\/[^/]+\/[^/]+\/)([^/?#]+)/i);
        const filename = match ? match[1] : cleanUrl.split("/").pop();

        if (filename) {
            const doc = await Document.findOne({
                pdf_link: { $regex: escapeRegex(filename), $options: "i" }
            }).sort({ createdAt: -1 });

            if (doc?.persist_dir) {
                return NextResponse.json({ persist: doc.persist_dir }, { status: 200 });
            }
        }

        return NextResponse.json({ message: "Document not found" }, { status: 404 });
    } catch (err: any) {
        console.error("Document fetch error:", err?.message);
        return NextResponse.json({ message: "Could not look up document" }, { status: 500 });
    }
}
