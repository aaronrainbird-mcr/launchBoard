import { getTaskDetail, updateTask } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(false, ({ store }) => getTaskDetail(store, id))(req);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => updateTask(store, id, await json(req), actor()))(req);
}
