// src/__tests__/scroll.test.ts
import { describe, it, expect } from "bun:test";
import { computeScroll } from "../nav";

describe("computeScroll", () => {
  it("scrolls down by one line", () => {
    expect(computeScroll(0, "down", 20, 10)).toBe(1);
  });

  it("scrolls up by one line", () => {
    expect(computeScroll(5, "up", 20, 10)).toBe(4);
  });

  it("clamps at the top", () => {
    expect(computeScroll(0, "up", 20, 10)).toBe(0);
  });

  it("clamps at the bottom (maxOffset = total - visible)", () => {
    expect(computeScroll(10, "down", 20, 10)).toBe(10);
  });

  it("jumps to top", () => {
    expect(computeScroll(7, "top", 20, 10)).toBe(0);
  });

  it("jumps to bottom", () => {
    expect(computeScroll(0, "bottom", 20, 10)).toBe(10);
  });

  it("half-page down", () => {
    expect(computeScroll(0, "halfDown", 40, 10)).toBe(5);
  });

  it("half-page up", () => {
    expect(computeScroll(20, "halfUp", 40, 10)).toBe(15);
  });

  it("returns 0 when content fits entirely", () => {
    expect(computeScroll(0, "down", 5, 10)).toBe(0);
    expect(computeScroll(0, "bottom", 5, 10)).toBe(0);
  });
});
