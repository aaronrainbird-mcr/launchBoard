import { addTask } from "@/lib/board";
import { handle, json } from "@/lib/http";
import { LANES, STATUSES, type Task } from "@/lib/types";

export const dynamic = "force-dynamic";

// A short line per task. Filters: status, lane, owner, when, q (search), mine=1 (with X-Board-As).
function compact(t: Task) {
  return {
    id: t.id,
    title: t.title,
    lane: t.lane,
    status: t.status,
    owners: t.owners,
    when: t.when,
    size: t.size,
    blocked: t.blocked || undefined,
    summary: t.summary,
    links: t.links.map((l) => ({ kind: l.kind, label: l.label, url: l.url })),
  };
}

export const GET = handle(false, async ({ req, store, caller }) => {
  const q = new URL(req.url).searchParams;
  let tasks = (await store.listTasks()).sort((a, b) => a.position - b.position);
  const status = q.get("status");
  if (status && (STATUSES as readonly string[]).includes(status)) tasks = tasks.filter((t) => t.status === status);
  const lane = q.get("lane");
  if (lane && (LANES as readonly string[]).includes(lane)) tasks = tasks.filter((t) => t.lane === lane);
  const when = q.get("when");
  if (when) tasks = tasks.filter((t) => t.when === when);
  const owner = q.get("owner") ?? (q.get("mine") === "1" ? caller.actor?.name : null);
  if (owner === "none") tasks = tasks.filter((t) => !t.owners.length);
  else if (owner) tasks = tasks.filter((t) => t.owners.some((o) => o.toLowerCase() === owner.toLowerCase()));
  const text = q.get("q")?.toLowerCase();
  if (text) tasks = tasks.filter((t) => `${t.id} ${t.title} ${t.summary}`.toLowerCase().includes(text));
  return { tasks: tasks.map(compact) };
});

export const POST = handle(true, async ({ req, store, actor }) => {
  const { task } = await addTask(store, await json(req), actor());
  return { task };
});
