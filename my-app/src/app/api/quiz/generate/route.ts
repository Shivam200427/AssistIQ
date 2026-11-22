import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../utils/db";
import s3 from '../../utils/s3'
import Quiz from "../../lib/Quiz";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { getRemoteBackendUrl, groqChat, getGroqKey } from "../../utils/ai";
import { safeKeySegment, validatePdf } from "../../utils/upload";

export const maxDuration = 300;

function extractQuestions(raw: any): any[] {
    if (!raw) return [];
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            const match = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    raw = JSON.parse(match[0]);
                } catch (e2) {}
            }
        }
    }
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object" && raw !== null) {
        if (Array.isArray(raw.questions)) return raw.questions;
        if (Array.isArray(raw.data)) return raw.data;
        for (const key of Object.keys(raw)) {
            if (Array.isArray(raw[key])) return raw[key];
            if (typeof raw[key] === "object" && raw[key] !== null) {
                const nested = extractQuestions(raw[key]);
                if (nested.length > 0) return nested;
            }
        }
    }
    return [];
}

function normalizeQuestions(rawList: any[]): any[] {
    return rawList.map((item, idx) => {
        if (!item || typeof item !== "object") return null;

        const questionText = item.questionText || item.question || item.title || `Question ${idx + 1}`;
        const rawAnswers = item.answers || item.options || item.choices || [];

        let answers: { label: string; option: string }[] = [];
        if (Array.isArray(rawAnswers)) {
            answers = rawAnswers.map((ans, aIdx) => {
                const defaultLabel = String.fromCharCode(65 + aIdx);
                if (typeof ans === "string") {
                    const match = ans.match(/^([A-D])[.\):\-]\s*(.*)$/i);
                    if (match) {
                        return { label: match[1].toUpperCase(), option: match[2] || ans };
                    }
                    return { label: defaultLabel, option: ans };
                } else if (typeof ans === "object" && ans !== null) {
                    return {
                        label: ans.label || ans.key || defaultLabel,
                        option: ans.option || ans.text || ans.value || String(ans),
                    };
                }
                return { label: defaultLabel, option: String(ans) };
            });
        }

        return {
            questionText,
            answers,
            correctAnswer: item.correctAnswer || item.answer || "A",
            choosenAnswer: "",
            explanation: item.explanation || "",
        };
    }).filter(Boolean);
}

export async function POST(req: NextRequest) {
    try {
        const formdata = await req.formData();
        const userID = safeKeySegment(formdata.get("userID"), "demo");
        const prompt = String(formdata.get("prompt") || "").trim().slice(0, 500) || "General Knowledge";
        const pdfEntry = formdata.get("pdf");
        const pdf = pdfEntry instanceof File ? pdfEntry : null;

        let buffer = null;
        let key = null;
        let bucket = process.env.AWS_S3_BUCKET || "edumatebucket01";

        if (pdf != null) {
            buffer = Buffer.from(await pdf.arrayBuffer());
            const invalid = validatePdf(pdf, buffer);
            if (invalid) {
                return NextResponse.json({ message: invalid }, { status: 400 });
            }
            key = `pdf/${userID}/${Date.now()}/-${safeKeySegment(pdf.name, "document.pdf")}`;

            try {
                await s3.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: buffer!,
                    ContentType: "application/pdf",
                }));
            } catch (s3Err) {
                console.warn("S3 upload warning:", s3Err);
            }
        }

        await connectDB();

        let ques: any[] = [];
        const backendUrl = getRemoteBackendUrl();

        // 1. Try Python backend if it is deployed remotely
        if (backendUrl) {
            try {
                const bakendres = await axios.post(
                    `${backendUrl}/generate_questions`,
                    { prompt, key },
                    // PDF quizzes need the backend to read the document; topic-only quizzes can fall back to Groq quickly.
                    { timeout: key ? 240000 : 20000 }
                );
                const rawList = extractQuestions(bakendres.data?.questions);
                ques = normalizeQuestions(rawList);
            } catch (bErr: any) {
                console.log("Python backend unavailable for quiz generation, falling back to direct Groq:", bErr?.message);
            }
        }

        // 2. Direct Groq AI Generation fallback
        if (ques.length === 0) {
            if (getGroqKey()) {
                const aiPrompt = `You are an expert quiz generator. Generate 5 challenging multiple-choice questions for: "${prompt}".
Respond with valid JSON containing a "questions" array in this exact schema:
{
  "questions": [
    {
      "questionText": "What is ...?",
      "answers": [
        { "label": "A", "option": "Option A text" },
        { "label": "B", "option": "Option B text" },
        { "label": "C", "option": "Option C text" },
        { "label": "D", "option": "Option D text" }
      ],
      "correctAnswer": "A",
      "explanation": "Brief explanation why A is correct"
    }
  ]
}`;

                const content = await groqChat(aiPrompt, { temperature: 0.4, json: true, timeout: 20000 });
                const parsed = JSON.parse(content || "{}");
                const rawList = extractQuestions(parsed);
                ques = normalizeQuestions(rawList);
            }
        }

        if (ques.length === 0) {
            // Default fallback if AI response was empty
            ques = [
                {
                    questionText: `What is the primary topic of: "${prompt}"?`,
                    answers: [
                        { label: "A", option: "Core Fundamentals & Theory" },
                        { label: "B", option: "Applied Practical Execution" },
                        { label: "C", option: "Advanced Research Concepts" },
                        { label: "D", option: "Historical Evolution" }
                    ],
                    correctAnswer: "A",
                    choosenAnswer: "",
                    explanation: "Fundamental knowledge is the foundation of the subject."
                }
            ];
        }

        console.log("Successfully prepared questions count:", ques.length);

        const quiz = await Quiz.create({
            userId: userID,
            title: prompt || "AssistIQ Live Arena Quiz",
            s3PdfKey: key,
            questions: ques,
        });

        return NextResponse.json({ message: "done", "quiz": quiz }, { status: 200 });

    } catch (err: any) {
        console.error("Quiz generate error:", err?.message);
        return NextResponse.json({ "message": "Quiz generation failed." }, { status: 500 });
    }
}
