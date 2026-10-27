// Who is making a request, and whether they're allowed in.
//
// Hosted (BOARD_TEAM_KEY is set):
//   - People open /join once and type the team key. That sets a signed cookie.
//     The "Using as" picker names them on changes; it's a label, not a login.
//   - AI assistants send "Authorization: Bearer <personal agent key>". Each key
//     in BOARD_AGENT_KEYS belongs to one person, so every change an assistant
//     makes is recorded as "Claude Code (for Colin)".
// On this computer (no BOARD_TEAM_KEY): only loopback addresses get in, and
// X-Board-As says who you are.

import { createHmac, timingSafeEqual } from "node:crypto";
import { BoardError } from "./rules";
import { teamPeople } from "./people";
import type { Actor } from "./types";

export const SESSION_COOKIE = "lb_session";

type Env = Record<string, string | undefined>;

export function hostedMode(env: Env = process.env): boolean {
  return Boolean(env.BOARD_TEAM_KEY);
}

export function sessionToken(teamKey: string): string {
  return createHmac("sha256", teamKey).update("launch-board-session-v1").digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function agentKeys(env: Env = process.env): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (env.BOARD_AGENT_KEYS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    const key = pair.slice(i + 1).trim();
    if (name && key.length >= 16) out.set(key, name);
  }
  return out;
}

function isLoopback(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function personFrom(value: string | null, people: string[]): string | null {
  if (!value) return null;
  return people.find((p) => p.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

function agentName(req: Request): string {
  const raw = (req.headers.get("x-board-agent") ?? "").trim();
  if (!raw) return "AI assistant";
  if (raw.length > 40 || !/^[\w .+-]+$/.test(raw)) {
    throw new BoardError(400, "X-Board-Agent must be a short name such as \"Claude Code\" or \"Codex\".");
  }
  return raw;
}

export interface Caller {
  kind: "person" | "agent";
  // Set for writes. Reads may come from someone who hasn't picked a name yet.
  actor: Actor | null;
}

// Throws a 401 or 403 BoardError when the request isn't allowed in.
export function identify(req: Request, opts: { write: boolean }, env: Env = process.env): Caller {
  const people = teamPeople();
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!hostedMode(env)) {
    if (env.VERCEL) {
      throw new BoardError(503, "This deployment has no BOARD_TEAM_KEY, so it refuses every request.");
    }
    if (!isLoopback(req.headers.get("host"))) {
      throw new BoardError(403, "Without BOARD_TEAM_KEY the board only answers on this computer.");
    }
    const name = personFrom(req.headers.get("x-board-as"), people);
    const isAgent = req.headers.has("x-board-agent");
    if (opts.write && !name) {
      throw new BoardError(400, `Say who you are with the X-Board-As header. People: ${people.join(", ")}.`);
    }
    if (opts.write) checkOrigin(req, isAgent);
    return {
      kind: isAgent ? "agent" : "person",
      actor: name ? (isAgent ? { name, agent: agentName(req) } : { name }) : null,
    };
  }

  if (bearer) {
    const owner = [...agentKeys(env)].find(([key]) => same(key, bearer))?.[1];
    const name = owner ? personFrom(owner, people) : null;
    if (!name) throw new BoardError(401, "That agent key isn't recognised. Ask Aaron for a personal key.");
    return { kind: "agent", actor: { name, agent: agentName(req) } };
  }

  const token = cookie(req, SESSION_COOKIE);
  if (!token || !same(token, sessionToken(env.BOARD_TEAM_KEY!))) {
    throw new BoardError(401, "Open /join and enter the team key first.");
  }
  const name = personFrom(req.headers.get("x-board-as"), people);
  if (!opts.write) return { kind: "person", actor: name ? { name } : null };
  checkOrigin(req, false);
  if (!name) throw new BoardError(400, "Pick who you are with the \"Using as\" menu first.");
  return { kind: "person", actor: { name } };
}

// Browser changes must come from the board's own pages.
function checkOrigin(req: Request, isAgent: boolean): void {
  const origin = req.headers.get("origin");
  if (!origin) {
    if (isAgent || req.headers.get("sec-fetch-site") === null) return; // curl and scripts send no Origin
    throw new BoardError(403, "Changes must come from the board itself.");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {
    // fall through
  }
  throw new BoardError(403, "Changes must come from the board itself.");
}

export function requireActor(caller: Caller): Actor {
  if (!caller.actor) throw new BoardError(400, "Say who you are first.");
  return caller.actor;
}
