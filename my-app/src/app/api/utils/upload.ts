// Vercel rejects request bodies over 4.5 MB before they reach the app, so the limit is 4 MB everywhere.
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_PDF_MB = MAX_PDF_BYTES / 1024 / 1024;

/** Keeps S3 keys predictable: no path separators or odd characters from user-supplied names. */
export function safeKeySegment(value: unknown, fallback: string): string {
  const cleaned = String(value ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return cleaned || fallback;
}

/** Returns an error message if the upload is not an acceptable PDF, otherwise null. */
export function validatePdf(file: File, bytes: Buffer): string | null {
  if (bytes.length === 0) return "The uploaded file is empty.";
  if (bytes.length > MAX_PDF_BYTES) return `PDF is too large (max ${MAX_PDF_MB} MB).`;
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return "Only PDF files are supported.";
  return null;
}
