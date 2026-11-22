import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks: no real AI, S3 or Python backend is ever called. ---
const aiState = vi.hoisted(() => ({ reply: "" as string | Error, key: true }));
vi.mock("../src/app/api/utils/ai", () => ({
  getGroqKey: () => (aiState.key ? "test-key" : undefined),
  groqChat: vi.fn(async () => {
    if (aiState.reply instanceof Error) throw aiState.reply;
    return aiState.reply;
  }),
}));
const s3State = vi.hoisted(() => ({ fail: false, sent: [] as any[] }));
vi.mock("../src/app/api/utils/s3", () => ({
  default: {
    send: vi.fn(async (cmd: any) => {
      if (s3State.fail) throw new Error("S3 down");
      s3State.sent.push(cmd.input);
      return {};
    }),
  },
}));
const backendState = vi.hoisted(() => ({ reply: null as any, fail: false }));
vi.mock("axios", () => ({
  default: {
    post: vi.fn(async () => {
      if (backendState.fail) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
      return { data: backendState.reply };
    }),
  },
}));

import { connectDB } from "../src/app/api/utils/db";
import Quiz from "../src/app/api/lib/Quiz";
import { POST as generate } from "../src/app/api/quiz/generate/route";
import { validateQuestions } from "../src/app/api/quiz/validate";
import { MAX_PDF_BYTES } from "../src/app/api/utils/upload";
import { STUDENT_A, sessionCookie } from "./helpers";

const goodQuestion = (stem: string, key = "B") => ({
  questionText: stem,
  answers: [
    { label: "A", option: "Mitochondria" },
    { label: "B", option: "Chloroplast" },
    { label: "C", option: "Nucleus" },
    { label: "D", option: "Ribosome" },
  ],
  correctAnswer: key,
  explanation: "Photosynthesis happens in chloroplasts.",
});

const pdfBytes = () => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 32)]);

function genRequest(fields: Record<string, string>, pdf?: Buffer, uid: string | null = STUDENT_A) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (pdf) fd.append("pdf", new File([new Uint8Array(pdf)], "notes.pdf", { type: "application/pdf" }));
  const headers: Record<string, string> = {};
  if (uid) headers.cookie = sessionCookie(uid);
  return new NextRequest("http://localhost/api/quiz/generate", { method: "POST", body: fd, headers });
}

beforeAll(async () => {
  await connectDB();
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://backend.test";
});

beforeEach(async () => {
  await Quiz.deleteMany({});
  aiState.reply = "";
  aiState.key = true;
  s3State.fail = false;
  s3State.sent = [];
  backendState.fail = false;
  backendState.reply = null;
});

describe("question validation", () => {
  it("never defaults a missing answer key to A", () => {
    const { questions, dropped } = validateQuestions([{ ...goodQuestion("Where does photosynthesis occur?"), correctAnswer: undefined }]);
    expect(questions).toHaveLength(0);
    expect(dropped[0].reason).toMatch(/answer key/);
  });

  it("rejects empty stems, too few options, duplicate options and unmatched keys", () => {
    const { questions, dropped } = validateQuestions([
      { ...goodQuestion(""), questionText: "" },
      { questionText: "Pick one please", answers: [{ label: "A", option: "Only" }], correctAnswer: "A" },
      { questionText: "Duplicates here?", answers: ["Same", "same", "Other"], correctAnswer: "A" },
      { ...goodQuestion("Key letter out of range?"), correctAnswer: "F" },
      { ...goodQuestion("Numeric key is ambiguous?"), correctAnswer: "2" },
      goodQuestion("Where does photosynthesis occur?"),
    ]);
    expect(questions).toHaveLength(1);
    expect(dropped).toHaveLength(5);
  });

  it("maps keys given as option text or as the model's own labels", () => {
    const { questions } = validateQuestions([
      { questionText: "Answer given as text?", options: ["Red", "Green", "Blue"], answer: "Blue" },
      { questionText: "Labels not in order?", answers: [{ label: "C", option: "x" }, { label: "A", option: "y" }], correctAnswer: "A" },
    ]);
    expect(questions[0].correctAnswer).toBe("C");
    expect(questions[1].correctAnswer).toBe("B"); // model's "A" is the 2nd option
  });
});

describe("quiz generation never silently degrades", () => {
  it("requires sign-in", async () => {
    const res = await generate(genRequest({ prompt: "Cells" }, undefined, null));
    expect(res.status).toBe(401);
  });

  it("reports a document failure instead of quietly switching to a topic-only quiz", async () => {
    backendState.fail = true;
    aiState.reply = JSON.stringify({ questions: [goodQuestion("Topic question one?")] });
    const res = await generate(genRequest({ prompt: "Photosynthesis" }, pdfBytes()));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ code: "DOCUMENT_QUIZ_FAILED", fallbackAvailable: true, retryable: true });
    expect(await Quiz.countDocuments()).toBe(0);
  });

  it("labels an opted-in topic fallback as a fallback, never as document-based", async () => {
    backendState.fail = true;
    aiState.reply = JSON.stringify({ questions: [goodQuestion("Topic question one?"), goodQuestion("Topic question two?", "A")] });
    const res = await generate(genRequest({ prompt: "Photosynthesis", allowTopicFallback: "true" }, pdfBytes()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.quiz.source).toBe("topic_fallback");
    expect(body.quiz.sourceNote).toMatch(/not on your document/);
    const saved: any = await Quiz.findById(body.quiz._id).lean();
    expect(saved.source).toBe("topic_fallback");
  });

  it("marks a successful PDF quiz as document-based", async () => {
    backendState.reply = { questions: { questions: [goodQuestion("From the PDF: where does photosynthesis occur?")] } };
    const res = await generate(genRequest({ prompt: "Photosynthesis", count: "5", difficulty: "hard" }, pdfBytes()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.quiz.source).toBe("document");
  });

  it("does not create a placeholder quiz when the AI fails or returns nothing usable", async () => {
    aiState.reply = new Error("AI down");
    let res = await generate(genRequest({ prompt: "Cells" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("AI_FAILED");

    aiState.reply = JSON.stringify({ questions: [{ questionText: "No key here?", answers: ["a", "b"] }] });
    res = await generate(genRequest({ prompt: "Cells" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("NO_VALID_QUESTIONS");
    expect(await Quiz.countDocuments()).toBe(0);
  });

  it("reports an S3 failure instead of continuing without the PDF", async () => {
    s3State.fail = true;
    const res = await generate(genRequest({ prompt: "Cells" }, pdfBytes()));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("UPLOAD_FAILED");
  });

  it("keeps the answer key out of the response and saves only validated questions", async () => {
    aiState.reply = JSON.stringify({ questions: [goodQuestion("Valid question one?"), { questionText: "Broken?", answers: ["x", "y"] }] });
    const res = await generate(genRequest({ prompt: "Cells", count: "3" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("correctAnswer");
    expect(body.dropped).toBe(1);
    const saved: any = await Quiz.findById(body.quiz._id).lean();
    expect(saved.questions).toHaveLength(1);
    expect(saved.ownerId).toBe(STUDENT_A);
  });

  it("rejects an over-limit PDF with a clear message that matches the 4 MB limit", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(MAX_PDF_BYTES + 1)]);
    const res = await generate(genRequest({ prompt: "Cells" }, big));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toBe("PDF is too large (max 4 MB).");
    expect(s3State.sent).toHaveLength(0);
  });
});
