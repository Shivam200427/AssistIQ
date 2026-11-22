import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { isValidObjectId } from "mongoose";
import { createRoom, roomExists, viewRoom, LiveQuestion } from "../engine";
import Quiz from "../../lib/Quiz";
import { connectDB } from "../../utils/db";
import { getSession } from "../../utils/session";

export const dynamic = "force-dynamic";

// Generate a 6-digit numeric PIN that is not already in use
async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = randomInt(100000, 1000000).toString();
    if (!(await roomExists(pin))) return pin;
  }
  throw new Error("Could not allocate a free game PIN, please try again.");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quizId, title } = body;

    let questions: LiveQuestion[] = [];
    let gameTitle = title || "AssistIQ Live Arena";

    if (quizId) {
      if (typeof quizId !== "string" || !isValidObjectId(quizId)) {
        return NextResponse.json({ error: "Invalid quiz id" }, { status: 400 });
      }
      await connectDB();
      const quiz = await Quiz.findById(quizId);
      // Hosting reveals the answer key to the host, so only the quiz's creator may host it.
      // Legacy quizzes (no ownerId) were public before ownership existed and stay hostable.
      if (quiz?.ownerId && quiz.ownerId !== getSession(req)?.uid) {
        return NextResponse.json({ error: "Only the student who created this quiz can host it live." }, { status: 403 });
      }
      if (quiz) {
        gameTitle = quiz.title || gameTitle;
        questions = (quiz.questions || []).map((q: any, idx: number) => ({
          _id: q._id?.toString() || `q-${idx + 1}`,
          questionText: q.questionText,
          answers: (q.answers || []).map((a: any, aIdx: number) => ({
            label: a.label || String.fromCharCode(65 + aIdx),
            option: a.option || "",
          })),
          correctAnswer: (q.correctAnswer || "A").toUpperCase(),
          explanation: q.explanation || "",
          timeLimit: 15,
          points: 1000,
        }));
      }
    } else if (Array.isArray(body.questions)) {
      questions = body.questions;
    }

    if (questions.length === 0) {
      // Provide a starter set of questions if none provided
      questions = [
        {
          _id: "q-1",
          questionText: "What is 5 ^ -2?",
          answers: [
            { label: "A", option: "25" },
            { label: "B", option: "1/25" },
            { label: "C", option: "-25" },
            { label: "D", option: "5/2" },
          ],
          correctAnswer: "B",
          explanation: "5^-2 equals 1 / (5^2) = 1/25.",
          timeLimit: 15,
          points: 1000,
        },
        {
          _id: "q-2",
          questionText: "Which language is mainly used for Machine Learning?",
          answers: [
            { label: "A", option: "HTML" },
            { label: "B", option: "CSS" },
            { label: "C", option: "Python" },
            { label: "D", option: "SQL" },
          ],
          correctAnswer: "C",
          explanation: "Python dominates ML and AI frameworks.",
          timeLimit: 15,
          points: 1000,
        },
      ];
    }

    const pin = await generateUniquePin();
    const room = await createRoom({
      pin,
      quizId,
      title: String(gameTitle),
      hostId: "host",
      questions,
    });

    // The host token is only ever returned here; the host page keeps it to authorize host actions.
    return NextResponse.json(
      { success: true, pin: room.pin, hostToken: room.hostToken, room: viewRoom(room, true) },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[LiveQuiz Create] Error:", err.message);
    return NextResponse.json({ error: "Could not create live arena" }, { status: 500 });
  }
}
