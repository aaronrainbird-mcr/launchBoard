import { addTaskLink, removeTaskLink } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";
import { BoardError } from "@/lib/rules";

// { "kind": "pr" | "preview" | "design" | "doc" | "other", "url": "https://…", "label": "optional" }
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => addTaskLink(store, id, await json(req), actor()))(req);
}

// DELETE /api/tasks/:id/links?link=<link id>
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => {
    const link = new URL(req.url).searchParams.get("link");
    if (!link) throw new BoardError(400, "Add ?link=<link id>.");
    return removeTaskLink(store, id, link, actor());
  })(req);
}
