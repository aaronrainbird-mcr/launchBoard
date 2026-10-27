import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, hostedMode, sessionToken } from "@/lib/auth";
import { BoardApp } from "@/components/BoardApp";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (hostedMode()) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token !== sessionToken(process.env.BOARD_TEAM_KEY!)) redirect("/join");
  }
  return <BoardApp />;
}
