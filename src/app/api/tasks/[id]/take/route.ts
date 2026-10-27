import { takeTask } from "@/lib/board";
import { handle, type Params } from "@/lib/http";

// Makes you an owner and moves the task to In progress.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, ({ store, actor }) => takeTask(store, id, actor()))(req);
}
