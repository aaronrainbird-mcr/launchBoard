import { addTaskComment, requireTask } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(false, async ({ store }) => {
    const task = await requireTask(store, id);
    return { comments: await store.listComments(task.id) };
  })(req);
}

// { "text": "…" }. Use @Name to mention someone.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => addTaskComment(store, id, await json(req), actor()))(req);
}
