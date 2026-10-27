# Launch Board: guide for AI assistants

This guide is for Claude Code, Codex or any other AI assistant working with the SEI team's Launch Board. The board tracks the work to launch the new MCR Pathways staff intranet, and the work after it. People use the board in a browser. You use its JSON API. Everything you change shows up live on everyone's screen, labelled with your name and the person you're working for, e.g. "Claude Code (for Colin)".

The board lives at **{{BOARD_URL}}**. This guide is served at `{{BOARD_URL}}/api/guide`.

## The one-minute version

1. **Find work:** `GET /api/tasks?status=todo` lists what's free. `GET /api/tasks?mine=1` lists your person's tasks.
2. **Read the whole task:** `GET /api/tasks/C5/brief` returns everything as Markdown. This includes the summary, the description, the technical description, steps, what "done" means, how to check it, what to watch out for, files, links and recent comments.
3. **Take it** before you start: `POST /api/tasks/C5/take`. Only take a task when your person has asked you to.
4. **Keep the card current while you work:**
   - Add links to the branch, PR, preview and documents as soon as they exist.
   - Comment at milestones.
   - Tick the "done means" items as they become true.
5. **When it's ready,** write sign-off notes, then move it to `check`. A person who isn't an owner checks it and marks it done. You can't mark anything done.

## Signing in

Every request needs to say who it's for.

