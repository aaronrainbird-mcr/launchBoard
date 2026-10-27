import type { Activity, Comment, Task } from "../types";

export class VersionConflict extends Error {}

// What both stores (a file on this computer, or Supabase when hosted) provide.
export interface Store {
  readonly kind: "file" | "supabase";
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  // Saves a task. `expectedVersion` is the version it was read at, or null
  // for a new task. Throws VersionConflict if someone saved it in between.
  saveTask(task: Task, expectedVersion: number | null): Promise<void>;
  listComments(taskId?: string): Promise<Comment[]>;
  addComment(comment: Comment): Promise<void>;
  // Appends activity lines and returns them with their sequence numbers.
  addActivity(entries: Omit<Activity, "seq">[]): Promise<Activity[]>;
  listActivity(opts: { taskId?: string; after?: number; limit?: number }): Promise<Activity[]>;
  latestSeq(): Promise<number>;
}
