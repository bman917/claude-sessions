import { describe, it, expect } from "bun:test";
import { scrollbar } from "../scrollbar";

describe("scrollbar", () => {
  it("returns blanks when all content fits", () => {
    expect(scrollbar(0, 5, 10)).toEqual([" ", " ", " ", " ", " ", " ", " ", " ", " ", " "]);
  });

  it("has the right number of cells", () => {
    expect(scrollbar(0, 100, 10).length).toBe(10);
  });

  it("puts the thumb at the top when offset is 0", () => {
    const bar = scrollbar(0, 100, 10);
    expect(bar[0]).toBe("█");
    expect(bar[bar.length - 1]).toBe("░");
  });

  it("puts the thumb at the bottom at max offset", () => {
    const bar = scrollbar(90, 100, 10); // maxOffset = 90
    expect(bar[bar.length - 1]).toBe("█");
    expect(bar[0]).toBe("░");
  });
});
