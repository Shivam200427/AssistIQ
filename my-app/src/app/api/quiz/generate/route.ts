import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { connectDB } from "../../utils/db";
import s3 from "../../utils/s3";
import Quiz from "../../lib/Quiz";
import { getGroqKey, groqChat } from "../../utils/ai";
import { safeKeySegment, validatePdf } from "../../utils/upload";
import { getSession } from "../../utils/session";
import { extractQuestionList, validateQuestions } from "../validate";
import { DocError, loadAccessibleDocument } from "../../utils/documents";

export const maxDuration = 300;

const DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

/** Every failure is reported explicitly — the route never silently swaps in different content. */
function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, message, ...extra }, { status });
}

async function topicQuestions(topic: string, count: number, difficulty: Difficulty) {
  if (!getGroqKey()) throw Object.assign(new Error("AI is not configured on the server."), { code: "AI_UNAVAILABLE" });
  const aiPrompt = `You are an expert quiz writer. Write ${count} multiple-choice questions about: "${topic}".
Difficulty: ${difficulty === "mixed" ? "a mix of easy, medium and hard" : difficulty}.
Each question must have exactly 4 distinct options and exactly one correct answer.
Respond with JSON only:
{"questions":[{"questionText":"...","answers":[{"label":"A","option":"..."},{"label":"B","option":"..."},{"label":"C","option":"..."},{"label":"D","option":"..."}],"correctAnswer":"A|B|C|D","explanation":"one sentence","topic":"2-4 word concept this question tests"}]}`;
  const content = await groqChat(aiPrompt, { temperature: 0.4, json: true, timeout: 30000 });
  return extractQuestionList(content);
}

async function documentQuestions(key: string, topic: string, count: number, difficulty: Difficulty) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) throw Object.assign(new Error("The document service is not configured."), { code: "BACKEND_UNAVAILABLE" });
  const res = await axios.post(
    `${backendUrl}/generate_questions`,
    { prompt: topic, key, count, difficulty },
    { timeout: 240000 }
  );
  return extractQuestionList(res.data?.questions);
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return fail(401, "SIGN_IN_REQUIRED", "Sign in with Microsoft to create and save quizzes.");

  let stage = "read_request";
  try {
    const form = await req.formData();
    const topic = String(form.get("prompt") || "").trim().slice(0, 500);
    const count = Math.min(Math.max(Math.round(Number(form.get("count")) || 5), 3), 20);
    const difficultyRaw = String(form.get("difficulty") || "mixed");
    const difficulty: Difficulty = (DIFFICULTIES as readonly string[]).includes(difficultyRaw) ? (difficultyRaw as Difficulty) : "mixed";
    const allowTopicFallback = form.get("allowTopicFallback") === "true";
    const pdfEntry = form.get("pdf");
    const pdf = pdfEntry instanceof File ? pdfEntry : null;
    const documentId = form.get("documentId");

    if (!pdf && !topic && !documentId) return fail(400, "MISSING_INPUT", "Enter a topic or attach a PDF.");

    let source: "document" | "topic" | "topic_fallback" = pdf || documentId ? "document" : "topic";
    let sourceNote = "";
    let key: string | null = null;
    let rawList: any[] = [];

    if (documentId && !pdf) {
      // Quiz from a PDF already uploaded to PDF Notes: use its stored original file.
      stage = "load_document";
      await connectDB();
      let doc: any;
      try {
        doc = await loadAccessibleDocument(String(documentId), session);
      } catch (e: any) {
        if (e instanceof DocError) return fail(e.status, "DOCUMENT_UNAVAILABLE", e.message);
        throw e;
      }
      if (!doc.sourceKey) {
        return fail(409, "DOCUMENT_HAS_NO_SOURCE", "This PDF was uploaded before quizzes could use it. Re-upload it to make a quiz from the document.");
      }
      key = doc.sourceKey;
      stage = "document_questions";
      try {
        rawList = await documentQuestions(doc.sourceKey, topic || "the key ideas in this document", count, difficulty);
      } catch (e: any) {
        console.error("Document quiz generation failed:", e?.code || e?.message);
        if (!allowTopicFallback || !topic) {
          return fail(502, "DOCUMENT_QUIZ_FAILED", "We couldn't read your PDF to write questions from it, so no quiz was made.", {
            stage,
            retryable: true,
            fallbackAvailable: !!topic,
          });
        }
        source = "topic_fallback";
        sourceNote = "Your PDF couldn't be read, so these questions are based on the topic only — not on your document.";
      }
    }

    if (pdf) {
      stage = "upload";
      const buffer = Buffer.from(await pdf.arrayBuffer());
      const invalid = validatePdf(pdf, buffer);
      if (invalid) return fail(400, "INVALID_PDF", invalid);
      key = `pdf/${safeKeySegment(session.uid, "student")}/${Date.now()}/-${safeKeySegment(pdf.name, "document.pdf")}`;
      try {
        await s3.send(new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: buffer, ContentType: "application/pdf" }));
      } catch (e: any) {
        console.error("Quiz PDF upload failed:", e?.message);
        return fail(502, "UPLOAD_FAILED", "Your PDF couldn't be stored, so no quiz was made. Please try again.", { stage, retryable: true });
      }

      stage = "document_questions";
      try {
        rawList = await documentQuestions(key, topic || "the key ideas in this document", count, difficulty);
      } catch (e: any) {
        console.error("Document quiz generation failed:", e?.code || e?.message);
        if (!allowTopicFallback || !topic) {
          // Tell the student plainly; offer the fallback instead of silently switching to it.
          return fail(502, "DOCUMENT_QUIZ_FAILED", "We couldn't read your PDF to write questions from it, so no quiz was made.", {
            stage,
            retryable: true,
            fallbackAvailable: !!topic,
          });
        }
        source = "topic_fallback";
        sourceNote = "Your PDF couldn't be read, so these questions are based on the topic only — not on your document.";
      }
    }

    if (source !== "document") {
      stage = "topic_questions";
      try {
        rawList = await topicQuestions(topic, count, difficulty);
      } catch (e: any) {
        console.error("Topic quiz generation failed:", e?.message);
        return fail(502, "AI_FAILED", "The AI service didn't respond, so no quiz was made. Please try again.", { stage, retryable: true });
      }
    }

    stage = "validate";
    const { questions, dropped } = validateQuestions(rawList, count);
    if (questions.length === 0) {
      return fail(502, "NO_VALID_QUESTIONS", "The AI didn't return any usable questions (each needs a question, options and a real answer key). Please try again.", {
        stage,
        retryable: true,
        dropped: dropped.length,
      });
    }

    stage = "save";
    await connectDB();
    const quiz = await Quiz.create({
      userId: safeKeySegment(session.uid, "student"),
      ownerId: session.uid,
      title: topic || pdf?.name?.replace(/\.pdf$/i, "") || "Quiz",
      s3PdfKey: key,
      source,
      sourceNote,
      documentId: documentId && !pdf ? String(documentId) : null,
      questions: questions.map((q) => ({ ...q, topic: q.topic || topic.slice(0, 60) || "General" })),
    });

    return NextResponse.json(
      {
        message: "done",
        quiz: { _id: String(quiz._id), title: quiz.title, source, sourceNote, questionCount: questions.length },
        requested: count,
        dropped: dropped.length,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`Quiz generate error at ${stage}:`, err?.message);
    return fail(500, "UNEXPECTED", "Something went wrong while making your quiz. Please try again.", { stage, retryable: true });
  }
}
