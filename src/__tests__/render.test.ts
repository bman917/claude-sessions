// src/__tests__/render.test.ts
import { describe, it, expect } from "bun:test";
import { wrapText, turnsToLines } from "../render";
import type { Turn } from "../types";

describe("wrapText", () => {
  it("returns text unchanged when it fits", () => {
    expect(wrapText("hello world", 20)).toEqual(["hello world"]);
  });

  it("wraps on word boundaries", () => {
    expect(wrapText("hello world", 5)).toEqual(["hello", "world"]);
  });

  it("preserves explicit newlines", () => {
    expect(wrapText("a\nb", 10)).toEqual(["a", "b"]);
  });

  it("keeps blank lines from double newlines", () => {
    expect(wrapText("a\n\nb", 10)).toEqual(["a", "", "b"]);
  });

  it("hard-splits words longer than the width", () => {
    expect(wrapText("longwordlongword", 4)).toEqual(["long", "word", "long", "word"]);
  });

  it("returns a single empty line for empty input", () => {
    expect(wrapText("", 10)).toEqual([""]);
  });
});

function turn(role: "user" | "assistant", content: string): Turn {
  return { role, content, timestamp: new Date("2026-06-23T10:00:00.000Z") };
}

describe("turnsToLines", () => {
  it("emits a colored label, indented wrapped content, and a blank separator", () => {
    const lines = turnsToLines([turn("user", "hi there")], 20);
    expect(lines).toEqual([
      { text: "You", color: "green", bold: true },
      { text: "  hi there" },
      { text: "" },
    ]);
  });

  it("labels assistant turns as Claude in blue", () => {
    const lines = turnsToLines([turn("assistant", "ok")], 20);
    expect(lines[0]).toEqual({ text: "Claude", color: "blue", bold: true });
  });

  it("wraps long content to the available width minus the indent", () => {
    const lines = turnsToLines([turn("user", "hello world")], 9); // width-2 = 7
    expect(lines).toEqual([
      { text: "You", color: "green", bold: true },
      { text: "  hello" },
      { text: "  world" },
      { text: "" },
    ]);
  });

  it("concatenates multiple turns", () => {
    const lines = turnsToLines([turn("user", "a"), turn("assistant", "b")], 20);
    expect(lines).toEqual([
      { text: "You", color: "green", bold: true },
      { text: "  a" },
      { text: "" },
      { text: "Claude", color: "blue", bold: true },
      { text: "  b" },
      { text: "" },
    ]);
  });
});
