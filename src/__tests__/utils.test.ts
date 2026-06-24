import { describe, it, expect } from "bun:test";
import { truncateEnd, headerSummary } from "../utils";

describe("truncateEnd", () => {
  it("returns the string unchanged when it fits", () => {
    expect(truncateEnd("hello", 10)).toBe("hello");
  });
  it("truncates with an ellipsis when too long", () => {
    expect(truncateEnd("hello world", 5)).toBe("hell…");
  });
  it("returns empty for non-positive width", () => {
    expect(truncateEnd("hello", 0)).toBe("");
  });
});

describe("headerSummary", () => {
  it("counts sessions when unfiltered", () => {
    expect(headerSummary(42, null, "")).toBe("42 sessions");
  });
  it("uses singular for one session", () => {
    expect(headerSummary(1, null, "")).toBe("1 session");
  });
  it("shows the active filter and ratio", () => {
    expect(headerSummary(42, 3, "kube")).toBe('3 of 42 · filter: "kube"');
  });
});
