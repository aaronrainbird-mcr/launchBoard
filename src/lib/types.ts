// The board's data model. The browser, the API and both stores share these types.

export const LANES = ["design", "build"] as const;
export type Lane = (typeof LANES)[number];

export const STATUSES = ["todo", "doing", "check", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const WHENS = ["launch", "after"] as const;
export type When = (typeof WHENS)[number];

export const SIZES = ["S", "M", "L"] as const;
export type Size = (typeof SIZES)[number];

export const LINK_KINDS = ["pr", "preview", "design", "doc", "other"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface Link {
  id: string;
  kind: LinkKind;
  label: string;
  url: string;
  addedBy: string;
  at: string;
}

export interface Tick {
  text: string;
  done: boolean;
}

// Who made a change. `agent` is set when an AI assistant made it for `name`.
export interface Actor {
  name: string;
  agent?: string;
}

export interface Task {
  id: string;
  lane: Lane;
  group: string;
  title: string;
  status: Status;
  owners: string[];
  when: When;
  size: Size | null;
  cutFirst: boolean;
  blocked: string;

  summary: string;
  description: string;
  technical: string;
  steps: string[];
  doneMeans: Tick[];
  howToCheck: string[];
  watchOut: string[];
  needs: string[];
  files: string[];
  related: string[];
  links: Link[];
  signOffNotes: string;

  addedBy: { agent: string; by: string; at: string } | null;
  checkedBy: { by: string; at: string } | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Comment {
  id: string;
  taskId: string;
  who: string;
  agent: string | null;
  text: string;
  at: string;
}

export interface Activity {
  seq: number;
  taskId: string;
  who: string;
  agent: string | null;
  text: string;
  at: string;
}

export interface Board {
  tasks: Task[];
  comments: Comment[];
  activity: Activity[];
  seq: number;
}

// Fields a person or agent may change with PATCH.
export const EDITABLE_FIELDS = [
  "title",
  "lane",
  "group",
  "when",
  "size",
  "cutFirst",
  "blocked",
  "summary",
  "description",
  "technical",
  "steps",
  "doneMeans",
  "howToCheck",
  "watchOut",
  "needs",
  "files",
  "related",
  "signOffNotes",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type TaskPatch = Partial<Pick<Task, EditableField>>;

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  doing: "In progress",
  check: "Ready to check",
  done: "Done",
};

export const LANE_LABEL: Record<Lane, string> = {
  design: "Design",
  build: "Build",
};

export const LINK_LABEL: Record<LinkKind, string> = {
  pr: "Pull request",
  preview: "Preview",
  design: "Design file",
  doc: "Document",
  other: "Link",
};
