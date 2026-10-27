// Every change to the board goes through these pure functions, so the
// browser, the agent API and the tests all follow the same rules.

import {
  EDITABLE_FIELDS,
  LANES,
  LINK_KINDS,
  SIZES,
  STATUSES,
  STATUS_LABEL,
  WHENS,
  type Actor,
  type Lane,
  type Link,
  type LinkKind,
  type Status,
  type Task,
  type TaskPatch,
  type Tick,
} from "./types";

export class BoardError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Change {
  task: Task;
  // Lines for the activity log, newest last. Empty when nothing changed.
  log: string[];
}

const MAX_TEXT = 20_000;
const MAX_LINE = 600;
const MAX_LIST = 60;

function text(value: unknown, field: string, max = MAX_TEXT): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BoardError(400, `${field} must be text.`);
  if (value.length > max) throw new BoardError(400, `${field} is too long (over ${max} characters).`);
  return value.trim();
}

function lines(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  const list = typeof value === "string" ? value.split("\n") : value;
  if (!Array.isArray(list)) throw new BoardError(400, `${field} must be a list of text.`);
  if (list.length > MAX_LIST) throw new BoardError(400, `${field} has too many entries (over ${MAX_LIST}).`);
  return list.map((v, i) => text(v, `${field}[${i}]`, MAX_LINE)).filter(Boolean);
}

function ticks(value: unknown, field: string): Tick[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    return lines(value, field).map((t) => ({ text: t, done: false }));
  }
  if (value.length > MAX_LIST) throw new BoardError(400, `${field} has too many entries (over ${MAX_LIST}).`);
  return value
    .map((v, i) => {
      if (typeof v === "string") return { text: text(v, `${field}[${i}]`, MAX_LINE), done: false };
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return { text: text(o.text, `${field}[${i}].text`, MAX_LINE), done: o.done === true };
      }
      throw new BoardError(400, `${field}[${i}] must be text or { text, done }.`);
    })
    .filter((t) => t.text);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new BoardError(400, `${field} must be one of: ${allowed.join(", ")}.`);
}

export function cleanUrl(value: unknown): string {
  const raw = text(value, "url", 2000);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BoardError(400, "url must be a full web address starting with https://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BoardError(400, "url must start with https:// or http://.");
  }
  return url.toString();
}

function who(actor: Actor): string {
  return actor.agent ? `${actor.agent} (for ${actor.name})` : actor.name;
}

function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

// Cleans the fields of a PATCH body. Unknown fields are refused so typos
// don't silently do nothing.
export function cleanPatch(body: unknown): TaskPatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BoardError(400, "Send a JSON object of the fields to change.");
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).filter((k) => !(EDITABLE_FIELDS as readonly string[]).includes(k));
  if (unknown.length) {
    throw new BoardError(
      400,
      `Can't change ${unknown.join(", ")} here. Editable fields: ${EDITABLE_FIELDS.join(", ")}. Use the take, move, check, owners, links and comments endpoints for the rest.`,
    );
  }
  const p: TaskPatch = {};
  if ("title" in input) {
    p.title = text(input.title, "title", 200);
    if (!p.title) throw new BoardError(400, "title can't be empty.");
  }
  if ("lane" in input) p.lane = oneOf(input.lane, LANES, "lane");
  if ("group" in input) p.group = text(input.group, "group", 120);
  if ("when" in input) p.when = oneOf(input.when, WHENS, "when");
  if ("size" in input) p.size = input.size === null || input.size === "" ? null : oneOf(input.size, SIZES, "size");
  if ("cutFirst" in input) p.cutFirst = input.cutFirst === true;
  if ("blocked" in input) p.blocked = text(input.blocked, "blocked", 300);
  if ("summary" in input) p.summary = text(input.summary, "summary", 400);
  if ("description" in input) p.description = text(input.description, "description");
  if ("technical" in input) p.technical = text(input.technical, "technical", 40_000);
  if ("steps" in input) p.steps = lines(input.steps, "steps");
  if ("doneMeans" in input) p.doneMeans = ticks(input.doneMeans, "doneMeans");
  if ("howToCheck" in input) p.howToCheck = lines(input.howToCheck, "howToCheck");
  if ("watchOut" in input) p.watchOut = lines(input.watchOut, "watchOut");
  if ("needs" in input) p.needs = lines(input.needs, "needs");
  if ("files" in input) p.files = lines(input.files, "files");
  if ("related" in input) p.related = lines(input.related, "related").map((r) => r.toUpperCase());
  if ("signOffNotes" in input) p.signOffNotes = text(input.signOffNotes, "signOffNotes");
  return p;
}

