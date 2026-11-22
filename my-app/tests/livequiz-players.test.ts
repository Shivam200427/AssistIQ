import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "../src/app/api/utils/db";
import { POST as createGame } from "../src/app/api/livequiz/create/route";
import { POST as action } from "../src/app/api/livequiz/[pin]/action/route";
import { GET as state } from "../src/app/api/livequiz/[pin]/state/route";
import { get, json, post } from "./helpers";

const ctx = (pin: string) => ({ params: Promise.resolve({ pin }) });

async function newGame() {
  const res = await json(await createGame(post("/api/livequiz/create", { title: "Token test" })));
  return { pin: res.body.pin as string, hostToken: res.body.hostToken as string };
}

async function act(pin: string, body: any, headers: Record<string, string> = {}) {
  return json(await action(post(`/api/livequiz/${pin}/action`, body, { headers }), ctx(pin)));
}

beforeAll(async () => {
  await connectDB();
});

describe("live quiz player identity", () => {
  it("issues a private token at join and never exposes it (or its hash) to others", async () => {
    const { pin, hostToken } = await newGame();
    const join = await act(pin, { action: "JOIN", nickname: "Alice" });
    expect(join.status).toBe(200);
    expect(join.body.playerId).toMatch(/^p-/);
    expect(join.body.playerToken).toMatch(/^[0-9a-f]{48}$/);

    const pub = await json(await state(get(`/api/livequiz/${pin}/state`), ctx(pin)));
    const host = await json(await state(get(`/api/livequiz/${pin}/state`, { headers: { "x-host-token": hostToken } }), ctx(pin)));
    for (const view of [pub.body, host.body]) {
      const text = JSON.stringify(view);
      expect(text).not.toContain(join.body.playerToken);
      expect(text).not.toContain("tokenHash");
    }
  });

  it("ignores a client-chosen id for new players", async () => {
    const { pin } = await newGame();
    const join = await act(pin, { action: "JOIN", id: "p-chosen-by-client", nickname: "Mallory" });
    expect(join.body.playerId).not.toBe("p-chosen-by-client");
  });

  it("rejects answering as another player without that player's token", async () => {
    const { pin, hostToken } = await newGame();
    const alice = await act(pin, { action: "JOIN", nickname: "Alice" });
    const mallory = await act(pin, { action: "JOIN", nickname: "Mallory" });
    await act(pin, { action: "START_GAME" }, { "x-host-token": hostToken });

    const noToken = await act(pin, { action: "SUBMIT_ANSWER", playerId: alice.body.playerId, chosenOption: "B" });
    expect(noToken.status).toBe(403);
    const wrongToken = await act(pin, { action: "SUBMIT_ANSWER", playerId: alice.body.playerId, chosenOption: "B", playerToken: mallory.body.playerToken });
    expect(wrongToken.status).toBe(403);

    const real = await act(pin, { action: "SUBMIT_ANSWER", playerId: alice.body.playerId, chosenOption: "B" }, { "x-player-token": alice.body.playerToken });
    expect(real.status).toBe(200);
    expect(real.body.success).toBe(true);
  });

  it("requires the token to rejoin as an existing player, including mid-game", async () => {
    const { pin, hostToken } = await newGame();
    const alice = await act(pin, { action: "JOIN", nickname: "Alice" });
    await act(pin, { action: "START_GAME" }, { "x-host-token": hostToken });

    const hijack = await act(pin, { action: "JOIN", id: alice.body.playerId, nickname: "Not Alice" });
    expect(hijack.status).toBe(403);
    const room = await json(await state(get(`/api/livequiz/${pin}/state`), ctx(pin)));
    expect(room.body.room.players.find((p: any) => p.id === alice.body.playerId).nickname).toBe("Alice");

    const rejoin = await act(pin, { action: "JOIN", id: alice.body.playerId, nickname: "Alice" }, { "x-player-token": alice.body.playerToken });
    expect(rejoin.status).toBe(200);
    expect(rejoin.body.playerId).toBe(alice.body.playerId);
    expect(rejoin.body.playerToken).toBeUndefined(); // tokens are only issued once
  });

  it("keeps host-only actions behind the host token", async () => {
    const { pin, hostToken } = await newGame();
    const alice = await act(pin, { action: "JOIN", nickname: "Alice" });
    for (const a of ["START_GAME", "END_QUESTION", "SHOW_LEADERBOARD", "NEXT_QUESTION"]) {
      expect((await act(pin, { action: a })).status).toBe(403);
      // A player's own token is not a host token.
      expect((await act(pin, { action: a }, { "x-host-token": alice.body.playerToken })).status).toBe(403);
    }
    expect((await act(pin, { action: "UPDATE_QUESTIONS", questions: [{ questionText: "x" }] })).status).toBe(403);
    expect((await act(pin, { action: "START_GAME" }, { "x-host-token": hostToken })).status).toBe(200);
  });
});
