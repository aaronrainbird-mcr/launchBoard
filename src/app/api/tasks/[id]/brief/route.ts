import { getTaskDetail } from "@/lib/board";
import { taskBrief } from "@/lib/brief";
import { handle, type Params } from "@/lib/http";

export const dynamic = "force-dynamic";

// The whole task as Markdown, ready to hand to an AI assistant.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(false, async ({ store, boardUrl }) => {
    const { task, comments } = await getTaskDetail(store, id);
    return new Response(taskBrief(task, comments, boardUrl), {
      headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
    });
  })(req);
}
