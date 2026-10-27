import { NextResponse } from "next/server";
import { identify, requireActor, type Caller } from "./auth";
import { BoardError } from "./rules";
import { store } from "./store";
import type { Store } from "./store/types";
import type { Actor } from "./types";

export type Params = { params: Promise<{ id: string }> };

interface Ctx {
  req: Request;
  store: Store;
  caller: Caller;
  actor: () => Actor;
  boardUrl: string;
}

export function boardUrl(req: Request): string {
  return (process.env.BOARD_PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, "");
}

// Wraps a route: checks who's calling, turns BoardErrors into JSON replies
// with the right status, and never leaks other errors' details.
export function handle(write: boolean, fn: (ctx: Ctx) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      const caller = identify(req, { write });
      const result = await fn({ req, store: store(), caller, actor: () => requireActor(caller), boardUrl: boardUrl(req) });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof BoardError) {
        return NextResponse.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

export async function json(req: Request): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > 200_000) throw new BoardError(413, "That request is too big.");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new BoardError(400, "The request body isn't valid JSON.");
  }
}
