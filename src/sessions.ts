// src/sessions.ts
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import type { Session, Block } from "./types";

const SESSIONS_DIR = path.join(process.env.HOME!, ".claude", "projects");

const SESSION_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

/**
 * A real session transcript is a top-level `<uuid>.jsonl` in a project dir.
 * Recognize sessions by file identity rather than by sampling their contents:
 * subagent transcripts (`subagents/agent-*.jsonl`), metadata (`*.meta.json`),
 * and any other stray `.jsonl` are not sessions. This keeps the session list
 * and full-body (`rg`) search agreeing on what counts as a session.
 */
export function isSessionFile(filePath: string): boolean {
  return SESSION_FILE_RE.test(path.basename(filePath));
}

function isHumanTypedMessage(entry: Record<string, unknown>): boolean {
  return (
    entry.type === "user" &&
    (entry as any).origin?.kind === "human" &&
    (entry as any).promptSource === "typed" &&
    typeof (entry as any).message?.content === "string"
  );
}

const COMMAND_NAME_RE = /<command-name>([^<]*)<\/command-name>/;
const COMMAND_ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/;

/**
 * Slash-command invocations (e.g. `/dev-tools:work-jira CONN-3076`) are logged
 * as `type:"user"` entries with no `origin`/`promptSource`; their string content
 * is a `<command-name>`/`<command-args>` wrapper. Extract a clean
 * `/name args` string, or null if the content isn't a slash command. The
 * `<command-name>` already includes the leading slash.
 */
function slashCommandText(content: unknown): string | null {
  if (typeof content !== "string") return null;
  const name = content.match(COMMAND_NAME_RE)?.[1].trim();
  if (!name) return null;
  const args = content.match(COMMAND_ARGS_RE)?.[1].trim();
  return args ? `${name} ${args}` : name;
}

/**
 * The display text of a user-initiated prompt — a typed human message or a
 * slash-command invocation — or null for tool results and synthetic turns.
 * Both the list (first prompt → summary) and the detail view rely on this so
 * a session's opening turn is never dropped just because it was a slash command.
 */
function userPromptText(entry: Record<string, unknown>): string | null {
  if (entry.type !== "user") return null;
  const content = (entry as any).message?.content;
  if (isHumanTypedMessage(entry)) return content as string;
  return slashCommandText(content);
}

export function parseLines(
  lines: string[],
  filePath: string,
  mtime: Date
): Session | null {
  const sessionId = path.basename(filePath, ".jsonl");
  let firstHuman: Record<string, unknown> | null = null;
  let promptText: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const text = userPromptText(entry);
    if (text !== null) {
      firstHuman = entry;
      promptText = text;
      break;
    }
  }

  if (!firstHuman) return null;

  const cwd = (firstHuman as any).cwd as string;

  return {
    id: sessionId,
    projectPath: cwd,
    projectName: path.basename(cwd),
    startedAt: new Date((firstHuman as any).timestamp),
    updatedAt: mtime,
    summary: promptText!.slice(0, 80),
    turnCount: 0,
    filePath,
  };
}

export function parseSessionMetadata(filePath: string): Session | null {
  const stat = statSync(filePath);
  // Scan the whole transcript for the first human-typed message. `parseLines`
  // stops at the first match, so the common case (prompt near the top) stays
  // cheap; resumed/agent-heavy sessions whose first typed prompt is buried deep
  // (e.g. a `"continue"` past line 50) are still recognized rather than dropped.
  const content = readFileSync(filePath, "utf-8");
  return parseLines(content.split("\n"), filePath, stat.mtime);
}

function flattenResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

export function entriesToBlocks(
  entries: Record<string, unknown>[]
): { blocks: Block[]; turnCount: number } {
  const blocks: Block[] = [];
  const toolById = new Map<string, Extract<Block, { kind: "tool" }>>();
  let turnCount = 0;

  for (const entry of entries) {
    const prompt = userPromptText(entry);
    if (prompt !== null) {
      blocks.push({ kind: "user", text: prompt });
      turnCount++;
      continue;
    }

    if (entry.type === "assistant") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "text") {
          const text = (b.text ?? "").trim();
          if (text) blocks.push({ kind: "assistant", text });
        } else if (b?.type === "thinking") {
          const text = (b.thinking ?? "").trim();
          if (text) blocks.push({ kind: "thinking", text });
        } else if (b?.type === "tool_use") {
          const tool: Extract<Block, { kind: "tool" }> = {
            kind: "tool",
            name: b.name,
            input: b.input ?? {},
          };
          blocks.push(tool);
          if (typeof b.id === "string") toolById.set(b.id, tool);
        }
      }
      continue;
    }

    if (entry.type === "user") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
          const tool = toolById.get(b.tool_use_id);
          if (tool) {
            tool.result = { text: flattenResultContent(b.content), isError: b.is_error === true };
          }
        }
      }
    }
  }

  return { blocks, turnCount };
}

export function loadBlocks(session: Session): { blocks: Block[]; turnCount: number } {
  const content = readFileSync(session.filePath, "utf-8");
  const entries: Record<string, unknown>[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return entriesToBlocks(entries);
}

export function loadSessions(): Session[] {
  const projectDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(SESSIONS_DIR, d.name));

  const sessions: Session[] = [];

  for (const dir of projectDirs) {
    let files: string[];
    try {
      files = readdirSync(dir)
        .map((f) => path.join(dir, f))
        .filter(isSessionFile);
    } catch {
      continue;
    }
    for (const file of files) {
      const session = parseSessionMetadata(file);
      if (session) sessions.push(session);
    }
  }

  return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
