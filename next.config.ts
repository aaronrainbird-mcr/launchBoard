import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This repo writes its own AGENTS.md (a pointer to TASKS.md and CLAUDE.md).
  agentRules: false,
  // /api/guide reads TASKS.md at run time, so ship it with that route.
  outputFileTracingIncludes: { "/api/guide": ["./TASKS.md"] },
};

export default nextConfig;
