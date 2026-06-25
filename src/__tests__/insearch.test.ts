import { describe, it, expect } from "bun:test";
import { compileQuery, findMatches, findBlocksMatching } from "../insearch";
import type { Block } from "../types";

describe("compileQuery", () => {
  it("returns a case-insensitive regex for an all-lowercase pattern", () => {
    const re = compileQuery("hello");
    expect(re).not.toBeNull();
    expect(re!.flags).toContain("i");
    expect(re!.test("HELLO")).toBe(true);
  });

  it("returns a case-sensitive regex when the pattern has uppercase", () => {
    const re = compileQuery("Hello");
    expect(re).not.toBeNull();
    expect(re!.flags).not.toContain("i");
    expect(re!.test("hello")).toBe(false);
    expect(re!.test("Hello")).toBe(true);
  });

  it("returns null for an invalid regex pattern", () => {
    expect(compileQuery("[invalid")).toBeNull();
  });

  it("returns a global regex", () => {
    const re = compileQuery("x");
    expect(re!.flags).toContain("g");
  });
});

describe("findMatches", () => {
  it("returns empty array when nothing matches", () => {
    const lines = [
      { text: "You", blockIndex: 0 },
      { text: "  hello world", blockIndex: 0 },
    ] as any;
    const re = compileQuery("xyz")!;
    expect(findMatches(lines, re)).toEqual([]);
  });

  it("returns a match with correct lineIndex, col, and length", () => {
    const lines = [
      { text: "You", blockIndex: 0 },
      { text: "  hello world", blockIndex: 0 },
    ] as any;
    const re = compileQuery("hello")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ lineIndex: 1, blockIndex: 0, col: 2, length: 5 });
  });

  it("returns multiple matches across lines in document order", () => {
    const lines = [
      { text: "foo bar", blockIndex: 0 },
      { text: "foo baz", blockIndex: 1 },
    ] as any;
    const re = compileQuery("foo")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(2);
    expect(matches[0].lineIndex).toBe(0);
    expect(matches[1].lineIndex).toBe(1);
  });

  it("returns multiple matches on the same line", () => {
    const lines = [{ text: "abab", blockIndex: 0 }] as any;
    const re = compileQuery("ab")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ col: 0, length: 2 });
    expect(matches[1]).toMatchObject({ col: 2, length: 2 });
  });
});

describe("findBlocksMatching", () => {
  it("returns the set of block indices containing a match", () => {
    const blocks: Block[] = [
      { kind: "user", text: "hello world" },
      { kind: "assistant", text: "no match here" },
      { kind: "user", text: "hello again" },
    ];
    const re = compileQuery("hello")!;
    const result = findBlocksMatching(blocks, 80, re);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it("finds matches inside collapsed block content (thinking block)", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "secret keyword here" },
    ];
    const re = compileQuery("keyword")!;
    const result = findBlocksMatching(blocks, 80, re);
    expect(result.has(0)).toBe(true);
  });

  it("returns an empty set when nothing matches", () => {
    const blocks: Block[] = [
      { kind: "user", text: "no match" },
    ];
    const re = compileQuery("xyz")!;
    expect(findBlocksMatching(blocks, 80, re).size).toBe(0);
  });
});
