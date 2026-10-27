import { moveTask } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";
import { BoardError } from "@/lib/rules";
import type { Status } from "@/lib/types";

// { "status": "todo" | "doing" | "check" | "done" }. "done" is a check by a
// person who isn't an owner.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => {
    const body = (await json(req)) as { status?: unknown };
    if (typeof body.status !== "string") throw new BoardError(400, "Send { \"status\": \"doing\" } or similar.");
    return moveTask(store, id, body.status as Status, actor());
  })(req);
}
