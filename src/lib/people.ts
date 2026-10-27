// The team, and how each person's avatar looks. BOARD_PEOPLE overrides the
// list (comma separated); people not listed below get a palette colour.

const DEFAULT_PEOPLE = ["Aaron", "Abdulmuiz", "Colin", "Nick", "Skye"];

const NAV = "#213350";
const TEAL = "#2A6075";
const WINE = "#751B48";

const KNOWN: Record<string, [string, string, string]> = {
  Aaron: ["Aa", "#c9ecf8", NAV],
  Abdulmuiz: ["Ab", "#fbdcbc", "#6b3606"],
  Colin: ["Co", "#fcefc0", "#5e4c07"],
  Nick: ["Ni", TEAL, "#fff"],
  Skye: ["Sk", "#ffd6e6", WINE],
};

const PALETTE: [string, string][] = [
  ["#dff3e5", "#14532d"],
  ["#e6e0f5", "#3b2a6b"],
  ["#f5e1d8", "#6b2e14"],
];

export function teamPeople(): string[] {
  const raw = process.env.BOARD_PEOPLE;
  if (!raw) return DEFAULT_PEOPLE;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_PEOPLE;
}

export interface AvatarLook {
  initials: string;
  bg: string;
  fg: string;
  ai: boolean;
}

export function avatarLook(name: string | null | undefined, people: string[]): AvatarLook | null {
  if (!name) return null;
  const known = KNOWN[name];
  if (known) return { initials: known[0], bg: known[1], fg: known[2], ai: false };
  if (!people.includes(name)) {
    // An AI assistant: white with a teal ring.
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return { initials: initials || "AI", bg: "#fff", fg: TEAL, ai: true };
  }
  const i = Math.max(0, people.indexOf(name)) % PALETTE.length;
  return { initials: name.slice(0, 2), bg: PALETTE[i][0], fg: PALETTE[i][1], ai: false };
}
