// src/types.ts
export interface Session {
  id: string;          // UUID from filename (without .jsonl)
  projectPath: string; // cwd from first human message
  projectName: string; // last path segment
  startedAt: Date;     // timestamp of first human message
  updatedAt: Date;     // file mtime
  summary: string;     // first human message content, truncated to 80 chars
  turnCount: number;   // 0 until full load; updated by loadTurns
  filePath: string;    // absolute path to .jsonl file
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
