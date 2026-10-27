import { hostedMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Join({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const { wrong } = await searchParams;
  return (
    <main className="lb-join">
      <form method="post" action="/api/join">
        <h1>Launch Board</h1>
        {hostedMode() ? (
          <>
            <p>Enter the team key to open the board. Ask Aaron if you don&rsquo;t have it. You only need to do this once on each browser.</p>
            {wrong && <p className="wrong">That key isn&rsquo;t right. Try again.</p>}
            <input className="lb-input" style={{ height: 44 }} type="password" name="key" autoComplete="current-password" required aria-label="Team key" autoFocus />
            <button className="lb-primary">Open the board</button>
          </>
        ) : (
          <p>
            This board is running on one computer, so there&rsquo;s no key. <a href="/">Open the board</a>.
          </p>
        )}
      </form>
    </main>
  );
}
