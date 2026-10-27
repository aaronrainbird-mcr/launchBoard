"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ban, ChevronDown, ChevronRight, Plus, Presentation, Rocket, Search, SearchX, X } from "lucide-react";
import { activityLine, api, ApiError, launchCountdown, STATUS_DOT, type BoardData } from "@/lib/client";
import { STATUSES, STATUS_LABEL, type Activity, type Lane, type LinkKind, type Status, type Task, type TaskPatch } from "@/lib/types";
import { Avatar, Avatars, Dot } from "./Avatar";
import { AddDialog, type NewTask } from "./AddDialog";
import { Card } from "./Card";
import { Meeting } from "./Meeting";
import { Panel } from "./Panel";

const COLS: { id: Status; sub: string; tint: string; grouped: boolean; empty: [string, string] }[] = [
  { id: "todo", sub: "Ready for someone to take", tint: "rgba(91,198,233,.11)", grouped: true, empty: ["Nothing to do here", "New tasks land here."] },
  { id: "doing", sub: "Someone’s on it", tint: "rgba(42,96,117,.07)", grouped: true, empty: ["Nothing in progress", "Take a card from To do to start."] },
  { id: "check", sub: "Someone else confirms it’s done", tint: "rgba(248,212,91,.2)", grouped: false, empty: ["Nothing to check", "When work is ready, move it here so someone else can look it over."] },
  { id: "done", sub: "Checked and finished", tint: "rgba(34,163,75,.08)", grouped: false, empty: ["Nothing done yet", "Checked cards land here."] },
];
const SHORT: Record<Status, string> = { todo: "To do", doing: "Doing", check: "To check", done: "Done" };
const LANE_DOT: Record<Lane, string> = { design: "#5BC6E9", build: "#F09336" };
const POLL_MS = 2000;

interface Toast {
  id: number;
  who: string | null;
  text: string;
  error?: boolean;
}

