// Loads board data (tasks, comments, activity) into the board's store: the
// local file by default, or Supabase when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set. Refuses to overwrite a board that
// already has tasks unless you add --replace.
//
//   node --env-file-if-exists=.env.local scripts/seed.mjs seed/launch-tasks.json [--replace] [--dry-run]

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const replace = args.includes("--replace");
const dryRun = args.includes("--dry-run");
if (!file) {
  console.error("Usage: node scripts/seed.mjs <board-data.json> [--replace] [--dry-run]");
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, "utf8"));
for (const key of ["tasks", "comments", "activity"]) {
  if (!Array.isArray(data[key])) throw new Error(`${file} has no ${key} list.`);
}
console.log(`${file}: ${data.tasks.length} tasks, ${data.comments.length} comments, ${data.activity.length} activity lines.`);

const useSupabase = process.env.BOARD_STORAGE !== "file" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!useSupabase) {
  const dir = process.env.BOARD_DATA_DIR || path.join(process.cwd(), ".local-data");
  const target = path.join(dir, "board.json");
  if (existsSync(target)) {
    const current = JSON.parse(readFileSync(target, "utf8"));
    if (current.tasks?.length && !replace) {
      console.error(`${target} already has ${current.tasks.length} tasks. Add --replace to overwrite them.`);
      process.exit(1);
    }
  }
  if (dryRun) {
    console.log(`Dry run: would write ${target}.`);
    process.exit(0);
  }
  mkdirSync(dir, { recursive: true });
  const seq = data.activity.reduce((m, a) => Math.max(m, a.seq ?? 0), 0);
  writeFileSync(target, JSON.stringify({ tasks: data.tasks, comments: data.comments, activity: data.activity, seq }, null, 1));
  console.log(`Wrote ${target}.`);
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { count, error: countError } = await db.from("lb_tasks").select("id", { count: "exact", head: true });
if (countError) throw new Error(countError.message);
if (count && !replace) {
  console.error(`Supabase already has ${count} tasks. Add --replace to overwrite them.`);
  process.exit(1);
}
if (dryRun) {
  console.log(`Dry run: Supabase has ${count ?? 0} tasks; would load ${data.tasks.length}.`);
  process.exit(0);
}
if (replace) {
  for (const table of ["lb_comments", "lb_activity", "lb_tasks"]) {
    const { error } = await db.from(table).delete().not(table === "lb_activity" ? "seq" : "id", "is", null);
    if (error) throw new Error(`Clearing ${table}: ${error.message}`);
  }
}
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
for (const part of chunk(data.tasks, 20)) {
  const { error } = await db.from("lb_tasks").insert(
    part.map((t) => ({ id: t.id, data: t, version: t.version ?? 1, position: t.position ?? 0, updated_at: t.updatedAt })),
  );
  if (error) throw new Error(`Adding tasks: ${error.message}`);
}
if (data.comments.length) {
  const { error } = await db.from("lb_comments").insert(
    data.comments.map((c) => ({ id: c.id, task_id: c.taskId, who: c.who, agent: c.agent, text: c.text, at: c.at })),
  );
  if (error) throw new Error(`Adding comments: ${error.message}`);
}
for (const part of chunk([...data.activity].sort((a, b) => a.seq - b.seq), 200)) {
  const { error } = await db.from("lb_activity").insert(
    part.map((a) => ({ task_id: a.taskId, who: a.who, agent: a.agent, text: a.text, at: a.at })),
  );
  if (error) throw new Error(`Adding activity: ${error.message}`);
}
console.log(`Loaded ${data.tasks.length} tasks into Supabase.`);
