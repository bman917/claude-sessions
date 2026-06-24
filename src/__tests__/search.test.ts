// src/__tests__/search.test.ts
import { describe, it, expect } from "bun:test";
import { parseRgOutput } from "../search";

describe("parseRgOutput", () => {
  it("maps file paths to session IDs (basename minus .jsonl)", () => {
    const stdout =
      "/Users/me/.claude/projects/proj-a/abc-123.jsonl\n" +
      "/Users/me/.claude/projects/proj-b/def-456.jsonl\n";
    expect(parseRgOutput(stdout)).toEqual(new Set(["abc-123", "def-456"]));
  });

  it("ignores blank lines", () => {
    const stdout =
      "\n" +
      "/Users/me/.claude/projects/proj-a/abc-123.jsonl\n" +
      "\n" +
      "   \n";
    expect(parseRgOutput(stdout)).toEqual(new Set(["abc-123"]));
  });

  it("dedupes repeated paths", () => {
    const stdout =
      "/Users/me/.claude/projects/proj-a/abc-123.jsonl\n" +
      "/Users/me/.claude/projects/proj-a/abc-123.jsonl\n";
    expect(parseRgOutput(stdout)).toEqual(new Set(["abc-123"]));
  });

  it("returns an empty set for empty output", () => {
    expect(parseRgOutput("")).toEqual(new Set());
  });
});