export function BoardApp() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lane, setLane] = useState<"all" | Lane>("all");
  const [person, setPerson] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [meetingIds, setMeetingIds] = useState<string[] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [arrived, setArrived] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [phoneCol, setPhoneCol] = useState<Status>("doing");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const seqRef = useRef(0);
  const viewerRef = useRef<string | null>(null);
  viewerRef.current = viewer;

  // Remember who you're using the board as, on this browser only.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lb-viewer");
      if (saved) setViewer(saved);
      else setMenu("name");
    } catch {
      setMenu("name");
    }
    // A link such as /#C5 opens that task.
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      setPanelId(hash ? hash.toUpperCase() : null);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    const mq = window.matchMedia("(max-width: 699px)");
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const pickViewer = (name: string) => {
    setViewer(name);
    setMenu(null);
    try {
      localStorage.setItem("lb-viewer", name);
    } catch {
      // Private windows can refuse storage; the pick still works for this visit.
    }
  };

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random();
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.error ? 7000 : 4800);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api<BoardData>("/api/board");
      seqRef.current = Math.max(seqRef.current, data.seq);
      setBoard(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load the board.");
    }
  }, []);

  // Live updates: poll for new activity, toast it, then reload the board.
  const poll = useCallback(async () => {
    try {
      const res = await api<{ seq: number; activity: Activity[] }>(`/api/changes?after=${seqRef.current}`);
      if (res.seq < seqRef.current) {
        // The board was reloaded from a seed file: start again from its history.
        seqRef.current = res.seq;
        await load();
        return;
      }
      if (res.seq === seqRef.current) return;
      const fresh = res.activity.filter((a) => a.seq > seqRef.current);
      seqRef.current = res.seq;
      for (const a of fresh.slice(-3)) {
        const mineToo = a.who === viewerRef.current && !a.agent;
        toast({ who: a.agent ?? a.who, text: `${mineToo ? "You" : a.agent ? `${a.agent} (for ${a.who})` : a.who} ${activityLine(a)}` });
      }
      const last = fresh[fresh.length - 1];
      if (last) {
        setArrived(last.taskId);
        setTimeout(() => setArrived((x) => (x === last.taskId ? null : x)), 3200);
      }
      await load();
    } catch {
      // A missed poll is fine; the next one catches up.
    }
  }, [load, toast]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, poll]);

  // Close menus when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (menu && !(e.target instanceof Element && e.target.closest("[data-menu]"))) setMenu(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || meetingIds) return;
      if (menu) setMenu(null);
      else if (addOpen) setAddOpen(false);
      else if (panelId) openPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openPanel(id: string | null) {
    setPanelId(id);
    setMenu(null);
    history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
  }

  // Runs an API call as the current viewer, then refreshes. Errors become toasts.
  async function act(path: string, method: string, body?: unknown): Promise<boolean> {
    if (!viewer) {
      setMenu("name");
      toast({ who: null, text: "Pick who you are first.", error: true });
      return false;
    }
    try {
      await api(path, { method, body, as: viewer });
      await poll();
      return true;
    } catch (e) {
      toast({ who: null, text: e instanceof ApiError ? e.message : "That didn't work. Try again.", error: true });
      return false;
    }
  }

  const tasks = board?.tasks ?? [];
  const people = board?.people ?? [];
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const commentsFor = useMemo(() => {
    const m = new Map<string, NonNullable<BoardData["comments"]>>();
    for (const c of board?.comments ?? []) m.set(c.taskId, [...(m.get(c.taskId) ?? []), c]);
    return m;
  }, [board]);

  const visible = tasks.filter((t) => {
    if (lane !== "all" && t.lane !== lane) return false;
    if (person && !t.owners.includes(person)) return false;
    if (mine && (!viewer || !t.owners.includes(viewer))) return false;
    if (blockedOnly && !t.blocked) return false;
    const s = q.trim().toLowerCase();
    if (s && !`${t.id} ${t.title} ${t.summary}`.toLowerCase().includes(s)) return false;
    return true;
  });

  const launchTasks = tasks.filter((t) => t.when === "launch");
  const doneN = launchTasks.filter((t) => t.status === "done").length;
  const blockedN = tasks.filter((t) => t.blocked && t.status !== "done").length;
  const laneCounts = (["design", "build"] as const).map((l) => {
    const list = launchTasks.filter((t) => t.lane === l);
    return { l, done: list.filter((t) => t.status === "done").length, total: list.length };
  });

  const toggleOwner = (t: Task, name: string | null) => {
    const owners = name ? (t.owners.includes(name) ? t.owners.filter((o) => o !== name) : [...t.owners, name]) : [];
    void act(`/api/tasks/${t.id}/owners`, "PUT", { owners });
  };
  const move = (id: string, status: Status) => void act(`/api/tasks/${id}/move`, "POST", { status });

  const panelTask = panelId ? byId.get(panelId) : undefined;

  function renderCard(t: Task, groupPerson?: string | null) {
    return (
      <Card
        key={t.id}
        task={t}
        comments={commentsFor.get(t.id) ?? []}
        people={people}
        groupPerson={groupPerson}
        phone={phone}
        arrived={arrived === t.id}
        dragging={dragId === t.id}
        menuOpen={menu === `card:${t.id}`}
        onOpen={() => openPanel(t.id)}
        onTake={() => void act(`/api/tasks/${t.id}/take`, "POST")}
        onToggleMenu={() => setMenu(menu === `card:${t.id}` ? null : `card:${t.id}`)}
        onToggleOwner={(n) => toggleOwner(t, n)}
        onMove={(s) => move(t.id, s)}
        onDragStart={() => {
          setDragId(t.id);
          setMenu(null);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOver(null);
        }}
      />
    );
  }

  function renderGroup(key: string, list: Task[], head: { name: string; owners: string[] } | null, groupPerson?: string | null) {
    const open = !collapsed[key];
    return (
      <div key={key} className="lb-group">
        {head && (
          <button className="lb-group-head" onClick={() => setCollapsed({ ...collapsed, [key]: open })} title={open ? "Hide these cards" : "Show these cards"}>
            {head.owners.length ? <Avatars names={head.owners} people={people} /> : <Avatar name={null} people={people} size={22} />}
            <strong>{head.name}</strong>
            <span className="n">{list.length}</span>
            {open ? <ChevronDown size={14} color="#66768A" /> : <ChevronRight size={14} color="#66768A" />}
          </button>
        )}
        {open && (
          <div className="lb-cards">
            {list.map((t) => renderCard(t, groupPerson))}
          </div>
        )}
      </div>
    );
  }

  const columns = (phone ? COLS.filter((c) => c.id === phoneCol) : COLS).map((c) => {
    const inCol = visible.filter((t) => t.status === c.id);
    let groups: React.ReactNode[] = [];
    if (inCol.length && !c.grouped) groups = [renderGroup(`${c.id}:all`, inCol, null)];
    else if (inCol.length) {
      groups = [...people, null]
        .map((o) => {
          const list = inCol.filter((t) => (o ? t.owners.includes(o) : !t.owners.length));
          return list.length ? renderGroup(`${c.id}:${o ?? "none"}`, list, { name: o ?? "Not taken yet", owners: o ? [o] : [] }, o) : null;
        })
        .filter(Boolean);
    }
    return (
      <section
        key={c.id}
        className={`lb-col${over === c.id && dragId ? " over" : ""}`}
        style={{ background: c.tint, borderTopColor: STATUS_DOT[c.id] }}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          if (over !== c.id) setOver(c.id);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          if (over === c.id) setOver(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = dragId;
          setDragId(null);
          setOver(null);
          if (id && byId.get(id)?.status !== c.id) move(id, c.id);
        }}
        aria-label={STATUS_LABEL[c.id]}
      >
        {!phone && (
          <div className="lb-col-head">
            <div className="lb-col-title">
              <Dot color={STATUS_DOT[c.id]} size={10} />
              <h2>{STATUS_LABEL[c.id]}</h2>
              <span className="lb-col-n">{inCol.length}</span>
            </div>
            <span className="lb-col-sub">{c.sub}</span>
          </div>
        )}
        {groups}
        {!inCol.length && (
          <div className="lb-col-empty">
            <strong>{c.empty[0]}</strong>
            {c.empty[1]}
          </div>
        )}
      </section>
    );
  });

  const laneChips = (
    <>
      {(["all", "design", "build"] as const).map((l) => (
        <button key={l} className={`lb-chip${lane === l ? " on" : ""}`} onClick={() => setLane(l)}>
          {l !== "all" && <Dot color={LANE_DOT[l]} size={8} />}
          {l === "all" ? "All" : l === "design" ? "Design" : "Build"}
        </button>
      ))}
    </>
  );
  const personChips = (
    <>
      {people.map((p) => {
        const look = person === p;
        return (
          <button
            key={p}
            title={p}
            className={`lb-person-chip${look ? " on" : ""}${person && !look ? " faded" : ""}`}
            style={{ padding: 0, background: "transparent" }}
            onClick={() => {
              setPerson(look ? null : p);
              setMine(false);
            }}
          >
            <Avatar name={p} people={people} size={34} />
          </button>
        );
      })}
      <button
        className="lb-mine"
        onClick={() => {
          setMine(!mine);
          setPerson(null);
        }}
      >
        <span className={`lb-toggle${mine ? " on" : ""}`}>
          <span />
        </span>
        Mine
      </button>
    </>
  );

  return (
    <div className="lb-root">
      <header className={`lb-top${viewer ? "" : " asking"}`}>
        <a href="/" className="lb-brand" onClick={(e) => e.preventDefault()}>
          <svg width="36" height="31" viewBox="0 0 52 45" fill="none" aria-hidden="true">
            <path d="M37.6473 0C24.2175 0 23.4552.762 23.4552 14.196v5.359c0 13.433.762 14.196 14.192 14.196h1.638L31.499 44.743c16.7 0 20.338-3.639 20.338-20.344V14.196C51.839.762 51.077 0 37.647 0Z" fill="#213350" />
            <path d="M9.818 2.796C.527 2.796 0 3.323 0 12.617v7.06c0 11.557 2.518 14.074 14.07 14.074l-5.386-7.609h1.134c9.291 0 9.818-.527 9.818-9.82v-3.709c0-9.293-.527-9.82-9.818-9.82Z" fill="#213350" />
          </svg>
          <span>
            <strong>Launch Board</strong>
            <small className="lb-desktop-only">SEI team · the new intranet</small>
          </span>
        </a>
        <label className="lb-search lb-desktop-only">
          <Search size={17} className="lb-icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
          {q && (
            <button onClick={() => setQ("")} title="Clear search" style={{ border: 0, background: "none", padding: 2, display: "grid", color: "#66768A" }}>
              <X size={16} />
            </button>
          )}
        </label>
        <span className="lb-spacer" />
        <div className="lb-menu-wrap" data-menu>
          <button className={`lb-pill-btn${viewer ? "" : " ask"}`} onClick={() => setMenu(menu === "name" ? null : "name")}>
            <Avatar name={viewer} people={people} size={30} />
            {viewer ? (
              <span className="lb-desktop-only">
                Using as <strong style={{ fontWeight: 750 }}>{viewer}</strong>
              </span>
            ) : (
              <>
                <span className="lb-desktop-only">Pick who you are first</span>
                <span className="lb-phone-only">Who are you?</span>
              </>
            )}
            <ChevronDown size={15} />
          </button>
          {menu === "name" && (
            <div className="lb-menu right" style={{ width: 300, padding: 14, gap: 10 }}>
              <p className="lb-menu-label" style={{ margin: 0 }}>
                People
              </p>
              <div style={{ display: "grid", gap: 2 }}>
                {people.map((p) => (
                  <button key={p} className="lb-menu-item" onClick={() => pickViewer(p)}>
                    <Avatar name={p} people={people} size={32} />
                    <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                      <strong style={{ fontWeight: 700, fontSize: 14.5 }}>{p}</strong>
                      <small className="lb-muted" style={{ fontSize: 12.5 }}>
                        Owns {tasks.filter((t) => t.owners.includes(p) && t.status !== "done").length} open tasks
                      </small>
                    </span>
                    {p === viewer && <span className="lb-you">You</span>}
                  </button>
                ))}
              </div>
              <p className="lb-menu-note">Pick who you are. It&rsquo;s a label on what you change, not a login.</p>
            </div>
          )}
        </div>
        <button className="lb-primary" onClick={() => setAddOpen(true)} aria-label="Add task">
          <Plus size={18} />
          <span className="lb-desktop-only">Add task</span>
        </button>
      </header>

      <div className="lb-strip">
        <span className="lb-strip-launch">
          <Rocket size={16} color="#2A6075" />
          {launchCountdown()}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span className="lb-bar">
            <span style={{ width: `${launchTasks.length ? Math.round((doneN / launchTasks.length) * 100) : 0}%` }} />
          </span>
          <span className="lb-muted" style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>
            <span className="lb-strong">
              {doneN} of {launchTasks.length}
            </span>{" "}
            launch tasks done
          </span>
        </span>
        <span className="lb-desktop-only" style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          {laneCounts.map(({ l, done, total }) => (
            <span key={l} className="lb-count">
              <Dot color={LANE_DOT[l]} size={8} />
              {l === "design" ? "Design" : "Build"}{" "}
              <strong className="lb-strong" style={{ fontWeight: 700 }}>
                {done} of {total}
              </strong>
            </span>
          ))}
        </span>
        {blockedN > 0 && (
          <button className="lb-warn-chip" onClick={() => setBlockedOnly(!blockedOnly)} title="Show only blocked tasks">
            <Ban size={13} />
            Blocked: {blockedN}
            {blockedOnly && " · showing"}
          </button>
        )}
        <span className="lb-spacer" />
        <button
          className="lb-text-btn lb-desktop-only"
          onClick={() => {
            const ids = visible.filter((t) => t.status !== "done").map((t) => t.id);
            if (ids.length) setMeetingIds(ids);
          }}
        >
          <Presentation size={16} />
          Meeting mode
        </button>
      </div>

      <main className="lb-main">
        <div className="lb-filters lb-desktop-only">
          <div className="lb-filter-group">
            <span className="lb-filter-label">Lane</span>
            {laneChips}
          </div>
          <div className="lb-filter-group">
            <span className="lb-filter-label">Person</span>
            {personChips}
          </div>
        </div>

        <div className="lb-phone-tools lb-phone-only">
          <label className="lb-search">
            <Search size={17} className="lb-icon" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
          </label>
          <div className="lb-phone-chips">
            {laneChips}
            <span style={{ width: 1, height: 24, background: "var(--border)", flex: "0 0 auto", margin: "0 4px" }} />
            {personChips}
          </div>
          <div className="lb-tabs">
            {STATUSES.map((s) => (
              <button key={s} className={phoneCol === s ? "on" : ""} onClick={() => setPhoneCol(s)}>
                <strong>{visible.filter((t) => t.status === s).length}</strong>
                <span>{SHORT[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {!board && !loadError && <p className="lb-muted">Loading the board…</p>}
        {loadError && (
          <div className="lb-no-results">
            <h3>Couldn&rsquo;t load the board</h3>
            <p>{loadError}</p>
          </div>
        )}
        {board && visible.length > 0 && <div className="lb-columns">{columns}</div>}
        {board && visible.length === 0 && (
          <div className="lb-no-results">
            <SearchX size={30} color="#2A6075" />
            <h3>{tasks.length ? "No tasks match these filters" : "The board is empty"}</h3>
            <p>{tasks.length ? "Nothing on the board matches. Try another lane or person, or clear the filters." : "Add the first task, or load the launch tasks with npm run seed."}</p>
            {tasks.length > 0 && (
              <button
                className="lb-dark"
                style={{ height: 42 }}
                onClick={() => {
                  setLane("all");
                  setPerson(null);
                  setMine(false);
                  setBlockedOnly(false);
                  setQ("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </main>

      <div className="lb-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`lb-toast${t.error ? " error" : ""}`}>
            {t.who && <Avatar name={t.who} people={people} size={26} />}
            <span>
              {t.text}
              {!t.error && <span className="lb-muted"> · just now</span>}
            </span>
          </div>
        ))}
      </div>

      {panelTask && (
        <Panel
          key={panelTask.id}
          task={panelTask}
          comments={commentsFor.get(panelTask.id) ?? []}
          activity={(board?.activity ?? []).filter((a) => a.taskId === panelTask.id).reverse()}
          people={people}
          viewer={viewer}
          phone={phone}
          actions={{
            move: async (s) => void (await act(`/api/tasks/${panelTask.id}/move`, "POST", { status: s })),
            take: async () => void (await act(`/api/tasks/${panelTask.id}/take`, "POST")),
            toggleOwner: async (n) => toggleOwner(panelTask, n),
            check: async () => void (await act(`/api/tasks/${panelTask.id}/check`, "POST")),
            tick: async (index, done) => void (await act(`/api/tasks/${panelTask.id}/ticks`, "POST", { index, done })),
            patch: (patch: TaskPatch) => (Object.keys(patch).length ? act(`/api/tasks/${panelTask.id}`, "PATCH", patch) : Promise.resolve(true)),
            addLink: (kind: LinkKind, url: string, label: string) => act(`/api/tasks/${panelTask.id}/links`, "POST", { kind, url, label }),
            removeLink: async (id) => void (await act(`/api/tasks/${panelTask.id}/links?link=${encodeURIComponent(id)}`, "DELETE")),
            comment: (text) => act(`/api/tasks/${panelTask.id}/comments`, "POST", { text }),
            copyBrief: async () => {
              try {
                const md = await api<string>(`/api/tasks/${panelTask.id}/brief`);
                await navigator.clipboard.writeText(md);
                toast({ who: null, text: `Copied the brief for ${panelTask.id}. Paste it into Claude Code or Codex.` });
              } catch {
                toast({ who: null, text: "Couldn't copy. Open /api/tasks/" + panelTask.id + "/brief instead.", error: true });
              }
            },
            close: () => openPanel(null),
          }}
        />
      )}

      {addOpen && (
        <AddDialog
          people={people}
          onClose={() => setAddOpen(false)}
          onAdd={async (t: NewTask) => {
            const body: Record<string, unknown> = { title: t.title, lane: t.lane, when: t.when, owners: t.owners };
            if (t.summary.trim()) body.summary = t.summary.trim();
            if (t.description.trim()) body.description = t.description.trim();
            if (t.technical.trim()) body.technical = t.technical.trim();
            const ok = await act("/api/tasks", "POST", body);
            if (ok) setPhoneCol("todo");
            return ok;
          }}
        />
      )}

      {meetingIds && board && (
        <Meeting
          tasks={tasks}
          ids={meetingIds}
          comments={board.comments}
          people={people}
          viewer={viewer}
          onClose={() => setMeetingIds(null)}
          onMove={move}
          onToggleOwner={(id, n) => {
            const t = byId.get(id);
            if (t) toggleOwner(t, n);
          }}
          onComment={(id, text) => act(`/api/tasks/${id}/comments`, "POST", { text })}
        />
      )}
    </div>
  );
}
