import { NextRequest, NextResponse } from "next/server";
import { getRoom, isHostTokenValid, viewRoom } from "../../engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params;
  const room = await getRoom(pin);

  if (!room) {
    return NextResponse.json({ error: "Game room not found" }, { status: 404 });
  }

  const asHost = isHostTokenValid(room, req.headers.get("x-host-token"));
  return NextResponse.json({ success: true, room: viewRoom(room, asHost), isHost: asHost }, { status: 200 });
}
