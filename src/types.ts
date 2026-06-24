// src/types.ts
export interface Session {
  id: string;          // UUID from filename (without .jsonl)
  projectPath: string; // cwd from first human message
  projectName: string; // last path segment
  startedAt: Date;     // timestamp of first human message
  updatedAt: Date;     // file mtime
  summary: string;     // first human message content, truncated to 80 chars
  turnCount: number;   // 0 until full load; updated by loadBlocks
  filePath: string;    // absolute path to .jsonl file
}

export type Block =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      name: string;
      input: Record<string, unknown>;
      result?: { text: string; isError: boolean };
    };
