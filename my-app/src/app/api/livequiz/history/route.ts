import { NextRequest, NextResponse } from "next/server";
import LiveGame from "../../lib/LiveGame";
import { connectDB } from "../../utils/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    // Only finished games: listing running games would leak their answer keys to players.
    const games = await LiveGame.find({ status: "FINISHED" })
      .select("-hostToken")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({ success: true, games }, { status: 200 });
  } catch (err: any) {
    console.error("[LiveQuiz History] Error:", err.message);
    return NextResponse.json({ error: "Could not load arena history" }, { status: 500 });
  }
}
