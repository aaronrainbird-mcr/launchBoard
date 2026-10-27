"use client";

import { useState } from "react";
import { Bot, Plus, X } from "lucide-react";
import { LANES, LANE_LABEL, type Lane, type When } from "@/lib/types";
import { Avatar, Dot } from "./Avatar";

const LANE_DOT: Record<Lane, string> = { design: "#5BC6E9", build: "#F09336" };

export interface NewTask {
  title: string;
  lane: Lane;
  when: When;
  owners: string[];
  summary: string;
  description: string;
  technical: string;
}

export function AddDialog({ people, onClose, onAdd }: { people: string[]; onClose: () => void; onAdd: (t: NewTask) => Promise<boolean> }) {
  const [d, setD] = useState<NewTask>({ title: "", lane: "build", when: "launch", owners: [], summary: "", description: "", technical: "" });
  const [saving, setSaving] = useState(false);
  const ok = !!d.title.trim() && !saving;

  return (
    <div className="lb-dialog-scrim" onClick={onClose}>
      <div className="lb-dialog" role="dialog" aria-label="Add task" onClick={(e) => e.stopPropagation()}>
        <div className="lb-dialog-head">
          <div style={{ flex: 1 }}>
            <h2>Add task</h2>
            <p>It goes into To do. You can add more detail later with Edit details.</p>
          </div>
          <button className="lb-round" onClick={onClose} aria-label="Close" title="Close">
            <X size={17} />
          </button>
        </div>
        <div className="lb-dialog-body">
          <div className="lb-form">
            <label className="lb-field">
              <span>Title</span>
              <input className="lb-input" style={{ height: 44 }} autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="What needs doing, in a few words" maxLength={200} />
            </label>
            <div className="lb-field">
              <span>Lane</span>
              <div className="lb-opts">
                {LANES.map((l) => (
                  <button key={l} type="button" className={`lb-opt${d.lane === l ? " on" : ""}`} onClick={() => setD({ ...d, lane: l })}>
                    <Dot color={LANE_DOT[l]} />
                    {LANE_LABEL[l]}
                  </button>
                ))}
                <span style={{ width: 12 }} />
                {(["launch", "after"] as const).map((w) => (
                  <button key={w} type="button" className={`lb-opt${d.when === w ? " on" : ""}`} onClick={() => setD({ ...d, when: w })}>
                    {w === "launch" ? "For launch" : "After launch"}
                  </button>
                ))}
              </div>
            </div>
            <div className="lb-field">
              <span>
                Owners <small>(pick one or more, or leave it for someone to take)</small>
              </span>
              <div className="lb-opts">
                {people.map((p) => {
                  const on = d.owners.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`lb-opt person${on ? " on" : ""}`}
                      onClick={() => setD({ ...d, owners: on ? d.owners.filter((x) => x !== p) : [...d.owners, p] })}
                    >
                      <Avatar name={p} people={people} size={28} />
                      {p}
                    </button>
                  );
                })}
                <button type="button" className={`lb-opt person${!d.owners.length ? " on" : ""}`} onClick={() => setD({ ...d, owners: [] })}>
                  <Avatar name={null} people={people} size={28} />
                  No one yet
                </button>
              </div>
            </div>
            <label className="lb-field">
              <span>Summary</span>
              <textarea className="lb-textarea" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} placeholder="One sentence: what it is" maxLength={400} />
            </label>
            <label className="lb-field">
              <span>
                What and why <small>(optional)</small>
              </span>
              <textarea className="lb-textarea" style={{ minHeight: 96 }} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="How it works today, and why it's changing. Paste notes here if you have them." />
            </label>
            <label className="lb-field">
              <span>
                Technical description <small>(optional: files, what to change, how to test)</small>
              </span>
              <textarea className="lb-textarea mono" style={{ minHeight: 96 }} value={d.technical} onChange={(e) => setD({ ...d, technical: e.target.value })} />
            </label>
            <div className="lb-handoff">
              <Bot size={18} style={{ marginTop: 1, flex: "0 0 auto" }} />
              <span>
                Want an AI assistant to add tasks? Point it at <code>/api/guide</code> on this board (or <code>TASKS.md</code> in the board&rsquo;s repo). It explains the format, so tasks arrive with a summary, a description and a technical description already filled in.
              </span>
            </div>
          </div>
        </div>
        <div className="lb-dialog-foot">
          <button className="lb-ghost" style={{ height: 44 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="lb-primary"
            disabled={!ok}
            onClick={async () => {
              setSaving(true);
              try {
                if (await onAdd({ ...d, title: d.title.trim() })) onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            <Plus size={17} />
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
