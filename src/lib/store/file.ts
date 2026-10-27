// Keeps the board in one JSON file. Used on a single computer, and in tests.

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Activity, Comment, Task } from "../types";
import { VersionConflict, type Store } from "./types";

interface FileData {
  tasks: Task[];
  comments: Comment[];
  activity: Activity[];
  seq: number;
}

const empty = (): FileData => ({ tasks: [], comments: [], activity: [], seq: 0 });

export class FileStore implements Store {
  readonly kind = "file" as const;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: FileData | null = null;
  private mtime = 0;

  constructor(private file: string) {}

  // Re-reads the file when something else (such as the seed script) changed it.
  private async load(): Promise<FileData> {
    try {
      const m = (await stat(this.file)).mtimeMs;
      if (this.cache && m === this.mtime) return this.cache;
      this.cache = JSON.parse(await readFile(this.file, "utf8")) as FileData;
      this.mtime = m;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      this.cache = empty();
    }
    return this.cache;
  }

  private async persist(data: FileData): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 1));
    await rename(tmp, this.file);
    this.mtime = (await stat(this.file)).mtimeMs;
  }

  // Runs one operation at a time so writes never interleave.
  private run<T>(fn: (data: FileData) => Promise<T> | T, write = false): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = await fn(data);
      if (write) await this.persist(data);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  listTasks() {
    return this.run((d) => structuredClone(d.tasks));
  }

  getTask(id: string) {
    return this.run((d) => structuredClone(d.tasks.find((t) => t.id === id) ?? null));
  }

  saveTask(task: Task, expectedVersion: number | null) {
    return this.run((d) => {
      const i = d.tasks.findIndex((t) => t.id === task.id);
      if (expectedVersion === null) {
        if (i >= 0) throw new VersionConflict(`Task ${task.id} already exists.`);
        d.tasks.push(structuredClone(task));
        return;
      }
      if (i < 0 || d.tasks[i].version !== expectedVersion) throw new VersionConflict(task.id);
      d.tasks[i] = structuredClone(task);
    }, true);
  }

  listComments(taskId?: string) {
    return this.run((d) => structuredClone(taskId ? d.comments.filter((c) => c.taskId === taskId) : d.comments));
  }

  addComment(comment: Comment) {
    return this.run((d) => {
      d.comments.push(structuredClone(comment));
    }, true);
  }

  addActivity(entries: Omit<Activity, "seq">[]) {
    return this.run((d) => {
      const added = entries.map((e) => ({ ...e, seq: ++d.seq }));
      d.activity.push(...added);
      return structuredClone(added);
    }, true);
  }

  listActivity({ taskId, after, limit }: { taskId?: string; after?: number; limit?: number }) {
    return this.run((d) => {
      let list = d.activity;
      if (taskId) list = list.filter((a) => a.taskId === taskId);
      if (after !== undefined) list = list.filter((a) => a.seq > after);
      if (limit !== undefined) list = list.slice(-limit);
      return structuredClone(list);
    });
  }

  latestSeq() {
    return this.run((d) => d.seq);
  }
}
