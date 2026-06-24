// src/sessions.ts
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import type { Session, Turn } from "./types";

const SESSIONS_DIR = path.join(process.env.HOME!, ".claude", "projects");
const HEADER_LINE_LIMIT = 50;

function isHumanTypedMessage(entry: Record<string, unknown>): boolean {
  return (
    entry.type === "user" &&
    (entry as any).origin?.kind === "human" &&
    (entry as any).promptSource === "typed" &&
    typeof (entry as any).message?.content === "string"
  );
}

export function parseLines(
  lines: string[],
  filePath: string,
  mtime: Date
): Session | null {
  const sessionId = path.basename(filePath, ".jsonl");
  let firstHuman: Record<string, unknown> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (isHumanTypedMessage(entry)) {
      firstHuman = entry;
      break;
    }
  }

  if (!firstHuman) return null;

  const cwd = (firstHuman as any).cwd as string;
  const content = (firstHuman as any).message.content as string;

  return {
    id: sessionId,
    projectPath: cwd,
    projectName: path.basename(cwd),
    startedAt: new Date((firstHuman as any).timestamp),
    updatedAt: mtime,
    summary: content.slice(0, 80),
    turnCount: 0,
    filePath,
  };
}

export function parseSessionMetadata(filePath: string): Session | null {
  const stat = statSync(filePath);
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(0, HEADER_LINE_LIMIT);
  return parseLines(lines, filePath, stat.mtime);
}

export function loadTurns(session: Session): { turns: Turn[]; turnCount: number } {
  const content = readFileSync(session.filePath, "utf-8");
  const lines = content.split("\n");
  const turns: Turn[] = [];
  let turnCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (isHumanTypedMessage(entry)) {
      turns.push({
        role: "user",
        content: (entry as any).message.content as string,
        timestamp: new Date((entry as any).timestamp),
      });
      turnCount++;
      continue;
    }

    if (entry.type === "assistant") {
      const raw = (entry as any).message?.content;
      let text = "";
      if (typeof raw === "string") {
        text = raw;
      } else if (Array.isArray(raw)) {
        text = raw
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text ?? "")
          .join("\n")
          .trim();
      }
      if (text) {
        turns.push({
          role: "assistant",
          content: text,
          timestamp: new Date((entry as any).timestamp),
        });
      }
    }
  }

  return { turns, turnCount };
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
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => path.join(dir, f));
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
