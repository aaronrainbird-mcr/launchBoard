# Launch Board

A live kanban for the SEI team at MCR Pathways: who's doing what to launch the new staff intranet on Friday 30 October 2026, and the work after it.

- **People** move cards, take work, fill in detail, comment and sign off in the browser. Everyone sees changes within a couple of seconds.
- **AI assistants** (Claude Code, Codex, Claude Design) use the same board through a small JSON API. They read a task's full brief, take it, add links to PRs, previews and documents, comment, and move it to Ready to check. Every change they make is labelled with the assistant and the person it worked for.
- **Every task carries its own documentation:**
  - a one-line summary
  - a plain-English description
  - a technical description you can hand to Claude Code
  - steps, and a "done means" checklist
  - how to check it, and what to watch out for
  - what it needs, and the files involved
  - links, and sign-off notes

  Someone can see a task, decide to take it on and run with it.

The design comes from the Claude Design file `Launch Board Screens.dc.html` (project "Launch Board"), which follows the Project Portal's look.

## How work moves

1. **To do.** Pick a card and press **Take this**. You become an owner and it moves to In progress.
2. **In progress.** Do the work, and keep the card current as you go:
   - add the PR, the preview and any documents as links
   - tick the "done means" items
   - comment when something changes
3. **Ready to check.** Write sign-off notes: what changed, where to look, and what's left. Then move it here.
4. **Done.** Someone who isn't an owner checks it and presses **I've checked it: mark as done**. AI assistants can't mark anything done.

## Run it on your computer

```bash
npm install
npm run dev            # http://127.0.0.1:3200
```

With no settings, the board keeps its data in `.local-data/board.json` and only answers on this computer. Pick who you are with the **Using as** menu.

To load tasks, run `npm run seed -- <file.json>`. The launch tasks themselves aren't in this repo, because they hold internal launch detail and this repo is public. Aaron has them, with the script that built them from the launch plan.

## For AI assistants

Read [TASKS.md](TASKS.md). The running board also serves it at `/api/guide`. In short:

```bash
curl -s -H "Authorization: Bearer $LAUNCH_BOARD_KEY" -H "X-Board-Agent: Claude Code" "$BOARD/api/tasks/C5/brief"
```

## Hosting

See [docs/hosting.md](docs/hosting.md). It runs on Vercel with Supabase, behind a team key, with a personal key for each person's AI assistant.

## Checks

```bash
npm run typecheck
npm test
```
