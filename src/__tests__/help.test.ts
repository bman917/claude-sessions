import { describe, it, expect } from "bun:test";
import { CATEGORIES, splitColumns } from "../help";

describe("CATEGORIES", () => {
  it("has at least 4 categories", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(4);
  });

  it("every category has a non-empty title and at least one binding", () => {
    for (const cat of CATEGORIES) {
      expect(cat.title.length).toBeGreaterThan(0);
      expect(cat.bindings.length).toBeGreaterThan(0);
    }
  });

  it("every binding has a non-empty key and description", () => {
    for (const cat of CATEGORIES) {
      for (const b of cat.bindings) {
        expect(b.key.length).toBeGreaterThan(0);
        expect(b.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("splitColumns", () => {
  it("splits at the given index", () => {
    const [left, right] = splitColumns(CATEGORIES, 2);
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(CATEGORIES.length - 2);
  });

  it("left + right contains all categories", () => {
    const [left, right] = splitColumns(CATEGORIES, 2);
    expect([...left, ...right]).toEqual(CATEGORIES);
  });

  it("splitAt 0 gives empty left column", () => {
    const [left, right] = splitColumns(CATEGORIES, 0);
    expect(left).toHaveLength(0);
    expect(right).toEqual(CATEGORIES);
  });
});
