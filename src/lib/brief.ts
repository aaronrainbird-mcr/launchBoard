// A task as one Markdown document: everything someone, or their AI
// assistant, needs to pick it up. Used by "Copy brief" and GET /api/tasks/:id/brief.

import { LANE_LABEL, LINK_LABEL, STATUS_LABEL, type Comment, type Task } from "./types";

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function taskBrief(task: Task, comments: Comment[], boardUrl: string): string {
  const out: string[] = [];
  const owners = task.owners.length ? task.owners.join(", ") : "No one yet";
  out.push(`# ${task.id} · ${task.title}`);
  out.push(
    [
      `**Lane:** ${LANE_LABEL[task.lane]}${task.group ? ` (${task.group})` : ""}`,
      `**Status:** ${STATUS_LABEL[task.status]}`,
      `**Owners:** ${owners}`,
      `**When:** ${task.when === "launch" ? "For launch, Friday 30 October" : "After launch"}${task.cutFirst ? " (first to cut if time is short)" : ""}`,
      task.size ? `**Size:** ${task.size}` : "",
      task.blocked ? `**Blocked:** ${task.blocked}` : "",
      task.related.length ? `**Related:** ${task.related.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("  \n"),
  );
  if (task.summary) out.push(`## Summary\n\n${task.summary}`);
  if (task.description) out.push(`## Description\n\n${task.description}`);
  if (task.technical) out.push(`## Technical description\n\n${task.technical}`);
  if (task.steps.length) out.push(`## Steps\n\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  if (task.doneMeans.length) {
    out.push(`## Done means\n\n${task.doneMeans.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n")}`);
  }
  if (task.howToCheck.length) out.push(`## How to check\n\n${list(task.howToCheck)}`);
  if (task.watchOut.length) out.push(`## Watch out for\n\n${list(task.watchOut)}`);
  if (task.needs.length) out.push(`## Needs\n\n${list(task.needs)}`);
  if (task.files.length) out.push(`## Files\n\n${task.files.map((f) => `- \`${f.replace(/`/g, "")}\``).join("\n")}`);
  if (task.links.length) {
    out.push(`## Links\n\n${task.links.map((l) => `- ${LINK_LABEL[l.kind]}: [${l.label}](${l.url})`).join("\n")}`);
  }
  if (task.signOffNotes) out.push(`## Sign-off notes\n\n${task.signOffNotes}`);
  if (comments.length) {
    const recent = comments.slice(-8);
    out.push(
      `## Recent comments\n\n${recent
        .map((c) => `- **${c.agent ? `${c.agent} (for ${c.who})` : c.who}**, ${c.at.slice(0, 16).replace("T", " ")}: ${c.text.replace(/\n+/g, " ")}`)
        .join("\n")}`,
    );
  }
  out.push(
    `## Updating this card\n\nThe board's API is described at ${boardUrl}/api/guide. When you start, take the task. As you work, add links to the PR, the preview and any documents, and comment on progress. When it's ready, move it to "check" and write sign-off notes saying what to look at. A person who isn't an owner marks it done.`,
  );
  return out.join("\n\n") + "\n";
}
