import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isValidObjectId } from "mongoose";
import Document from "../lib/Document";
import s3 from "./s3";
import type { Session } from "./session";

export const LINK_TTL_SECONDS = 60 * 60; // fresh links are short-lived; a new one is made on every open

export class DocError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Old documents only stored a presigned link; recover the S3 key from its path (e.g. pdfs/<uuid>.pdf). */
export function keyFromLegacyLink(link: string | undefined | null): string | null {
  if (!link) return null;
  try {
    const key = decodeURIComponent(new URL(link).pathname.replace(/^\/+/, ""));
    return /^(pdfs|pdf)\/[\w\-./]+\.pdf$/i.test(key) && !key.includes("..") ? key : null;
  } catch {
    return null;
  }
}

/**
 * Loads a document the caller may access: documents uploaded while signed in belong to that student
 * only; documents uploaded signed-out (or before accounts existed) are reachable by their id, as before.
 */
export async function loadAccessibleDocument(id: unknown, session: Session | null) {
  if (typeof id !== "string" || !isValidObjectId(id)) throw new DocError(400, "Invalid document id");
  const doc: any = await Document.findById(id).lean();
  if (!doc) throw new DocError(404, "Document not found");
  if (doc.ownerId && doc.ownerId !== session?.uid) throw new DocError(403, "This document belongs to another account.");
  return doc;
}

export async function freshLink(key: string, ttl = LINK_TTL_SECONDS) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }), { expiresIn: ttl });
}

export async function notesLinkFor(doc: any) {
  const key = doc.notesKey || keyFromLegacyLink(doc.pdf_link);
  if (!key) throw new DocError(404, "This document has no notes file yet.");
  return { url: await freshLink(key), expiresIn: LINK_TTL_SECONDS };
}
