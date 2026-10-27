# Hosting the Launch Board for the team

**Built, not hosted yet.** Environment variables switch hosted mode on. With none set, the board runs on one computer and stores its data in `.local-data/`.

| | On one computer (default) | Hosted |
| --- | --- | --- |
| Who can open it | This computer only (loopback addresses) | Anyone with the team key, entered once per browser at `/join` |
| AI assistants | Send `X-Board-As: <name>` and `X-Board-Agent: <assistant>` | Send `Authorization: Bearer <personal agent key>` and `X-Board-Agent` |
| Storage | `.local-data/board.json` | Supabase |
| Live updates | Browsers poll `/api/changes` every 2 seconds | The same |

## 1. Create these first

1. **A Supabase project** in a London or EU region.
   - Run `supabase/migrations/20261027000000_launch_board.sql` in its SQL editor.
   - It creates three tables (`lb_tasks`, `lb_comments`, `lb_activity`) and turns row level security on with no policies, so only the server's service role key can read or write them.
   - Copy the project URL and the service role key.
2. **A Vercel project** imported from this repository. `vercel.json` sets Next.js and the London region.

## 2. Settings on Vercel (Production)

| Variable | Value |
| --- | --- |
| `BOARD_TEAM_KEY` | A long random secret, e.g. from `openssl rand -base64 24`. Share it with the team once, in a private place, not in chat history that's widely visible. |
| `BOARD_AGENT_KEYS` | One personal key per person, as `Name:key` pairs separated by commas, e.g. `Aaron:…,Abdulmuiz:…,Colin:…,Nick:…,Skye:…`. Each key must be at least 16 characters. Make each with `openssl rand -hex 24`. |
| `BOARD_PEOPLE` | Optional. The team, comma separated. Defaults to `Aaron,Abdulmuiz,Colin,Nick,Skye`. |
| `BOARD_PUBLIC_URL` | The board's address, e.g. `https://launch-board.vercel.app`. Used in redirects and in the agent guide. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From the Supabase project. Server only: never a `NEXT_PUBLIC_` variable. |

- To add someone, change `BOARD_PEOPLE` and `BOARD_AGENT_KEYS`, then redeploy.
- To revoke an agent key, remove its pair and redeploy.
- A deployment on Vercel without `BOARD_TEAM_KEY` refuses every request. So a preview that's missing the settings fails closed instead of opening up.

## 3. Load the tasks

On a computer with the seed file, put the Supabase settings in `.env.local`, then:

```bash
npm run seed -- seed/launch-tasks.json --dry-run
npm run seed -- seed/launch-tasks.json
```

If the board already has tasks, the seed refuses to run unless you add `--replace`. `--replace` wipes every task, comment and activity line first.

## 4. Give each person their agent key

Each person keeps their key in their own shell profile:

```bash
export BOARD=https://<board address>
export LAUNCH_BOARD_KEY=<their key>
```

Then they tell their assistant: "Read $BOARD/api/guide, then pick up C5 on the Launch Board."

## Security model

- **People:** the team key unlocks the board in a browser. It sets an HTTP-only cookie signed from the key, and changing the key signs everyone out.
  - The **Using as** picker is a label, not a login. Anyone with the team key can act as anyone. That's the trade-off for a five-person board with no sign-in to set up.
  - If that stops being enough, the Project Portal's Google sign-in (next-auth, `mcrpathways.org` only) can be dropped in. The server already decides who's acting in one place, `src/lib/auth.ts`.
- **AI assistants:** each key belongs to one person, so "Claude Code (for Colin)" is reliable even though the browser picker isn't.
- **Rules on the server:** only a person who isn't an owner can mark a task done, and assistants never can. Tasks added by an assistant must have a summary, a description and a technical description.
- **Changes from browsers** must come from the board's own address. Requests from other sites are refused.
- **No secrets in the browser.** Every key is a server-only variable.
- **Public repo, private data.** Task data lives only in Supabase (or `.local-data/`). `seed/` is git-ignored.
- **Markdown in tasks is rendered without raw HTML,** and links must be `http(s)`.