const FIELD_NAMES: Record<string, string> = {
  title: "the title",
  lane: "the lane",
  group: "the group",
  when: "when it's for",
  size: "the size",
  cutFirst: "the cut-first flag",
  blocked: "the blocker",
  summary: "the summary",
  description: "the description",
  technical: "the technical description",
  steps: "the steps",
  doneMeans: "what done means",
  howToCheck: "how to check",
  watchOut: "watch out for",
  needs: "what it needs",
  files: "the files",
  related: "related tasks",
  signOffNotes: "the sign-off notes",
};

export function applyPatch(task: Task, patch: TaskPatch, actor: Actor, now: string): Change {
  const next: Task = { ...task };
  const changed: string[] = [];
  for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
    const value = patch[key];
    if (JSON.stringify(value) === JSON.stringify(task[key])) continue;
    (next as unknown as Record<string, unknown>)[key] = value;
    changed.push(key);
  }
  if (!changed.length) return { task, log: [] };
  next.updatedAt = now;
  const log: string[] = [];
  if (changed.includes("blocked")) {
    log.push(next.blocked ? `marked this blocked: ${next.blocked}` : "cleared the blocker");
  }
  const rest = changed.filter((k) => k !== "blocked");
  if (rest.length) log.push(`updated ${names(rest.map((k) => FIELD_NAMES[k] ?? k))}`);
  return { task: next, log };
}

export interface NewTaskInput extends TaskPatch {
  title?: string;
  lane?: Lane;
  owners?: string[];
}

export function nextId(lane: Lane, existing: string[]): string {
  const prefix = lane === "design" ? "B" : "C";
  const n = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(1), 10))
    .filter((v) => !Number.isNaN(v));
  return `${prefix}${Math.max(0, ...n) + 1}`;
}

export function createTask(
  body: unknown,
  actor: Actor,
  people: string[],
  existingIds: string[],
  position: number,
  now: string,
): Change {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BoardError(400, "Send a JSON object describing the task.");
  }
  const input = { ...(body as Record<string, unknown>) };
  const owners = cleanOwners(input.owners ?? [], people);
  delete input.owners;
  if (!("lane" in input)) input.lane = "build";
  if (!("when" in input)) input.when = "launch";
  const p = cleanPatch(input);
  if (!p.title) throw new BoardError(400, "title is required.");
  if (actor.agent) {
    const missing = (["summary", "description", "technical"] as const).filter((k) => !p[k]);
    if (missing.length) {
      throw new BoardError(
        400,
        `Tasks added by an AI assistant need ${missing.join(", ")}. See /api/guide for the format.`,
      );
    }
  }
  const lane = p.lane ?? "build";
  const task: Task = {
    id: nextId(lane, existingIds),
    lane,
    group: p.group ?? "",
    title: p.title,
    status: "todo",
    owners,
    when: p.when ?? "launch",
    size: p.size ?? null,
    cutFirst: p.cutFirst ?? false,
    blocked: p.blocked ?? "",
    summary: p.summary ?? "",
    description: p.description ?? "",
    technical: p.technical ?? "",
    steps: p.steps ?? [],
    doneMeans: p.doneMeans ?? [],
    howToCheck: p.howToCheck ?? [],
    watchOut: p.watchOut ?? [],
    needs: p.needs ?? [],
    files: p.files ?? [],
    related: p.related ?? [],
    links: [],
    signOffNotes: p.signOffNotes ?? "",
    addedBy: actor.agent ? { agent: actor.agent, by: actor.name, at: now } : null,
    checkedBy: null,
    position,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  return { task, log: ["created this"] };
}

export function cleanOwners(value: unknown, people: string[]): string[] {
  if (!Array.isArray(value)) throw new BoardError(400, "owners must be a list of names.");
  const out: string[] = [];
  for (const v of value) {
    const name = people.find((p) => typeof v === "string" && p.toLowerCase() === v.trim().toLowerCase());
    if (!name) throw new BoardError(400, `"${String(v)}" isn't on the team. People: ${people.join(", ")}.`);
    if (!out.includes(name)) out.push(name);
  }
  return out.sort((a, b) => people.indexOf(a) - people.indexOf(b));
}

