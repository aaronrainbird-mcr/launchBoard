"use client";

import { Ban, BadgeCheck, Check, Ellipsis, Hand, Link2, MessageCircle, PanelRightOpen, Sparkles, ArrowRightLeft } from "lucide-react";
import { names } from "@/lib/client";
import { STATUSES, STATUS_LABEL, type Comment, type Status, type Task } from "@/lib/types";
import { Avatar, Avatars } from "./Avatar";

interface Props {
  task: Task;
  comments: Comment[];
  people: string[];
  // When the card sits under a person's group heading, that person isn't repeated.
  groupPerson?: string | null;
  phone: boolean;
  arrived: boolean;
  dragging: boolean;
  menuOpen: boolean;
  onOpen: () => void;
  onTake: () => void;
  onToggleMenu: () => void;
  onToggleOwner: (name: string | null) => void;
  onMove: (status: Status) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function Card(p: Props) {
  const { task: t, people } = p;
  const last = p.comments[p.comments.length - 1];
  const noOwner = !t.owners.length && (t.status === "todo" || t.status === "doing");
  const shown = p.groupPerson ? t.owners.filter((o) => o !== p.groupPerson) : t.owners;
  const linkCount = t.links.length;

  return (
    <article
      className={`lb-card${p.arrived ? " arrived" : ""}${p.dragging ? " dragging" : ""}`}
      draggable={!p.phone}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        p.onDragStart();
      }}
      onDragEnd={p.onDragEnd}
      onClick={p.onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) p.onOpen();
      }}
      tabIndex={0}
      aria-label={`${t.id}: ${t.title}`}
    >
      <div className="lb-card-body">
        <div className="lb-card-top">
          <h3>
            <span className={`lb-id lane-${t.lane}`}>{t.id}</span>
            {t.title}
          </h3>
          <div className="lb-menu-wrap" data-menu onClick={(e) => e.stopPropagation()}>
            <button className="lb-card-more" title="More" aria-label="More" onClick={p.onToggleMenu}>
              <Ellipsis size={17} />
            </button>
            {p.menuOpen && (
              <div className="lb-menu right" style={{ top: 30, width: 232 }}>
                <p className="lb-menu-label">Owners</p>
                {people.map((name) => (
                  <button key={name} className="lb-menu-item" onClick={() => p.onToggleOwner(name)}>
                    <Avatar name={name} people={people} size={24} />
                    <span style={{ flex: 1 }}>{name}</span>
                    {t.owners.includes(name) && <Check size={15} color="#2A6075" />}
                  </button>
                ))}
                <button className="lb-menu-item" onClick={() => p.onToggleOwner(null)}>
                  <Avatar name={null} people={people} size={24} />
                  <span style={{ flex: 1 }}>No one yet</span>
                  {!t.owners.length && <Check size={15} color="#2A6075" />}
                </button>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <button className="lb-menu-item" onClick={p.onOpen}>
                  <PanelRightOpen size={16} color="#2A6075" />
                  Open details
                </button>
              </div>
            )}
          </div>
        </div>

        {t.addedBy && (
          <span className="lb-prov">
            <Sparkles size={12} />
            Added by {t.addedBy.agent} · asked by {t.addedBy.by}
          </span>
        )}

        {(t.blocked || t.checkedBy || t.when === "after" || t.cutFirst) && (
          <div className="lb-badges">
            {t.blocked && (
              <span className="lb-badge blocked" title={t.blocked}>
                <Ban size={12} />
                Blocked: {t.blocked.length > 60 ? `${t.blocked.slice(0, 57)}…` : t.blocked}
              </span>
            )}
            {t.checkedBy && (
              <span className="lb-badge checked">
                <BadgeCheck size={12} />
                Checked by {t.checkedBy.by}
              </span>
            )}
            {t.when === "after" && <span className="lb-badge after">After launch</span>}
            {t.cutFirst && t.status !== "done" && <span className="lb-badge cut">Cut first if short of time</span>}
          </div>
        )}

        {last && (
          <div className="lb-last">
            <Avatar name={last.agent ?? last.who} people={people} size={20} />
            <p>
              <strong>{last.agent ? `${last.agent} (for ${last.who})` : last.who}</strong> {last.text}
            </p>
          </div>
        )}

        <div className="lb-card-foot">
          {shown.length > 0 && (
            <span className="lb-owners-line">
              <Avatars names={shown} people={people} size={22} />
              <span className="names">{p.groupPerson ? `with ${names(shown)}` : names(shown)}</span>
            </span>
          )}
          {noOwner && (
            <button
              className="lb-dark"
              style={{ height: 32, fontSize: 13.5, padding: "0 13px" }}
              onClick={(e) => {
                e.stopPropagation();
                p.onTake();
              }}
            >
              <Hand size={14} />
              Take this
            </button>
          )}
          <span className="lb-spacer" />
          {linkCount > 0 && (
            <span className="lb-mini links" title={`${linkCount} link${linkCount === 1 ? "" : "s"}`}>
              <Link2 size={13} />
              {linkCount}
            </span>
          )}
          {p.comments.length > 0 && (
            <span className="lb-mini comments" title={`${p.comments.length} comment${p.comments.length === 1 ? "" : "s"}`}>
              <MessageCircle size={13} />
              {p.comments.length}
            </span>
          )}
        </div>

        {p.phone && (
          <label className="lb-phone-move" onClick={(e) => e.stopPropagation()}>
            <ArrowRightLeft size={15} />
            Move to
            <select value={t.status} onChange={(e) => p.onMove(e.target.value as Status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </article>
  );
}
