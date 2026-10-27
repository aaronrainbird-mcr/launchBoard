# Launch Board: working on the code

A small Next.js app: a live kanban for the SEI team's intranet launch. Read README.md for what it is and docs/hosting.md for how it's hosted. TASKS.md is the guide for AI assistants that *use* the board.

## Layout
- `src/lib/types.ts`: the data model.
- `src/lib/rules.ts`: every change to a task as a pure function (take, move, check, owners, links, ticks, edits). The rules live here and nowhere else, and `rules.test.ts` covers them.
- `src/lib/board.ts`: reads a task, applies a rule, saves it with a version check, and logs the activity.
- `src/lib/store/`: the file store (one computer) and the Supabase store (hosted). Both implement `Store`.
- `src/lib/auth.ts`: who's calling. Team key cookie for people, personal bearer keys for agents, loopback-only with no key.
- `src/app/api/`: thin routes over `board.ts`. `src/components/`: the board UI, ported from the Claude Design file `LaunchBoard.dc.html`.

## Rules
- Only a person who isn't an owner can mark a task done. Agents never can. Keep this in `rules.ts`.
- Never commit real task data. `seed/` and `.local-data/` are git-ignored because the launch tasks hold internal detail, and this repo is public.
- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `BOARD_TEAM_KEY`, `BOARD_AGENT_KEYS`) never go in `NEXT_PUBLIC_` variables or client code.
- British English and plain words in the UI. No em dashes.
- Before pushing, run `npm run typecheck` and `npm test`.
