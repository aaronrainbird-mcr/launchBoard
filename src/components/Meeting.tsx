"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Ban, Sparkles } from "lucide-react";
import { actorName, names, shortTime, STATUS_DOT } from "@/lib/client";
import { STATUSES, STATUS_LABEL, type Comment, type Status, type Task } from "@/lib/types";
import { Avatar, Dot } from "./Avatar";

interface Props {
  tasks: Task[];
  ids: string[];
  comments: Comment[];
  people: string[];
  viewer: string | null;
  onClose: () => void;
  onMove: (id: string, s: Status) => void;
  onToggleOwner: (id: string, name: string | null) => void;
  onComment: (id: string, text: string) => Promise<boolean>;
}

// One card at a time, for walking the board in a meeting.
export function Meeting({ tasks, ids, comments, people, viewer, onClose, onMove, onToggleOwner, onComment }: Props) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const step = (d: number) => {
    setIdx((i) => Math.min(ids.length - 1, Math.max(0, i + d)));
    setText("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const t = tasks.find((x) => x.id === ids[Math.min(idx, ids.length - 1)]);
  if (!t) return null;
  const these = comments.filter((c) => c.taskId === t.id);

  return (
    <div className="lb-meeting">
      <div className="lb-meeting-top">
        <strong style={{ fontSize: 18, fontWeight: 750 }}>Meeting mode</strong>
        <span className="lb-muted" style={{ fontSize: 14 }}>
          Everything not done yet
        </span>
        <span className="lb-spacer" />
        <span style={{ fontSize: 15, fontWeight: 750 }}>
          {idx + 1} of {ids.length}
        </span>
        <button className="lb-ghost" style={{ height: 40, paddingRight: 8 }} onClick={onClose}>
          Leave meeting mode <span className="lb-kbd">Esc</span>
        </button>
      </div>
      <div className="lb-meeting-stage">
        <div className="lb-meeting-card">
          <div className="lb-meeting-main">
            <div>
              <span className={`lb-id huge lane-${t.lane}`}>{t.id}</span>
            </div>
            <h2>{t.title}</h2>
            <p className="sum">{t.summary}</p>
            {t.blocked && (
              <p style={{ margin: 0, color: "var(--wine)", fontWeight: 650, display: "flex", gap: 8, alignItems: "center" }}>
                <Ban size={16} />
                Blocked: {t.blocked}
              </p>
            )}
            {t.addedBy && (
              <p className="lb-prov" style={{ margin: 0, fontSize: 14 }}>
                <Sparkles size={15} />
                Added by {t.addedBy.agent} · asked by {t.addedBy.by}
              </p>
            )}
          </div>
          <div className="lb-meeting-side">
            <div style={{ display: "grid", gap: 8 }}>
              <p className="lb-eyebrow">Status</p>
              <div className="lb-meeting-status">
                {STATUSES.map((s) => (
                  <button key={s} className={t.status === s ? "on" : ""} onClick={() => onMove(t.id, s)}>
                    <Dot color={STATUS_DOT[s]} size={10} />
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <p className="lb-eyebrow">
                Owners · <span style={{ color: "var(--nav)" }}>{names(t.owners) || "No one yet"}</span>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...people, null].map((p) => {
                  const on = p ? t.owners.includes(p) : !t.owners.length;
                  return (
                    <button key={p ?? "none"} title={p ?? "No one yet"} className={`lb-meeting-owner${on ? " on" : ""}`} onClick={() => onToggleOwner(t.id, p)}>
                      <Avatar name={p} people={people} size={40} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <p className="lb-eyebrow">Comments · {these.length}</p>
              {these.slice(-3).map((c) => (
                <div key={c.id} style={{ padding: "9px 12px", borderRadius: 10, background: "#fff", border: "1px solid var(--border)", fontSize: 14, lineHeight: 1.45 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 12.5, color: "var(--dim)" }}>
                    <strong style={{ color: "var(--nav)" }}>{actorName(c.who, c.agent)}</strong> · {shortTime(c.at)}
                  </p>
                  {c.text}
                </div>
              ))}
              <textarea className="lb-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did we agree?" />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="lb-muted" style={{ flex: 1, fontSize: 13 }}>
                  Posts as {viewer ?? "…"}
                </span>
                <button
                  className="lb-dark"
                  disabled={!text.trim()}
                  onClick={async () => {
                    if (await onComment(t.id, text.trim())) setText("");
                  }}
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="lb-meeting-nav">
        <button className="arrow" onClick={() => step(-1)} aria-label="Previous">
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", maxWidth: 700, justifyContent: "center" }}>
          {ids.map((id, i) => (
            <button key={id} title={id} className={`lb-mdot${i === idx ? " on" : ""}`} style={{ width: i === idx ? 22 : 8 }} onClick={() => setIdx(i)} />
          ))}
        </div>
        <button className="arrow next" onClick={() => step(1)} aria-label="Next">
          <ArrowRight size={20} />
        </button>
        <span className="lb-muted" style={{ fontSize: 13, marginLeft: 8 }}>
          Use ← → to move
        </span>
      </div>
    </div>
  );
}
