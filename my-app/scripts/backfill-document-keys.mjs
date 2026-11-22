/**
 * Migration: documents saved before keys were stored only have an expiring presigned link (pdf_link).
 * This copies the S3 key out of that link into notesKey, so a fresh link can be generated on demand.
 * The old pdf_link field is left untouched.
 *
 * - Back up first:  mongodump --uri "$MONGO_URL" --out <folder outside the repo>
 * - Dry run:        node scripts/backfill-document-keys.mjs --dry-run
 * - Apply:          node scripts/backfill-document-keys.mjs
 */
import { MongoClient } from "mongodb";

export function keyFromLegacyLink(link) {
  if (!link) return null;
  try {
    const key = decodeURIComponent(new URL(link).pathname.replace(/^\/+/, ""));
    return /^(pdfs|pdf)\/[\w\-./]+\.pdf$/i.test(key) && !key.includes("..") ? key : null;
  } catch {
    return null;
  }
}

export async function backfillDocumentKeys(db, { dryRun = false, log = console.log } = {}) {
  const docs = db.collection("documents");
  const report = { candidates: 0, updated: 0, unrecoverable: 0 };
  for await (const doc of docs.find({ notesKey: { $in: [null, undefined] }, pdf_link: { $type: "string" } })) {
    report.candidates++;
    const key = keyFromLegacyLink(doc.pdf_link);
    if (!key) {
      report.unrecoverable++;
      log(`document ${doc._id}: no key could be recovered from its link`);
      continue;
    }
    if (!dryRun) {
      await docs.updateOne({ _id: doc._id, notesKey: { $in: [null, undefined] } }, { $set: { notesKey: key, status: doc.status || "ready" } });
    }
    report.updated++;
    log(`${dryRun ? "[dry run] " : ""}document ${doc._id}: notesKey = ${key}`);
  }
  return report;
}

if (process.argv[1]?.endsWith("backfill-document-keys.mjs")) {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error("Set MONGO_URL first.");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    console.log(JSON.stringify(await backfillDocumentKeys(client.db(), { dryRun: process.argv.includes("--dry-run") }), null, 2));
  } finally {
    await client.close();
  }
}
