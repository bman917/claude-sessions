// src/__tests__/nav.test.ts
import { describe, it, expect } from "bun:test";
import { computeNav } from "../nav";

describe("computeNav", () => {
  it("moves down", () => {
    const result = computeNav({ index: 2, offset: 0 }, "down", 10, 5);
    expect(result.index).toBe(3);
  });

  it("moves up", () => {
    const result = computeNav({ index: 3, offset: 0 }, "up", 10, 5);
    expect(result.index).toBe(2);
  });

  it("clamps at bottom of list", () => {
    const result = computeNav({ index: 9, offset: 5 }, "down", 10, 5);
    expect(result.index).toBe(9);
  });

  it("clamps at top of list", () => {
    const result = computeNav({ index: 0, offset: 0 }, "up", 10, 5);
    expect(result.index).toBe(0);
    expect(result.offset).toBe(0);
  });

  it("jumps to top", () => {
    const result = computeNav({ index: 7, offset: 3 }, "top", 10, 5);
    expect(result).toEqual({ index: 0, offset: 0 });
  });

  it("jumps to bottom", () => {
    const result = computeNav({ index: 0, offset: 0 }, "bottom", 10, 5);
    expect(result.index).toBe(9);
    expect(result.offset).toBe(5); // 9 - 5 + 1
  });

  it("advances scroll offset when selection moves below visible window", () => {
    // visible: rows 0-4, selection moves to 5
    const result = computeNav({ index: 4, offset: 0 }, "down", 10, 5);
    expect(result.index).toBe(5);
    expect(result.offset).toBe(1);
  });

  it("retreats scroll offset when selection moves above visible window", () => {
    // visible: rows 3-7, selection moves to 2
    const result = computeNav({ index: 3, offset: 3 }, "up", 10, 5);
    expect(result.index).toBe(2);
    expect(result.offset).toBe(2);
  });

  it("half-page down", () => {
    const result = computeNav({ index: 0, offset: 0 }, "halfDown", 20, 10);
    expect(result.index).toBe(5);
  });

  it("half-page up", () => {
    const result = computeNav({ index: 10, offset: 5 }, "halfUp", 20, 10);
    expect(result.index).toBe(5);
  });
});