| Where the board runs | Send these headers |
| --- | --- |
| Hosted (the team's address) | `Authorization: Bearer $LAUNCH_BOARD_KEY` and `X-Board-Agent: Claude Code` |
| On someone's own computer (`http://127.0.0.1:3200`) | `X-Board-As: Colin` and `X-Board-Agent: Claude Code` |

- Each person has their own agent key. Aaron hands them out.
- The key decides which person you're acting for, so never borrow someone else's.
- Keep the key in an environment variable such as `LAUNCH_BOARD_KEY`. Never write it into a file, commit, comment or task.
- `X-Board-Agent` is your own name, e.g. "Claude Code", "Codex" or "Claude Design".

Set these up once in your shell:

```bash
export BOARD={{BOARD_URL}}
H=(-H "Authorization: Bearer $LAUNCH_BOARD_KEY" -H "X-Board-Agent: Claude Code" -H "Content-Type: application/json")
```

## Reading

```bash
curl -s "${H[@]}" "$BOARD/api/tasks"                        # every task, one short line each
curl -s "${H[@]}" "$BOARD/api/tasks?status=todo&lane=build"  # filters: status, lane, owner, when, q, mine=1
curl -s "${H[@]}" "$BOARD/api/tasks?owner=none"              # nobody has taken these yet
curl -s "${H[@]}" "$BOARD/api/tasks/C5"                      # full task as JSON, with comments and activity
curl -s "${H[@]}" "$BOARD/api/tasks/C5/brief"                # full task as Markdown (best for reading)
```

- **Statuses:**
  - `todo` (To do)
  - `doing` (In progress)
  - `check` (Ready to check)
  - `done` (Done)
- **Lanes:**
  - `design`: Claude Design work
  - `build`: code, content and jobs for people
- **When:**
  - `launch`: for Friday 30 October
  - `after`: after launch

## Changing a task

| What | Request |
| --- | --- |
| Take it (you become an owner; To do moves to In progress) | `POST /api/tasks/:id/take` |
| Move it | `POST /api/tasks/:id/move` with `{"status":"check"}` |
| Set the owners | `PUT /api/tasks/:id/owners` with `{"owners":["Colin","Nick"]}` (`[]` means no one yet) |
| Add a link | `POST /api/tasks/:id/links` with `{"kind":"pr","url":"https://github.com/…/pull/601","label":"PR #601"}` |
| Remove a link | `DELETE /api/tasks/:id/links?link=<link id>` |
| Comment | `POST /api/tasks/:id/comments` with `{"text":"…"}` (`@Colin` mentions someone) |
| Tick a "done means" item | `POST /api/tasks/:id/ticks` with `{"index":0,"done":true}` |
| Edit documentation fields | `PATCH /api/tasks/:id` with only the fields you're changing |

- **Link kinds:**
  - `pr`: a pull request
  - `preview`: a Vercel preview or other place to try it
  - `design`: a Claude Design file
  - `doc`: documentation, runbooks or decision notes
  - `other`
- **Fields you can PATCH:**
  - `title`, `lane`, `group`, `when`, `size` (`S`, `M` or `L`), `cutFirst`
  - `blocked`: a reason, or `""` to clear it
  - `summary`, `description`, `technical`, `signOffNotes` (Markdown)
  - `steps`, `howToCheck`, `watchOut`, `needs`, `files`, `related`: lists of text
  - `doneMeans`: a list of `{"text","done"}` objects
- **Lists:** a PATCH replaces the whole list. Read the task first, then send the full new list.

Examples:

```bash
curl -s "${H[@]}" -X POST "$BOARD/api/tasks/C5/take"
curl -s "${H[@]}" -X POST "$BOARD/api/tasks/C5/links" -d '{"kind":"pr","url":"https://github.com/MCR-Pathways/intranet/pull/601"}'
curl -s "${H[@]}" -X POST "$BOARD/api/tasks/C5/comments" -d '{"text":"Run sheet drafted; waiting for Aaron to agree the time."}'
curl -s "${H[@]}" -X PATCH "$BOARD/api/tasks/C5" -d '{"blocked":"Waiting for Aaron to agree the clear-out time"}'
```

## Ready to check: hand over properly

Before you move a task to `check`, PATCH `signOffNotes` (Markdown) so someone else can check it without asking you anything. Cover:

- **What changed:** two or three plain sentences.
- **Where to look:**
  - the preview link, and the page or steps to get there
  - the screen sizes to try (1366×768 and 390×844 for the intranet)
  - which account to use
- **Links:** the PR, plus any documentation you wrote or updated (add these as links too).
- **What you checked:** the tests and checks you ran, and their results.
- **What's left or can't be seen yet:** for example "needs migration 00174 applied first", or a decision only Aaron can make.

Then `POST /api/tasks/:id/move` with `{"status":"check"}`. Only a person can mark it done, and never an owner of the task.

## Adding a task

Only add tasks when your person asks you to. `POST /api/tasks` creates one in To do. The board gives it an ID: `B…` for design, `C…` for build.

Tasks added by an AI assistant **must** include `summary`, `description` and `technical`, so they arrive ready to pick up:

```json
{
  "title": "Org chart: check every manager line",
  "lane": "build",
  "when": "launch",
  "owners": [],
  "summary": "One plain sentence: what this is.",
  "description": "For people. 2–4 short paragraphs: what it is and why it matters, how it works today, what's different when it's done. No file paths.",
  "technical": "For developers and AI assistants. Use these headings: ## Where, ## Current state, ## What to do, ## Constraints, ## Done when, ## Checks. Facts, file:line references, exact copy. Not a prompt: don't write 'You are…'.",
  "steps": ["…"],
  "doneMeans": ["…"],
  "howToCheck": ["…"],
  "watchOut": ["…"],
  "needs": ["…"],
  "files": ["src/… - what's there"],
  "related": ["C24"]
}
```

## House rules

- **Don't assign people who haven't agreed.** Leave `owners` empty unless your person named the owner. The card then shows "Take this".
- **Write for the team:**
  - British English, plain and short
  - no em dashes
  - no hype words ("seamless", "robust", "crucial", "leverage", "delve")
- **Never put secrets on the board:** no keys, passwords or connection strings, and no personal data about staff or young people.
- **Work in the intranet repo (MCR-Pathways/intranet)?** Read its `CLAUDE.md` first. Its launch-week rules apply:
  - Aaron merges.
  - Commits are signed.
  - The production database is never touched without Aaron's yes.
  - Vercel previews share the live database, so look on a preview and never submit.
- **Errors:** you get a JSON `{"error": "…"}` that says what to fix. A `409` means someone changed the task at the same moment, so read it again and retry.
