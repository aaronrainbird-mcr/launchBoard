import { getBoard } from "@/lib/board";
import { handle } from "@/lib/http";
import { teamPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

// Everything on the board, for the browser.
export const GET = handle(false, async ({ store }) => ({ ...(await getBoard(store)), people: teamPeople() }));
