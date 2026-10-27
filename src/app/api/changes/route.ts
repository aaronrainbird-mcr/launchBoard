import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

// Cheap check the browser polls every couple of seconds:
// GET /api/changes?after=<seq> returns the latest seq and anything newer.
export const GET = handle(false, async ({ req, store }) => {
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  const seq = await store.latestSeq();
  if (!Number.isFinite(after) || seq <= after) return { seq, activity: [] };
  return { seq, activity: await store.listActivity({ after, limit: 50 }) };
});
