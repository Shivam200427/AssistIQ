import mongoose from "mongoose";

/**
 * An uploaded PDF and what was built from it.
 * Links to files are never stored as the source of truth (S3 links expire); the S3 keys are stored
 * and a fresh, short-lived link is generated whenever a student opens the notes.
 */
const DocumentSchema = new mongoose.Schema(
  {
    userID: { type: String, required: true }, // legacy label ("demo")
    ownerId: { type: String, default: null, index: true }, // signed-in uploader ("ms:<id>"), null if uploaded signed-out
    title: { type: String, default: "" },
    sourceKey: { type: String, default: null }, // original PDF in S3
    notesKey: { type: String, default: null }, // generated notes PDF in S3
    persist_dir: { type: String }, // vector index id
    notesStatus: { type: String, enum: ["ai", "extracted_text", null], default: null },
    pages: { type: Number, default: null },
    status: { type: String, enum: ["uploaded", "processing", "ready", "failed"], default: "ready" },
    failure: { type: String, default: "" },
    pdf_link: { type: String }, // legacy: expiring presigned link stored by older versions
  },
  { timestamps: true }
);

const Document = mongoose.models.Document || mongoose.model("Document", DocumentSchema);
export default Document;
