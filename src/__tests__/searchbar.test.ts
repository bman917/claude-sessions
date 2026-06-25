import { describe, it, expect } from "bun:test";
import { searchBarView } from "../searchbar";

describe("searchBarView", () => {
  it("is gray with a placeholder when idle and empty", () => {
    const v = searchBarView({ query: "", focused: false, matchCount: null, error: null });
    expect(v.borderColor).toBe("gray");
    expect(v.showPlaceholder).toBe(true);
    expect(v.status).toBeNull();
  });

  it("turns cyan, hides the placeholder, and shows regex hint when focused", () => {
    const v = searchBarView({ query: "kube", focused: true, matchCount: null, error: null });
    expect(v.borderColor).toBe("cyan");
    expect(v.showPlaceholder).toBe(false);
    expect(v.status).toEqual({ text: "regex" });
  });

  it("stays cyan with a chip while a filter is active but unfocused", () => {
    const v = searchBarView({ query: "kube", focused: false, matchCount: 3, error: null });
    expect(v.borderColor).toBe("cyan");
    expect(v.showPlaceholder).toBe(false);
    expect(v.status).toEqual({ text: "3 matches", color: "cyan" });
  });

  it("uses singular for one match", () => {
    const v = searchBarView({ query: "x", focused: true, matchCount: 1, error: null });
    expect(v.status).toEqual({ text: "1 match", color: "cyan" });
  });

  it("shows the error in red and takes precedence", () => {
    const v = searchBarView({ query: "x", focused: true, matchCount: null, error: "ripgrep not found" });
    expect(v.borderColor).toBe("red");
    expect(v.status).toEqual({ text: "ripgrep not found", color: "red" });
  });
});
