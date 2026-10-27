import path from "node:path";
import { FileStore } from "./file";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

// Supabase when both settings are present, otherwise a file on this computer.
// BOARD_STORAGE=supabase without the settings stops with an error rather than
// quietly falling back to a file.
export function makeStore(env: NodeJS.ProcessEnv = process.env): Store {
  const mode = env.BOARD_STORAGE;
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if (mode === "supabase" && !hasSupabase) {
    throw new Error("BOARD_STORAGE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (mode !== "file" && hasSupabase) {
    return new SupabaseStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  const dir = env.BOARD_DATA_DIR || path.join(process.cwd(), ".local-data");
  return new FileStore(path.join(dir, "board.json"));
}

const g = globalThis as unknown as { __launchBoardStore?: Store };

export function store(): Store {
  if (!g.__launchBoardStore) g.__launchBoardStore = makeStore();
  return g.__launchBoardStore;
}
