import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addTask, addTaskLink, checkTask, getTaskDetail, moveTask, takeTask, updateTask } from "./board";
import { identify } from "./auth";
import { BoardError, applyPatch, check, cleanPatch, cleanUrl, createTask, move, nextId, take } from "./rules";
import { FileStore } from "./store/file";
import type { Actor, Task } from "./types";

const PEOPLE = ["Aaron", "Abdulmuiz", "Colin", "Nick", "Skye"];
const NOW = "2026-10-27T09:00:00.000Z";
const colin: Actor = { name: "Colin" };
const claudeForColin: Actor = { name: "Colin", agent: "Claude Code" };

function task(over: Partial<Task> = {}): Task {
  return { ...createTask({ title: "Test task", summary: "s" }, colin, PEOPLE, [], 0, NOW).task, ...over };
}

describe("taking and moving", () => {
  it("take makes you an owner and moves To do to In progress", () => {
    const c = take(task(), colin, PEOPLE, NOW);
    expect(c.task.owners).toEqual(["Colin"]);
    expect(c.task.status).toBe("doing");
    expect(c.log).toEqual(["took this and moved it to In progress"]);
  });

  it("taking a task you already own and are doing changes nothing", () => {
    const c = take(task({ owners: ["Colin"], status: "doing" }), colin, PEOPLE, NOW);
    expect(c.log).toEqual([]);
  });

  it("moving away from Done clears the check", () => {
    const c = move(task({ status: "done", checkedBy: { by: "Nick", at: NOW } }), "doing", colin, NOW);
    expect(c.task.checkedBy).toBeNull();
  });
});

describe("marking done", () => {
  it("someone who isn't an owner can mark it done", () => {
    const c = check(task({ owners: ["Aaron"], status: "check" }), colin, NOW);
    expect(c.task.status).toBe("done");
    expect(c.task.checkedBy).toEqual({ by: "Colin", at: NOW });
  });

  it("an owner can't mark their own work done", () => {
    expect(() => check(task({ owners: ["Colin"], status: "check" }), colin, NOW)).toThrow(/someone else/);
  });

  it("an AI assistant can never mark work done", () => {
    expect(() => check(task({ owners: ["Aaron"], status: "check" }), claudeForColin, NOW)).toThrow(/Only a person/);
  });

  it("moving to done goes through the same check", () => {
    expect(() => move(task({ owners: ["Colin"] }), "done", colin, NOW)).toThrow(BoardError);
  });
});

