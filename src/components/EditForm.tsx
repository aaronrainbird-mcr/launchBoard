"use client";

import { useState } from "react";
import { LANES, LANE_LABEL, SIZES, type Lane, type Size, type Task, type TaskPatch, type When } from "@/lib/types";

const asLines = (l: string[]) => l.join("\n");
const fromLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

// Every documentation field on a task, editable in one go. Only the fields
// that changed are sent.
export function EditForm({ task: t, onSave, onCancel }: { task: Task; onSave: (p: TaskPatch) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({
    title: t.title,
    lane: t.lane,
    group: t.group,
    when: t.when,
    size: t.size ?? "",
    cutFirst: t.cutFirst,
    blocked: t.blocked,
    summary: t.summary,
    description: t.description,
    technical: t.technical,
    steps: asLines(t.steps),
    doneMeans: asLines(t.doneMeans.map((d) => d.text)),
    howToCheck: asLines(t.howToCheck),
    watchOut: asLines(t.watchOut),
    needs: asLines(t.needs),
    files: asLines(t.files),
    related: t.related.join(", "),
    signOffNotes: t.signOffNotes,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  function build(): TaskPatch {
    const p: TaskPatch = {};
    if (f.title.trim() !== t.title) p.title = f.title.trim();
    if (f.lane !== t.lane) p.lane = f.lane as Lane;
    if (f.group.trim() !== t.group) p.group = f.group.trim();
    if (f.when !== t.when) p.when = f.when as When;
    if ((f.size || null) !== t.size) p.size = (f.size || null) as Size | null;
    if (f.cutFirst !== t.cutFirst) p.cutFirst = f.cutFirst;
    if (f.blocked.trim() !== t.blocked) p.blocked = f.blocked.trim();
    if (f.summary.trim() !== t.summary) p.summary = f.summary.trim();
    if (f.description.trim() !== t.description) p.description = f.description.trim();
    if (f.technical.trim() !== t.technical) p.technical = f.technical.trim();
    if (f.signOffNotes.trim() !== t.signOffNotes) p.signOffNotes = f.signOffNotes.trim();
    for (const k of ["steps", "howToCheck", "watchOut", "needs", "files"] as const) {
      const next = fromLines(f[k]);
      if (JSON.stringify(next) !== JSON.stringify(t[k])) p[k] = next;
    }
    const done = fromLines(f.doneMeans);
    if (JSON.stringify(done) !== JSON.stringify(t.doneMeans.map((d) => d.text))) {
      // Keep the ticks on items whose text didn't change.
      p.doneMeans = done.map((text) => ({ text, done: t.doneMeans.find((d) => d.text === text)?.done ?? false }));
    }
    const related = f.related
      .split(/[,\s]+/)
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);
    if (JSON.stringify(related) !== JSON.stringify(t.related)) p.related = related;
    return p;
  }

  return (
    <form
      className="lb-form"
      style={{ marginTop: 22 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(build());
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="lb-field">
        <span>Title</span>
        <input className="lb-input" value={f.title} onChange={set("title")} required maxLength={200} />
      </label>
      <div className="lb-field-row">
        <label className="lb-field">
          <span>Lane</span>
          <select className="lb-select" value={f.lane} onChange={set("lane")}>
            {LANES.map((l) => (
              <option key={l} value={l}>
                {LANE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="lb-field">
          <span>When</span>
          <select className="lb-select" value={f.when} onChange={set("when")}>
            <option value="launch">For launch</option>
            <option value="after">After launch</option>
          </select>
        </label>
        <label className="lb-field">
          <span>Size</span>
          <select className="lb-select" value={f.size} onChange={set("size")}>
            <option value="">Not set</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="lb-field">
        <span>
          Group <small>(e.g. &ldquo;Session 3 · Learning and Groups&rdquo;)</small>
        </span>
        <input className="lb-input" value={f.group} onChange={set("group")} maxLength={120} />
      </label>
      <label className="lb-tick" style={{ padding: 0 }}>
        <input type="checkbox" checked={f.cutFirst} onChange={(e) => setF({ ...f, cutFirst: e.target.checked })} />
        <span>First to cut if we&rsquo;re short of time</span>
      </label>
      <label className="lb-field">
        <span>
          Blocked by <small>(leave empty when it isn&rsquo;t blocked)</small>
        </span>
        <input className="lb-input" value={f.blocked} onChange={set("blocked")} maxLength={300} />
      </label>
      <label className="lb-field">
        <span>Summary <small>(one sentence)</small></span>
        <textarea className="lb-textarea" value={f.summary} onChange={set("summary")} maxLength={400} />
      </label>
      <label className="lb-field">
        <span>
          What and why <small>(plain English: how it works today, why it&rsquo;s changing, what&rsquo;s different when done. Markdown works.)</small>
        </span>
        <textarea className="lb-textarea" style={{ minHeight: 160 }} value={f.description} onChange={set("description")} />
      </label>
      <label className="lb-field">
        <span>
          Technical description <small>(for developers and AI assistants: where, current state, what to do, constraints, checks. Markdown.)</small>
        </span>
        <textarea className="lb-textarea mono" style={{ minHeight: 220 }} value={f.technical} onChange={set("technical")} />
      </label>
      <label className="lb-field">
        <span>Steps <small>(one per line)</small></span>
        <textarea className="lb-textarea" value={f.steps} onChange={set("steps")} />
      </label>
      <label className="lb-field">
        <span>Done means <small>(one per line; people tick these off)</small></span>
        <textarea className="lb-textarea" value={f.doneMeans} onChange={set("doneMeans")} />
      </label>
      <label className="lb-field">
        <span>How to check <small>(one per line)</small></span>
        <textarea className="lb-textarea" value={f.howToCheck} onChange={set("howToCheck")} />
      </label>
      <label className="lb-field">
        <span>
          Sign-off notes <small>(what was done, where to look, what&rsquo;s left. Markdown.)</small>
        </span>
        <textarea className="lb-textarea" style={{ minHeight: 120 }} value={f.signOffNotes} onChange={set("signOffNotes")} />
      </label>
      <label className="lb-field">
        <span>Watch out for <small>(one per line)</small></span>
        <textarea className="lb-textarea" value={f.watchOut} onChange={set("watchOut")} />
      </label>
      <label className="lb-field">
        <span>Needs <small>(one per line)</small></span>
        <textarea className="lb-textarea" value={f.needs} onChange={set("needs")} />
      </label>
      <label className="lb-field">
        <span>Files <small>(one per line)</small></span>
        <textarea className="lb-textarea mono" value={f.files} onChange={set("files")} />
      </label>
      <label className="lb-field">
        <span>Related tasks <small>(IDs, e.g. A22, C18)</small></span>
        <input className="lb-input" value={f.related} onChange={set("related")} />
      </label>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: -56, background: "#fff", padding: "12px 0" }}>
        <button type="button" className="lb-ghost" style={{ height: 42 }} onClick={onCancel}>
          Cancel
        </button>
        <button className="lb-primary" disabled={saving || !f.title.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
