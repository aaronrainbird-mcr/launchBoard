import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { boardUrl } from "@/lib/http";

// The /join form posts the team key here. A right key sets the session cookie.
export async function POST(req: Request) {
  const base = boardUrl(req);
  const teamKey = process.env.BOARD_TEAM_KEY;
  const form = await req.formData();
  const given = String(form.get("key") ?? "");
  const ok =
    !!teamKey &&
    Buffer.from(given).length === Buffer.from(teamKey).length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(teamKey));
  if (!ok) return NextResponse.redirect(`${base}/join?wrong=1`, 303);
  const res = NextResponse.redirect(`${base}/`, 303);
  res.cookies.set(SESSION_COOKIE, sessionToken(teamKey!), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
