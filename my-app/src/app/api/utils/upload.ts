export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

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
  if (bytes.length > MAX_PDF_BYTES) return "PDF is too large (max 25 MB).";
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return "Only PDF files are supported.";
  return null;
}
