import { readFile } from "node:fs/promises";
import path from "node:path";
import { boardUrl } from "@/lib/http";

export const dynamic = "force-dynamic";

// The agent guide (TASKS.md), open to anyone so an assistant can learn the
// API before it has a key. It holds no task data.
export async function GET(req: Request) {
  const text = await readFile(path.join(process.cwd(), "TASKS.md"), "utf8");
  return new Response(text.replaceAll("{{BOARD_URL}}", boardUrl(req)), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
