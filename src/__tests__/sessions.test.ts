// src/__tests__/sessions.test.ts
import { describe, it, expect } from "bun:test";
import { parseLines, loadTurns } from "../sessions";
import type { Session } from "../types";

const MTIME = new Date("2026-06-23T12:00:00.000Z");
const FILE_PATH = "/home/user/.claude/projects/-Users-test-myproject/abc-123.jsonl";

const HUMAN_MESSAGE_LINE = JSON.stringify({
  type: "user",
  uuid: "msg-1",
  timestamp: "2026-06-23T10:00:00.000Z",
  cwd: "/Users/test/myproject",
  sessionId: "abc-123",
  message: { role: "user", content: "Help me build something" },
  origin: { kind: "human" },
  promptSource: "typed",
});

const TOOL_RESULT_LINE = JSON.stringify({
  type: "user",
  uuid: "msg-2",
  timestamp: "2026-06-23T10:01:00.000Z",
  message: { role: "user", content: [{ type: "tool_result", content: "ok" }] },
  origin: { kind: "human" },
  promptSource: "typed",
});

const HEADER_LINE = JSON.stringify({
  type: "last-prompt",
  leafUuid: "msg-1",
  sessionId: "abc-123",
});

describe("parseLines", () => {
  it("extracts session metadata from first human message", () => {
    const lines = [HEADER_LINE, HUMAN_MESSAGE_LINE];
    const session = parseLines(lines, FILE_PATH, MTIME);
    expect(session).not.toBeNull();
    expect(session!.id).toBe("abc-123");
    expect(session!.projectPath).toBe("/Users/test/myproject");
    expect(session!.projectName).toBe("myproject");
    expect(session!.summary).toBe("Help me build something");
    expect(session!.startedAt).toEqual(new Date("2026-06-23T10:00:00.000Z"));
    expect(session!.updatedAt).toEqual(MTIME);
    expect(session!.turnCount).toBe(0);
    expect(session!.filePath).toBe(FILE_PATH);
  });

  it("returns null when no human message found", () => {
    const lines = [HEADER_LINE, TOOL_RESULT_LINE];
    expect(parseLines(lines, FILE_PATH, MTIME)).toBeNull();
  });

  it("truncates summary to 80 chars", () => {
    const longContent = "a".repeat(100);
    const line = JSON.stringify({
      type: "user",
      uuid: "msg-1",
      timestamp: "2026-06-23T10:00:00.000Z",
      cwd: "/Users/test/myproject",
      sessionId: "abc-123",
      message: { role: "user", content: longContent },
      origin: { kind: "human" },
      promptSource: "typed",
    });
    const session = parseLines([line], FILE_PATH, MTIME);
    expect(session!.summary.length).toBe(80);
  });

  it("skips lines with array content (tool results)", () => {
    const lines = [TOOL_RESULT_LINE, HUMAN_MESSAGE_LINE];
    const session = parseLines(lines, FILE_PATH, MTIME);
    expect(session!.summary).toBe("Help me build something");
  });
});

const STUB_SESSION: Session = {
  id: "abc-123",
  projectPath: "/Users/test/myproject",
  projectName: "myproject",
  startedAt: new Date("2026-06-23T10:00:00.000Z"),
  updatedAt: new Date("2026-06-23T12:00:00.000Z"),
  summary: "Help me build something",
  turnCount: 0,
  filePath: "/tmp/test-session.jsonl",
};

const JSONL_CONTENT = [
  JSON.stringify({
    type: "user",
    uuid: "u1",
    timestamp: "2026-06-23T10:00:00.000Z",
    message: { role: "user", content: "Hello" },
    origin: { kind: "human" },
    promptSource: "typed",
    cwd: "/Users/test/myproject",
    sessionId: "abc-123",
  }),
  JSON.stringify({
    type: "assistant",
    uuid: "a1",
    timestamp: "2026-06-23T10:00:05.000Z",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "Hi there!" },
        { type: "tool_use", id: "t1", name: "Bash", input: {} },
      ],
    },
  }),
  JSON.stringify({
    type: "user",
    uuid: "u2",
    timestamp: "2026-06-23T10:01:00.000Z",
    message: { role: "user", content: "Thanks" },
    origin: { kind: "human" },
    promptSource: "typed",
    cwd: "/Users/test/myproject",
    sessionId: "abc-123",
  }),
].join("\n");

describe("loadTurns", () => {
  it("extracts user and assistant turns", () => {
    // Write fixture to temp file
    const tmpFile = "/tmp/test-session.jsonl";
    require("fs").writeFileSync(tmpFile, JSONL_CONTENT);
    const { turns, turnCount } = loadTurns({ ...STUB_SESSION, filePath: tmpFile });

    expect(turns).toHaveLength(3);
    expect(turns[0]).toEqual({ role: "user", content: "Hello", timestamp: new Date("2026-06-23T10:00:00.000Z") });
    expect(turns[1]).toEqual({ role: "assistant", content: "Hi there!", timestamp: new Date("2026-06-23T10:00:05.000Z") });
    expect(turns[2]).toEqual({ role: "user", content: "Thanks", timestamp: new Date("2026-06-23T10:01:00.000Z") });
    expect(turnCount).toBe(2);
  });

  it("skips assistant messages with no text blocks", () => {
    const noTextContent = JSON.stringify({
      type: "assistant",
      uuid: "a2",
      timestamp: "2026-06-23T10:02:00.000Z",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "t2", name: "Bash", input: {} }],
      },
    });
    const tmpFile = "/tmp/test-session-notxt.jsonl";
    require("fs").writeFileSync(tmpFile, noTextContent);
    const { turns } = loadTurns({ ...STUB_SESSION, filePath: tmpFile });
    expect(turns).toHaveLength(0);
  });
});
