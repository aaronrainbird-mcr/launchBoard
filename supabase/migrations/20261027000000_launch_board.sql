-- Launch Board storage.
--
-- Three tables: tasks (the whole task as JSON, with a version for safe
-- concurrent saves), comments, and an activity log whose sequence number
-- drives live updates.
--
-- Row level security is on with no policies, and the anon and authenticated
-- roles get no grants, so only the server's service role key can read or
-- write. Never put that key in the browser.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lb_tasks (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lb_comments (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES public.lb_tasks(id) ON DELETE CASCADE,
  who text NOT NULL,
  agent text,
  text text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lb_comments_task_idx ON public.lb_comments (task_id, at);

CREATE TABLE IF NOT EXISTS public.lb_activity (
  seq bigserial PRIMARY KEY,
  task_id text NOT NULL,
  who text NOT NULL,
  agent text,
  text text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lb_activity_task_idx ON public.lb_activity (task_id, seq);

ALTER TABLE public.lb_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lb_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lb_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lb_tasks, public.lb_comments, public.lb_activity FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.lb_activity_seq_seq FROM anon, authenticated;

COMMIT;

-- Verify: expect three rows, each with rowsecurity = true.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'lb\_%';