describe("adding tasks", () => {
  it("gives design tasks B numbers and build tasks C numbers", () => {
    expect(nextId("design", ["B11", "C25", "A27"])).toBe("B12");
    expect(nextId("build", ["B11", "C25", "A27"])).toBe("C26");
  });

  it("an AI assistant must include the summary, description and technical description", () => {
    expect(() => createTask({ title: "x" }, claudeForColin, PEOPLE, [], 0, NOW)).toThrow(/summary, description, technical/);
    const ok = createTask({ title: "x", summary: "s", description: "d", technical: "t" }, claudeForColin, PEOPLE, [], 0, NOW);
    expect(ok.task.addedBy).toEqual({ agent: "Claude Code", by: "Colin", at: NOW });
  });

  it("refuses owners who aren't on the team", () => {
    expect(() => createTask({ title: "x", owners: ["Bob"] }, colin, PEOPLE, [], 0, NOW)).toThrow(/isn't on the team/);
  });
});

describe("editing", () => {
  it("refuses fields that can't be edited, so typos don't silently do nothing", () => {
    expect(() => cleanPatch({ status: "done" })).toThrow(/Can't change status/);
    expect(() => cleanPatch({ summry: "x" })).toThrow(/Can't change summry/);
  });

  it("accepts lists as arrays or as lines of text", () => {
    expect(cleanPatch({ steps: "one\n\n two " }).steps).toEqual(["one", "two"]);
    expect(cleanPatch({ doneMeans: ["a", { text: "b", done: true }] }).doneMeans).toEqual([
      { text: "a", done: false },
      { text: "b", done: true },
    ]);
  });

  it("logs a blocker separately from other edits, and nothing when nothing changed", () => {
    const t = task();
    expect(applyPatch(t, { blocked: "Waiting for Google", summary: "new" }, colin, NOW).log).toEqual([
      "marked this blocked: Waiting for Google",
      "updated the summary",
    ]);
    expect(applyPatch(t, { summary: t.summary }, colin, NOW).log).toEqual([]);
  });

  it("only takes web links", () => {
    expect(cleanUrl("https://github.com/x/y/pull/1")).toBe("https://github.com/x/y/pull/1");
    expect(() => cleanUrl("javascript:alert(1)")).toThrow(/https/);
    expect(() => cleanUrl("not a url")).toThrow();
  });
});

describe("the board with a file store", () => {
  it("takes, links, moves and checks a task, logging each step", async () => {
    const store = new FileStore(path.join(await mkdtemp(path.join(tmpdir(), "lb-")), "board.json"));
    const { task: t } = await addTask(store, { title: "Run the clear-out", summary: "s" }, { name: "Aaron" });
    await takeTask(store, t.id, claudeForColin);
    await addTaskLink(store, t.id, { kind: "pr", url: "https://github.com/MCR-Pathways/intranet/pull/601" }, claudeForColin);
    await updateTask(store, t.id, { signOffNotes: "Look at the preview." }, claudeForColin);
    await moveTask(store, t.id, "check", claudeForColin);
    await expect(checkTask(store, t.id, colin)).rejects.toThrow(/someone else/);
    await checkTask(store, t.id, { name: "Nick" });

    const detail = await getTaskDetail(store, t.id);
    expect(detail.task.status).toBe("done");
    expect(detail.task.links[0].label).toBe("PR #601");
    expect(detail.task.version).toBe(6);
    expect(detail.activity.map((a) => a.text)).toEqual([
      "checked this and marked it done",
      "moved this to Ready to check",
      "updated the sign-off notes",
      "linked PR #601",
      "took this and moved it to In progress",
      "created this",
    ]);
    expect(detail.activity[1].agent).toBe("Claude Code");
  });
});

describe("who's calling", () => {
  const req = (headers: Record<string, string>, host = "127.0.0.1:3200") =>
    new Request(`http://${host}/api/tasks/C5/take`, { method: "POST", headers: { host, ...headers } });

  it("on one computer, needs X-Board-As for changes", () => {
    expect(() => identify(req({}), { write: true }, {})).toThrow(/X-Board-As/);
    expect(identify(req({ "x-board-as": "colin", "x-board-agent": "Codex" }), { write: true }, {}).actor).toEqual({
      name: "Colin",
      agent: "Codex",
    });
  });

  it("without a team key, refuses anything not on this computer", () => {
    expect(() => identify(req({ "x-board-as": "Colin" }, "board.example.org"), { write: true }, {})).toThrow(/only answers on this computer/);
  });

  it("when hosted, an agent key decides who the agent works for", () => {
    const env = { BOARD_TEAM_KEY: "team-key-for-tests", BOARD_AGENT_KEYS: "Colin:abcdefghijklmnop1234,Nick:zyxwvutsrqponmlk9876" };
    const caller = identify(req({ authorization: "Bearer abcdefghijklmnop1234", "x-board-agent": "Claude Code", "x-board-as": "Nick" }, "board.example.org"), { write: true }, env);
    expect(caller.actor).toEqual({ name: "Colin", agent: "Claude Code" });
    expect(() => identify(req({ authorization: "Bearer wrong-key-wrong-key" }, "board.example.org"), { write: true }, env)).toThrow(/isn't recognised/);
  });

  it("when hosted, a browser without the team cookie is sent to /join", () => {
    const env = { BOARD_TEAM_KEY: "team-key-for-tests" };
    expect(() => identify(req({ "x-board-as": "Colin" }, "board.example.org"), { write: false }, env)).toThrow(/join/);
  });

  it("a deployment on Vercel with no team key refuses everything", () => {
    expect(() => identify(req({ "x-board-as": "Colin" }), { write: false }, { VERCEL: "1" })).toThrow(/refuses every request/);
  });
});
