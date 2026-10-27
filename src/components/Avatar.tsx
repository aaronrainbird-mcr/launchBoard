import { avatarLook } from "@/lib/people";

export function Avatar({ name, people, size = 26, title }: { name: string | null; people: string[]; size?: number; title?: string }) {
  const look = avatarLook(name, people);
  if (!look) {
    return <span className="lb-av none" style={{ width: size, height: size }} title={title ?? "No one yet"} aria-hidden />;
  }
  return (
    <span
      className={`lb-av${look.ai ? " ai" : ""}`}
      title={title ?? name ?? undefined}
      style={{ width: size, height: size, background: look.bg, color: look.fg, fontSize: Math.round(size * 0.4) }}
    >
      {look.initials}
    </span>
  );
}

export function Avatars({ names, people, size = 22 }: { names: string[]; people: string[]; size?: number }) {
  if (!names.length) return <Avatar name={null} people={people} size={size} />;
  return (
    <span className="lb-avs">
      {names.map((n, i) => (
        <span key={n} style={{ marginLeft: i ? -6 : 0, display: "inline-flex" }}>
          <Avatar name={n} people={people} size={size} />
        </span>
      ))}
    </span>
  );
}

export function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return <span className="lb-dot" style={{ width: size, height: size, background: color }} />;
}
