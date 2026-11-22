import { NextRequest, NextResponse } from "next/server";
import {
  joinPlayer,
  submitAnswer,
  startGame,
  endQuestion,
  showLeaderboard,
  nextQuestion,
  updateQuestions,
  getRoom,
  isHostTokenValid,
  viewRoom,
} from "../../engine";

export const dynamic = "force-dynamic";

const HOST_ACTIONS = new Set(["START_GAME", "END_QUESTION", "SHOW_LEADERBOARD", "NEXT_QUESTION", "UPDATE_QUESTIONS"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  try {
    const { pin } = await params;
    const body = await req.json();
    const { action } = body;

    const room = await getRoom(pin);
    if (!room) {
      return NextResponse.json({ error: "Game room not found" }, { status: 404 });
    }

    const asHost = isHostTokenValid(room, req.headers.get("x-host-token") || body.hostToken);
    if (HOST_ACTIONS.has(action) && !asHost) {
      return NextResponse.json({ error: "Only the host can perform this action" }, { status: 403 });
    }

    let updatedRoom = null;

    switch (action) {
      case "JOIN": {
        const { id, nickname, avatar } = body;
        if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
          return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
        }
        const joined = await joinPlayer(pin, {
          id: typeof id === "string" ? id : undefined,
          nickname,
          avatar: typeof avatar === "string" ? avatar : "⚡",
          token: req.headers.get("x-player-token") || (typeof body.playerToken === "string" ? body.playerToken : undefined),
        });
        if (!joined.ok) return NextResponse.json({ error: joined.error }, { status: joined.status });
        // The private token is returned only here, only to the joining player.
        return NextResponse.json(
          { success: true, room: viewRoom(joined.room, asHost), playerId: joined.playerId, playerToken: joined.playerToken },
          { status: 200 }
        );
      }

      case "SUBMIT_ANSWER": {
        const { playerId, chosenOption } = body;
        if (typeof playerId !== "string" || typeof chosenOption !== "string" || !playerId || !chosenOption) {
          return NextResponse.json({ error: "Missing answer parameters" }, { status: 400 });
        }
        const token = req.headers.get("x-player-token") || (typeof body.playerToken === "string" ? body.playerToken : "");
        const res = await submitAnswer(pin, playerId, chosenOption, token);
        if (res.forbidden) {
          return NextResponse.json({ success: false, error: "This answer can't be accepted for that player." }, { status: 403 });
        }
        return NextResponse.json({
          success: res.success,
          room: viewRoom(res.room, asHost),
          answerResult: res.answerResult,
        });
      }

      case "START_GAME": {
        updatedRoom = await startGame(pin);
        break;
      }

      case "END_QUESTION": {
        updatedRoom = await endQuestion(pin);
        break;
      }

      case "SHOW_LEADERBOARD": {
        updatedRoom = await showLeaderboard(pin);
        break;
      }

      case "NEXT_QUESTION": {
        updatedRoom = await nextQuestion(pin);
        break;
      }

      case "UPDATE_QUESTIONS": {
        const { questions } = body;
        if (!Array.isArray(questions) || questions.length === 0) {
          return NextResponse.json({ error: "Questions array is required" }, { status: 400 });
        }
        updatedRoom = await updateQuestions(pin, questions);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    if (!updatedRoom) {
      return NextResponse.json(
        { success: false, room: viewRoom(await getRoom(pin), asHost), error: "Action could not be completed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, room: viewRoom(updatedRoom, asHost) }, { status: 200 });
  } catch (err: any) {
    console.error("[LiveQuiz Action] Error:", err.message);
    return NextResponse.json({ error: "Live quiz action failed" }, { status: 500 });
  }
}
