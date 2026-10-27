// The board's operations: read, then apply a rule from rules.ts, save with a
// version check, and log what changed. Used by every API route.

import { randomUUID } from "node:crypto";
import { teamPeople } from "./people";
import {
  BoardError,
  addLink,
  applyPatch,
  check,
  cleanComment,
  cleanOwners,
  cleanPatch,
  createTask,
  move,
  removeLink,
  setOwners,
  take,
  tick,
  type Change,
} from "./rules";
import { VersionConflict, type Store } from "./store/types";
import type { Activity, Actor, Board, Comment, Status, Task } from "./types";

const now = () => new Date().toISOString();

async function log(store: Store, taskId: string, actor: Actor, lines: string[]): Promise<Activity[]> {
  const at = now();
  return store.addActivity(lines.map((text) => ({ taskId, who: actor.name, agent: actor.agent ?? null, text, at })));
}

export async function getBoard(store: Store): Promise<Board> {
  const [tasks, comments, activity, seq] = await Promise.all([
    store.listTasks(),
    store.listComments(),
    store.listActivity({ limit: 4000 }),
    store.latestSeq(),
  ]);
  tasks.sort((a, b) => a.position - b.position);
  return { tasks, comments, activity, seq };
}

export async function requireTask(store: Store, id: string): Promise<Task> {
  const task = await store.getTask(id.toUpperCase());
  if (!task) throw new BoardError(404, `There's no task ${id}.`);
  return task;
}

// Reads the task, applies the change and saves it, retrying if someone else
// saved the same task in between.
async function mutate(
  store: Store,
  id: string,
  actor: Actor,
  fn: (task: Task, at: string) => Change,
): Promise<{ task: Task; activity: Activity[] }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await requireTask(store, id);
    const change = fn(current, now());
    if (!change.log.length) return { task: current, activity: [] };
    const saved = { ...change.task, version: current.version + 1 };
    try {
      await store.saveTask(saved, current.version);
    } catch (e) {
      if (e instanceof VersionConflict) continue;
      throw e;
    }
    return { task: saved, activity: await log(store, saved.id, actor, change.log) };
  }
  throw new BoardError(409, "Someone else changed this task at the same moment. Try again.");
}

export async function addTask(store: Store, body: unknown, actor: Actor) {
  const people = teamPeople();
  for (let attempt = 0; attempt < 4; attempt++) {
    const tasks = await store.listTasks();
    const position = Math.min(0, ...tasks.map((t) => t.position)) - 1;
    const change = createTask(body, actor, people, tasks.map((t) => t.id), position, now());
    try {
      await store.saveTask(change.task, null);
    } catch (e) {
      if (e instanceof VersionConflict) continue;
      throw e;
    }
    return { task: change.task, activity: await log(store, change.task.id, actor, change.log) };
  }
  throw new BoardError(409, "Couldn't pick a free task number. Try again.");
}

export function updateTask(store: Store, id: string, body: unknown, actor: Actor) {
  const patch = cleanPatch(body);
  return mutate(store, id, actor, (t, at) => applyPatch(t, patch, actor, at));
}

export function takeTask(store: Store, id: string, actor: Actor) {
  return mutate(store, id, actor, (t, at) => take(t, actor, teamPeople(), at));
}

export function moveTask(store: Store, id: string, status: Status, actor: Actor) {
  return mutate(store, id, actor, (t, at) => move(t, status, actor, at));
}

export function checkTask(store: Store, id: string, actor: Actor) {
  return mutate(store, id, actor, (t, at) => check(t, actor, at));
}

export function setTaskOwners(store: Store, id: string, owners: unknown, actor: Actor) {
  const list = cleanOwners(owners, teamPeople());
  return mutate(store, id, actor, (t, at) => setOwners(t, list, actor, at));
}

export function tickTask(store: Store, id: string, index: number, done: boolean, actor: Actor) {
  return mutate(store, id, actor, (t, at) => tick(t, index, done, actor, at));
}

export function addTaskLink(store: Store, id: string, body: unknown, actor: Actor) {
  const linkId = randomUUID().slice(0, 8);
  return mutate(store, id, actor, (t, at) => addLink(t, body, actor, linkId, at));
}

export function removeTaskLink(store: Store, id: string, linkId: string, actor: Actor) {
  return mutate(store, id, actor, (t, at) => removeLink(t, linkId, actor, at));
}

export async function addTaskComment(store: Store, id: string, body: unknown, actor: Actor) {
  const task = await requireTask(store, id);
  const comment: Comment = {
    id: randomUUID(),
    taskId: task.id,
    who: actor.name,
    agent: actor.agent ?? null,
    text: cleanComment(body),
    at: now(),
  };
  await store.addComment(comment);
  const activity = await log(store, task.id, actor, ["commented"]);
  return { comment, activity };
}

export async function getTaskDetail(store: Store, id: string) {
  const task = await requireTask(store, id);
  const [comments, activity] = await Promise.all([
    store.listComments(task.id),
    store.listActivity({ taskId: task.id }),
  ]);
  return { task, comments, activity: activity.reverse() };
}
