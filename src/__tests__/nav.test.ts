// src/__tests__/nav.test.ts
import { describe, it, expect } from "bun:test";
import { computeNav, computeBlockScroll } from "../nav";

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

describe("computeBlockScroll", () => {
  // three blocks of 2 lines each → 6 total lines
  const ranges = [
    { start: 0, len: 2 },
    { start: 2, len: 2 },
    { start: 4, len: 2 },
  ];

  it("moves the cursor to the next block when it already fits", () => {
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", ranges, 6, 6);
    expect(r).toEqual({ cursor: 1, offset: 0 });
  });

  it("scrolls within a block taller than the viewport instead of advancing", () => {
    const tall = [{ start: 0, len: 10 }];
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", tall, 10, 4);
    expect(r).toEqual({ cursor: 0, offset: 1 });
  });

  it("brings the next block into view when it would fall below the viewport", () => {
    // viewport shows 2 lines; on block 0, advancing to block 1 (lines 2-3) needs offset 2
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", ranges, 6, 2);
    expect(r.cursor).toBe(1);
    expect(r.offset).toBe(2);
  });

  it("retreats the cursor and reveals the previous block", () => {
    const r = computeBlockScroll({ cursor: 2, offset: 4 }, "up", ranges, 6, 2);
    expect(r.cursor).toBe(1);
    expect(r.offset).toBe(2);
  });

  it("jumps to top and bottom", () => {
    expect(computeBlockScroll({ cursor: 2, offset: 4 }, "top", ranges, 6, 2)).toEqual({ cursor: 0, offset: 0 });
    const bottom = computeBlockScroll({ cursor: 0, offset: 0 }, "bottom", ranges, 6, 2);
    expect(bottom.cursor).toBe(2);
    expect(bottom.offset).toBe(4); // maxOffset = 6 - 2
  });

  it("half-page down snaps the cursor to the topmost visible block", () => {
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "halfDown", ranges, 6, 4);
    expect(r.offset).toBe(2); // +half (2)
    expect(r.cursor).toBe(1); // block whose range covers line 2
  });

  it("returns zeroed state for empty ranges", () => {
    expect(computeBlockScroll({ cursor: 3, offset: 9 }, "down", [], 0, 5)).toEqual({ cursor: 0, offset: 0 });
  });
});

import { computeScrollTo } from "../nav";

describe("computeScrollTo", () => {
  it("centers the target line in the viewport", () => {
    // lineIndex=10, visibleRows=5 → center offset = 10 - floor(5/2) = 8
    expect(computeScrollTo(10, 5, 20)).toBe(8);
  });

  it("clamps to 0 when line is near the top", () => {
    expect(computeScrollTo(1, 5, 20)).toBe(0);
  });

  it("clamps to maxOffset at the bottom", () => {
    // maxOffset = 20 - 5 = 15; line 18 would center at 16 > 15 → clamp to 15
    expect(computeScrollTo(18, 5, 20)).toBe(15);
  });

  it("returns 0 when totalLines <= visibleRows", () => {
    expect(computeScrollTo(2, 5, 4)).toBe(0);
  });
});
