import { checkTask } from "@/lib/board";
import { handle, type Params } from "@/lib/http";

// "I've checked it: mark as done". People only, and not an owner.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, ({ store, actor }) => checkTask(store, id, actor()))(req);
}
