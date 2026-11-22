import { NextRequest } from "next/server";
import { getRoom, isHostTokenValid, normalizePin, subscribeClient, unsubscribeClient } from "../../engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params;
  const normalizedPin = normalizePin(pin);

  const room = await getRoom(normalizedPin);
  if (!room) {
    return new Response("Game room not found", { status: 404 });
  }
  // EventSource cannot send headers, so the host token comes as a query parameter.
  const asHost = isHostTokenValid(room, req.nextUrl.searchParams.get("hostToken"));

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let streamController: ReadableStreamDefaultController | null = null;

  const cleanup = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    if (streamController) unsubscribeClient(normalizedPin, streamController);
  };

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      subscribeClient(normalizedPin, controller, asHost);

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: CONNECTED\ndata: ${JSON.stringify({ pin: normalizedPin, timestamp: Date.now() })}\n\n`));

      // Keepalive ping every 15s
      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch (e) {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  // Handle client abort/close
  req.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