export function setOwners(task: Task, owners: string[], actor: Actor, now: string): Change {
  const added = owners.filter((o) => !task.owners.includes(o));
  const removed = task.owners.filter((o) => !owners.includes(o));
  if (!added.length && !removed.length) return { task, log: [] };
  const log: string[] = [];
  if (added.length) log.push(`added ${names(added)} as ${added.length > 1 ? "owners" : "an owner"}`);
  if (removed.length) log.push(`removed ${names(removed)} as ${removed.length > 1 ? "owners" : "an owner"}`);
  return { task: { ...task, owners, updatedAt: now }, log };
}

// "Take this": you become an owner and it moves to In progress.
export function take(task: Task, actor: Actor, people: string[], now: string): Change {
  if (task.status === "done") throw new BoardError(409, "This is already done. Move it back first if it needs more work.");
  const owners = task.owners.includes(actor.name) ? task.owners : cleanOwners([...task.owners, actor.name], people);
  const status: Status = task.status === "todo" ? "doing" : task.status;
  if (owners === task.owners && status === task.status) return { task, log: [] };
  return {
    task: { ...task, owners, status, updatedAt: now },
    log: [status !== task.status ? "took this and moved it to In progress" : "took this"],
  };
}

export function move(task: Task, status: Status, actor: Actor, now: string): Change {
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new BoardError(400, `status must be one of: ${STATUSES.join(", ")}.`);
  }
  if (status === task.status) return { task, log: [] };
  if (status === "done") return check(task, actor, now);
  return {
    task: { ...task, status, checkedBy: null, updatedAt: now },
    log: [`moved this to ${STATUS_LABEL[status]}`],
  };
}

// Marking work done is a check by a person who isn't an owner.
export function check(task: Task, actor: Actor, now: string): Change {
  if (actor.agent) {
    throw new BoardError(403, "Only a person can mark work done. Move it to Ready to check (status \"check\") instead.");
  }
  if (task.status === "done") return { task, log: [] };
  if (task.owners.includes(actor.name)) {
    throw new BoardError(403, "You're an owner, so someone else checks it and marks it done. Move it to Ready to check.");
  }
  return {
    task: { ...task, status: "done", checkedBy: { by: actor.name, at: now }, updatedAt: now },
    log: ["checked this and marked it done"],
  };
}

export function tick(task: Task, index: number, done: boolean, actor: Actor, now: string): Change {
  const item = task.doneMeans[index];
  if (!item) throw new BoardError(404, `There's no "done means" item ${index}.`);
  if (item.done === done) return { task, log: [] };
  const doneMeans = task.doneMeans.map((t, i) => (i === index ? { ...t, done } : t));
  return {
    task: { ...task, doneMeans, updatedAt: now },
    log: [`${done ? "ticked" : "unticked"} "${item.text}"`],
  };
}

export function addLink(task: Task, body: unknown, actor: Actor, id: string, now: string): Change {
  if (!body || typeof body !== "object") throw new BoardError(400, "Send { kind, url, label }.");
  const b = body as Record<string, unknown>;
  const kind: LinkKind = b.kind === undefined ? "other" : oneOf(b.kind, LINK_KINDS, "kind");
  const url = cleanUrl(b.url);
  const label = text(b.label, "label", 160) || defaultLabel(kind, url);
  if (task.links.some((l) => l.url === url)) {
    return { task, log: [] };
  }
  const link: Link = { id, kind, label, url, addedBy: who(actor), at: now };
  return {
    task: { ...task, links: [...task.links, link], updatedAt: now },
    log: [`linked ${label}`],
  };
}

export function removeLink(task: Task, linkId: string, actor: Actor, now: string): Change {
  const link = task.links.find((l) => l.id === linkId);
  if (!link) throw new BoardError(404, "That link isn't on this task.");
  return {
    task: { ...task, links: task.links.filter((l) => l.id !== linkId), updatedAt: now },
    log: [`removed the link ${link.label}`],
  };
}

function defaultLabel(kind: LinkKind, url: string): string {
  const pr = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (pr) return `PR #${pr[2]}`;
  if (kind === "preview") return "Preview";
  if (kind === "design") return "Design file";
  try {
    return new URL(url).hostname;
  } catch {
    return "Link";
  }
}

export function cleanComment(body: unknown): string {
  if (!body || typeof body !== "object") throw new BoardError(400, "Send { text }.");
  const t = text((body as Record<string, unknown>).text, "text", 8000);
  if (!t) throw new BoardError(400, "text can't be empty.");
  return t;
}

export function actorLabel(actor: Actor): string {
  return who(actor);
}
