import { setTaskOwners } from "@/lib/board";
import { handle, json, type Params } from "@/lib/http";

// { "owners": ["Colin", "Nick"] } replaces the owners. [] means no one yet.
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  return handle(true, async ({ store, actor }) => {
    const body = (await json(req)) as { owners?: unknown };
    return setTaskOwners(store, id, body.owners, actor());
  })(req);
}
