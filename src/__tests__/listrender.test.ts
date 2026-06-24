import { describe, it, expect } from "bun:test";
import { dateBucket, sessionsToRows } from "../listrender";
import type { Session } from "../types";

const NOW = new Date("2026-06-24T12:00:00Z");

function mkSession(id: string, name: string, summary: string, updatedAt: Date): Session {
  return {
    id,
    projectPath: "/p/" + name,
    projectName: name,
    startedAt: updatedAt,
    updatedAt,
    summary,
    turnCount: 0,
    filePath: "/p/" + id + ".jsonl",
  };
}

describe("dateBucket", () => {
  it("labels same-day as Today", () => {
    expect(dateBucket(new Date("2026-06-24T01:00:00Z"), NOW)).toBe("Today");
  });
  it("labels the previous day as Yesterday", () => {
    expect(dateBucket(new Date("2026-06-23T23:00:00Z"), NOW)).toBe("Yesterday");
  });
  it("labels within a week as This week", () => {
    expect(dateBucket(new Date("2026-06-20T12:00:00Z"), NOW)).toBe("This week");
  });
  it("labels older than a week as Older", () => {
    expect(dateBucket(new Date("2026-06-01T12:00:00Z"), NOW)).toBe("Older");
  });
});

describe("sessionsToRows", () => {
  it("emits a header before the first item of each date group", () => {
    const sessions = [
      mkSession("a", "alpha", "first", new Date("2026-06-24T11:00:00Z")),
      mkSession("b", "bravo", "second", new Date("2026-06-24T10:00:00Z")),
      mkSession("c", "charlie", "third", new Date("2026-06-23T10:00:00Z")),
    ];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    expect(rows.filter((r) => r.kind === "header").map((r) => (r as any).text)).toEqual([
      "Today",
      "Yesterday",
    ]);
    // Two content rows (name + summary) per session.
    expect(rows.filter((r) => r.kind === "item-name").length).toBe(3);
    expect(rows.filter((r) => r.kind === "item-summary").length).toBe(3);
  });

  it("ranges include the preceding header and cover both content rows", () => {
    const sessions = [
      mkSession("a", "alpha", "first", new Date("2026-06-24T11:00:00Z")),
      mkSession("b", "bravo", "second", new Date("2026-06-24T10:00:00Z")),
    ];
    const { rows, ranges } = sessionsToRows(sessions, 35, NOW);
    // session 0: header + name + summary = 3 rows; session 1: name + summary = 2 rows.
    expect(ranges).toEqual([
      { start: 0, len: 3 },
      { start: 3, len: 2 },
    ]);
    expect(rows[0]).toEqual({ kind: "header", text: "Today" });
    expect((rows[1] as any).sessionIndex).toBe(0);
    expect((rows[3] as any).sessionIndex).toBe(1);
  });

  it("right-aligns the time and pads lines to width-4", () => {
    const sessions = [mkSession("a", "alpha", "hi", new Date("2026-06-24T11:00:00Z"))];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    const name = rows.find((r) => r.kind === "item-name") as any;
    const summary = rows.find((r) => r.kind === "item-summary") as any;
    expect(name.text.length).toBe(31); // 35 - 4
    expect(summary.text.length).toBe(31);
    expect(name.text.startsWith("alpha")).toBe(true);
    expect(name.text.trimEnd().endsWith("ago")).toBe(true);
    expect(summary.text.startsWith('"hi"')).toBe(true);
  });

  it("truncates a long project name to leave room for the time", () => {
    const sessions = [
      mkSession("a", "this-is-a-very-long-project-name-indeed", "x", new Date("2026-06-24T11:00:00Z")),
    ];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    const name = rows.find((r) => r.kind === "item-name") as any;
    expect(name.text.length).toBe(31);
    expect(name.text).toContain("…");
    expect(name.text.trimEnd().endsWith("ago")).toBe(true);
  });
});
