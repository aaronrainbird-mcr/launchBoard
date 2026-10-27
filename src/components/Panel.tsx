"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bot,
  Check,
  ChevronDown,
  ClipboardCopy,
  ExternalLink,
  Hand,
  ListChecks,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { actorName, names, shortTime, STATUS_DOT } from "@/lib/client";
import {
  LANE_LABEL,
  LINK_KINDS,
  LINK_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Activity,
  type Comment,
  type LinkKind,
  type Status,
  type Task,
  type TaskPatch,
} from "@/lib/types";
import { Avatar, Avatars, Dot } from "./Avatar";
import { CommentText, Markdown } from "./Markdown";
import { EditForm } from "./EditForm";

export interface PanelActions {
  move: (status: Status) => Promise<void>;
  take: () => Promise<void>;
  toggleOwner: (name: string | null) => Promise<void>;
  check: () => Promise<void>;
  tick: (index: number, done: boolean) => Promise<void>;
  patch: (patch: TaskPatch) => Promise<boolean>;
  addLink: (kind: LinkKind, url: string, label: string) => Promise<boolean>;
  removeLink: (id: string) => Promise<void>;
  comment: (text: string) => Promise<boolean>;
  copyBrief: () => Promise<void>;
  close: () => void;
}

interface Props {
  task: Task;
  comments: Comment[];
  activity: Activity[];
  people: string[];
  viewer: string | null;
  phone: boolean;
  actions: PanelActions;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="lb-list">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

function Section({ label, children, first, extra }: { label: string; children: React.ReactNode; first?: boolean; extra?: React.ReactNode }) {
  return (
    <section className={`lb-sec${first ? " first" : ""}`}>
      <p className="lb-eyebrow">
        {label}
        {extra && (
          <>
            <span className="lb-spacer" />
            {extra}
          </>
        )}
      </p>
      {children}
    </section>
  );
}

export function Panel({ task: t, comments, activity, people, viewer, phone, actions }: Props) {
  const [menu, setMenu] = useState<null | "status" | "owners">(null);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [link, setLink] = useState<{ kind: LinkKind; url: string; label: string }>({ kind: "pr", url: "", label: "" });

  const isOwner = !!viewer && t.owners.includes(viewer);
  const who = names(t.owners);
  const unowned = !t.owners.length && (t.status === "todo" || t.status === "doing");

  const checkText = isOwner
    ? "You're an owner, so someone else looks it over and marks it done."
    : `${who || "The owner"} ${t.owners.length > 1 ? "say" : "says"} this is ready. Read the sign-off notes, look it over, then mark it done. Leave a comment if something needs fixing.`;

  const signOff = t.signOffNotes ? (
    <Section label="Sign-off notes">
      <Markdown text={t.signOffNotes} />
    </Section>
  ) : null;
  const howToCheck = t.howToCheck.length ? (
    <Section label="How to check">
      <List items={t.howToCheck} />
    </Section>
  ) : null;
  const inCheck = t.status === "check";

  return (
    <>
      {!phone && <div className="lb-scrim" onClick={actions.close} />}
      <aside className="lb-panel" aria-label={`${t.id}: ${t.title}`}>
        <div className="lb-panel-head">
          {phone && (
            <button className="lb-round" style={{ border: 0, marginLeft: -10 }} onClick={actions.close} aria-label="Back to the board">
              <ArrowLeft size={19} />
            </button>
          )}
          <span className={`lb-id big lane-${t.lane}`}>{t.id}</span>
          <span className="lb-muted" style={{ fontSize: 14, fontWeight: 650 }}>
            {LANE_LABEL[t.lane]}
            {t.group ? ` · ${t.group}` : ""}
          </span>
          <span className="lb-spacer" />
          {!phone && (
            <button className="lb-round" onClick={actions.close} aria-label="Close" title="Close">
              <X size={17} />
            </button>
          )}
        </div>

        <div className="lb-panel-body">
          <h2 className="title">{t.title}</h2>
          {t.addedBy && (
            <p className="lb-prov" style={{ margin: 0, fontSize: 13 }}>
              <Sparkles size={14} />
              Added by {t.addedBy.agent} · asked by {t.addedBy.by} · {shortTime(t.addedBy.at)}
            </p>
          )}

          <div className="lb-controls">
            <div className="lb-menu-wrap" data-menu>
              <button className="lb-ctl" onClick={() => setMenu(menu === "status" ? null : "status")}>
                <Dot color={STATUS_DOT[t.status]} size={10} />
                <strong style={{ fontWeight: 700 }}>{STATUS_LABEL[t.status]}</strong>
                <ChevronDown size={14} color="#66768A" />
              </button>
              {menu === "status" && (
                <div className="lb-menu left" style={{ width: 210, top: "calc(100% + 6px)" }}>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      className="lb-menu-item"
                      onClick={() => {
                        setMenu(null);
                        void actions.move(s);
                      }}
                    >
                      <Dot color={STATUS_DOT[s]} />
                      <span style={{ flex: 1 }}>{STATUS_LABEL[s]}</span>
                      {t.status === s && <Check size={15} color="#2A6075" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="lb-menu-wrap" data-menu>
              <button className="lb-ctl person" onClick={() => setMenu(menu === "owners" ? null : "owners")}>
                <Avatars names={t.owners} people={people} size={26} />
                <span className="lb-muted">{t.owners.length > 1 ? "Owners" : "Owner"}</span>
                <strong style={{ fontWeight: 700 }}>{who || "No one yet"}</strong>
                <ChevronDown size={14} color="#66768A" />
              </button>
              {menu === "owners" && (
                <div className="lb-menu left" style={{ width: 220, top: "calc(100% + 6px)" }}>
                  {[...people, null].map((n) => (
                    <button key={n ?? "none"} className="lb-menu-item" onClick={() => void actions.toggleOwner(n)}>
                      <Avatar name={n} people={people} size={24} />
                      <span style={{ flex: 1 }}>{n ?? "No one yet"}</span>
                      {(n ? t.owners.includes(n) : !t.owners.length) && <Check size={15} color="#2A6075" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {unowned && (
              <button className="lb-dark" style={{ height: 38 }} onClick={() => void actions.take()}>
                <Hand size={15} />
                Take this
              </button>
            )}
            <span className="lb-spacer" />
            <button className="lb-ghost" style={{ height: 38 }} onClick={() => setEditing(!editing)}>
              <Pencil size={15} />
              {editing ? "Stop editing" : "Edit details"}
            </button>
          </div>

          {t.blocked && (
            <div className="lb-callout blocked">
              <div className="lb-callout-row">
                <Ban size={18} style={{ marginTop: 1, flex: "0 0 auto" }} />
                <div>
                  <strong>Blocked.</strong> {t.blocked}
                </div>
              </div>
            </div>
          )}

          {inCheck && (
            <div className="lb-callout check">
              <div className="lb-callout-row">
                <ListChecks size={18} color="#5e4c07" style={{ marginTop: 1, flex: "0 0 auto" }} />
                <div style={{ display: "grid", gap: 2 }}>
                  <strong style={{ fontSize: 15.5, fontWeight: 750 }}>Ready to check</strong>
                  <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{checkText}</span>
                </div>
              </div>
              {!isOwner && viewer && (
                <button className="lb-dark" style={{ justifySelf: "start", height: 42, fontSize: 15 }} onClick={() => void actions.check()}>
                  <BadgeCheck size={17} />
                  I&rsquo;ve checked it: mark as done
                </button>
              )}
            </div>
          )}
          {t.checkedBy && (
            <div className="lb-callout done">
              <BadgeCheck size={18} />
              Checked by {t.checkedBy.by} · {shortTime(t.checkedBy.at)}
            </div>
          )}

          {editing ? (
            <EditForm
              task={t}
              onCancel={() => setEditing(false)}
              onSave={async (patch) => {
                if (await actions.patch(patch)) setEditing(false);
              }}
            />
          ) : (
            <>
              <Section label="Summary" first>
                <p className="lb-summary">{t.summary || "No summary yet."}</p>
              </Section>

              {t.description && (
                <Section label="What and why">
                  <Markdown text={t.description} />
                </Section>
              )}

              {inCheck && signOff}
              {inCheck && howToCheck}

              <Section label="Links">
                {t.links.length > 0 && (
                  <div className="lb-links">
                    {t.links.map((l) => (
                      <div key={l.id} className="lb-link">
                        <span className="kind">{LINK_LABEL[l.kind]}</span>
                        <a className="label" href={l.url} target="_blank" rel="noreferrer noopener" title={l.url}>
                          {l.label} <ExternalLink size={13} color="#66768A" style={{ verticalAlign: -1 }} />
                        </a>
                        <button className="rm" title="Remove link" aria-label={`Remove ${l.label}`} onClick={() => void actions.removeLink(l.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  className="lb-link-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await actions.addLink(link.kind, link.url.trim(), link.label.trim())) {
                      setLink({ kind: link.kind, url: "", label: "" });
                    }
                  }}
                >
                  <select className="lb-select" value={link.kind} onChange={(e) => setLink({ ...link, kind: e.target.value as LinkKind })} aria-label="Kind of link">
                    {LINK_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {LINK_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input className="lb-input" placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} aria-label="Web address" />
                  <input className="lb-input" placeholder="Label (optional)" value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} aria-label="Label" />
                  <button className="lb-ghost" style={{ height: 40 }} disabled={!link.url.trim()}>
                    Add
                  </button>
                </form>
              </Section>

              {t.steps.length > 0 && (
                <Section label="Steps">
                  <ol className="lb-list">
                    {t.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </Section>
              )}

              {t.doneMeans.length > 0 && (
                <Section label="Done means" extra={<span className="lb-muted" style={{ letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>{t.doneMeans.filter((d) => d.done).length} of {t.doneMeans.length}</span>}>
                  <div className="lb-ticks">
                    {t.doneMeans.map((d, i) => (
                      <label key={i} className={`lb-tick${d.done ? " done" : ""}`}>
                        <input type="checkbox" checked={d.done} onChange={(e) => void actions.tick(i, e.target.checked)} />
                        <span>{d.text}</span>
                      </label>
                    ))}
                  </div>
                </Section>
              )}

              {!inCheck && howToCheck}
              {!inCheck && signOff}

              {t.watchOut.length > 0 && (
                <Section label="Watch out for">
                  <List items={t.watchOut} />
                </Section>
              )}
              {t.needs.length > 0 && (
                <Section label="Needs">
                  <List items={t.needs} />
                </Section>
              )}
              {t.related.length > 0 && (
                <Section label="Related">
                  <p style={{ margin: 0 }}>{t.related.join(", ")}</p>
                </Section>
              )}

              <section className="lb-sec">
                <div className="lb-handoff">
                  <Bot size={18} style={{ marginTop: 1, flex: "0 0 auto" }} />
                  <div style={{ flex: 1, display: "grid", gap: 8 }}>
                    <span>
                      <strong>Working with an AI assistant?</strong> Copy the brief: it has everything on this card, including the technical description, in one Markdown document. Paste it into Claude Code or Codex.
                    </span>
                    <button className="lb-dark" style={{ justifySelf: "start" }} onClick={() => void actions.copyBrief()}>
                      <ClipboardCopy size={15} />
                      Copy brief
                    </button>
                  </div>
                </div>
                <details className="lb-tech" open={!!t.technical && !phone}>
                  <summary>
                    <Bot size={17} color="#2A6075" />
                    Technical description
                    <span className="lb-muted" style={{ fontWeight: 500, fontSize: 13.5 }}>for developers and AI assistants</span>
                  </summary>
                  <div className="inner">
                    {t.technical ? <Markdown text={t.technical} className="lb-prose tech" /> : <p className="lb-muted" style={{ margin: 0 }}>Nothing written yet. Use Edit details to add one.</p>}
                  </div>
                </details>
                {t.files.length > 0 && (
                  <details className="lb-tech">
                    <summary>
                      Files
                      <span className="lb-muted" style={{ fontWeight: 500, fontSize: 13.5 }}>{t.files.length}</span>
                    </summary>
                    <div className="inner">
                      <ul className="lb-files">
                        {t.files.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )}
              </section>
            </>
          )}

          <section className="lb-sec" style={{ marginTop: 26 }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 750 }}>
              Comments <span className="lb-mini comments">{comments.length}</span>
            </h3>
            {comments.map((c) => (
              <div key={c.id} className="lb-comment">
                <Avatar name={c.agent ?? c.who} people={people} size={30} />
                <div className="bubble">
                  <p className="meta">
                    <strong>{actorName(c.who, c.agent)}</strong> · {shortTime(c.at)}
                  </p>
                  <CommentText text={c.text} people={people} />
                </div>
              </div>
            ))}
            {!comments.length && <p className="lb-muted" style={{ margin: 0 }}>No comments yet.</p>}
            <div className="lb-comment" style={{ marginTop: 4 }}>
              <Avatar name={viewer} people={people} size={30} />
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
                <textarea
                  className="lb-textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment. Use @ to mention someone."
                />
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {people
                    .filter((n) => n !== viewer)
                    .map((n) => (
                      <button key={n} className="lb-mention-btn" onClick={() => setComment((c) => `${c ? c.replace(/\s*$/, " ") : ""}@${n} `)}>
                        @{n}
                      </button>
                    ))}
                  <span className="lb-spacer" />
                  <button
                    className="lb-dark"
                    disabled={!comment.trim()}
                    onClick={async () => {
                      if (await actions.comment(comment.trim())) setComment("");
                    }}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 30, display: "grid", gap: 2 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 750 }}>Activity</h3>
            {activity.map((a) => (
              <div key={a.seq} className="lb-activity">
                <Avatar name={a.agent ?? a.who} people={people} size={24} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{actorName(a.who, a.agent)}</strong> {a.text}
                </span>
                <span className="when">{shortTime(a.at)}</span>
              </div>
            ))}
          </section>
        </div>
      </aside>
    </>
  );
}
