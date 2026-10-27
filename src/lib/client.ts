"use client";

// Browser helpers for talking to the board's API.

import type { Activity, Board, Status } from "./types";

export interface BoardData extends Board {
  people: string[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; as?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.as) headers["x-board-as"] = opts.as;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/join";
  }
  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? "Something went wrong.");
  return data as T;
}

export const STATUS_DOT: Record<Status, string> = {
  todo: "#5BC6E9",
  doing: "#2A6075",
  check: "#F8D45B",
  done: "#22A34B",
};

// "took this and moved it to In progress" → "took C11 and moved it to In progress"
export function activityLine(a: Activity): string {
  if (/\bthis\b/.test(a.text)) return a.text.replace(/\bthis\b/, a.taskId);
  return `${a.text} on ${a.taskId}`;
}

export function actorName(who: string, agent: string | null): string {
  return agent ? `${agent} (for ${who})` : who;
}

export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

export function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function launchCountdown(now = new Date()): string {
  const launch = new Date("2026-10-30T09:00:00+00:00");
  const days = Math.ceil((launch.getTime() - now.getTime()) / 86_400_000);
  if (days > 1) return `Launch: Friday 30 Oct · ${days} days to go`;
  if (days === 1) return "Launch: Friday 30 Oct · tomorrow";
  if (days === 0) return "Launch day: Friday 30 Oct";
  return "Launched Friday 30 Oct";
}
