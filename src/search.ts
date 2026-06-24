// src/search.ts
//
// Full-body session search backed by ripgrep (`rg`) over the raw `.jsonl`
// transcripts under ~/.claude/projects. Filter-only: a query narrows the
// session list to sessions whose transcript contains the literal term.
import path from "path";

const SESSIONS_DIR = path.join(process.env.HOME!, ".claude", "projects");

/**
 * Map ripgrep's `-l` output (newline-separated file paths) to a set of
 * session IDs (file basename minus `.jsonl`). Pure: ignores blank lines and
 * dedupes via the Set.
 */
export function parseRgOutput(stdout: string): Set<string> {
  const ids = new Set<string>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    ids.add(path.basename(trimmed, ".jsonl"));
  }
  return ids;
}

export type SearchResult =
  | { ok: true; ids: Set<string> }
  | { ok: false; error: "rg-missing" | "rg-error" };

/**
 * Run `rg -l -F -S -- <query> <dir>` and return the matching session IDs.
 *
 * Flags: `-l` files-with-matches only, `-F` fixed-string (literal) search,
 * `-S` smart-case, `--` ends flag parsing so a query starting with `-` is
 * treated as text. Exit code 1 (no matches) is not an error — it yields an
 * empty set.
 */
export function searchBodies(query: string, dir: string = SESSIONS_DIR): SearchResult {
  let proc: { exitCode: number | null; stdout: Buffer };
  try {
    proc = Bun.spawnSync(["rg", "-l", "-F", "-S", "--", query, dir]);
  } catch (err: any) {
    if (err?.code === "ENOENT") return { ok: false, error: "rg-missing" };
    return { ok: false, error: "rg-error" };
  }

  // Bun reports a failed spawn (binary not found) via exitCode rather than
  // throwing, depending on platform — guard both ways.
  if (proc.exitCode === null) return { ok: false, error: "rg-missing" };

  if (proc.exitCode === 0) {
    return { ok: true, ids: parseRgOutput(proc.stdout.toString()) };
  }
  if (proc.exitCode === 1) {
    return { ok: true, ids: new Set() };
  }
  return { ok: false, error: "rg-error" };
}
