// Keeps the board in Supabase when hosted. Server only: it uses the service
// role key, which must never reach the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Comment, Task } from "../types";
import { VersionConflict, type Store } from "./types";

interface ActivityRow {
  seq: number;
  task_id: string;
  who: string;
  agent: string | null;
  text: string;
  at: string;
}

interface CommentRow {
  id: string;
  task_id: string;
  who: string;
  agent: string | null;
  text: string;
  at: string;
}

const toActivity = (r: ActivityRow): Activity => ({
  seq: Number(r.seq),
  taskId: r.task_id,
  who: r.who,
  agent: r.agent,
  text: r.text,
  at: r.at,
});

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  taskId: r.task_id,
  who: r.who,
  agent: r.agent,
  text: r.text,
  at: r.at,
});

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Supabase ${what} failed: ${error?.message ?? "unknown error"}`);
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listTasks(): Promise<Task[]> {
    const { data, error } = await this.db.from("lb_tasks").select("data, version").order("position");
    if (error) fail("reading tasks", error);
    return (data ?? []).map((r) => ({ ...(r.data as Task), version: r.version as number }));
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await this.db.from("lb_tasks").select("data, version").eq("id", id).maybeSingle();
    if (error) fail("reading a task", error);
    return data ? { ...(data.data as Task), version: data.version as number } : null;
  }

  async saveTask(task: Task, expectedVersion: number | null): Promise<void> {
    const row = { id: task.id, data: task, version: task.version, position: task.position, updated_at: task.updatedAt };
    if (expectedVersion === null) {
      const { error } = await this.db.from("lb_tasks").insert(row);
      if (error?.code === "23505") throw new VersionConflict(`Task ${task.id} already exists.`);
      if (error) fail("adding a task", error);
      return;
    }
    const { data, error } = await this.db
      .from("lb_tasks")
      .update(row)
      .eq("id", task.id)
      .eq("version", expectedVersion)
      .select("id");
    if (error) fail("saving a task", error);
    if (!data?.length) throw new VersionConflict(task.id);
  }

  async listComments(taskId?: string): Promise<Comment[]> {
    let q = this.db.from("lb_comments").select("*").order("at");
    if (taskId) q = q.eq("task_id", taskId);
    const { data, error } = await q;
    if (error) fail("reading comments", error);
    return (data as CommentRow[]).map(toComment);
  }

  async addComment(c: Comment): Promise<void> {
    const { error } = await this.db
      .from("lb_comments")
      .insert({ id: c.id, task_id: c.taskId, who: c.who, agent: c.agent, text: c.text, at: c.at });
    if (error) fail("adding a comment", error);
  }

  async addActivity(entries: Omit<Activity, "seq">[]): Promise<Activity[]> {
    if (!entries.length) return [];
    const { data, error } = await this.db
      .from("lb_activity")
      .insert(entries.map((e) => ({ task_id: e.taskId, who: e.who, agent: e.agent, text: e.text, at: e.at })))
      .select("*");
    if (error) fail("logging activity", error);
    return (data as ActivityRow[]).map(toActivity).sort((a, b) => a.seq - b.seq);
  }

  async listActivity({ taskId, after, limit }: { taskId?: string; after?: number; limit?: number }) {
    let q = this.db.from("lb_activity").select("*").order("seq", { ascending: false });
    if (taskId) q = q.eq("task_id", taskId);
    if (after !== undefined) q = q.gt("seq", after);
    q = q.limit(limit ?? 5000);
    const { data, error } = await q;
    if (error) fail("reading activity", error);
    return (data as ActivityRow[]).map(toActivity).reverse();
  }

  async latestSeq(): Promise<number> {
    const { data, error } = await this.db.from("lb_activity").select("seq").order("seq", { ascending: false }).limit(1);
    if (error) fail("reading the latest change", error);
    return data?.length ? Number(data[0].seq) : 0;
  }
}
