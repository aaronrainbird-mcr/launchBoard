import { tickTask } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";
import { BoardError } from "@/lib/rules";

// { "index": 0, "done": true } ticks a "done means" item.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => {
    const body = (await json(req)) as { index?: unknown; done?: unknown };
    if (!Number.isInteger(body.index) || typeof body.done !== "boolean") {
      throw new BoardError(400, "Send { \"index\": 0, \"done\": true }.");
    }
    return tickTask(store, id, body.index as number, body.done, actor());
  })(req);
}
