// src/__tests__/fuzzy.test.ts
import { describe, it, expect } from "bun:test";
import { createFuse, searchSessions } from "../fuzzy";
import type { Session } from "../types";

function makeSession(projectName: string, summary: string): Session {
  return {
    id: projectName,
    projectPath: `/Users/test/${projectName}`,
    projectName,
    startedAt: new Date(),
    updatedAt: new Date(),
    summary,
    turnCount: 0,
    filePath: `/tmp/${projectName}.jsonl`,
  };
}

const SESSIONS = [
  makeSession("master-control", "help me brainstorm a new app"),
  makeSession("ClaimsService", "set up helm chart and cicd pipeline"),
  makeSession("eligibilityservice", "fix the 834 parser crash"),
];

describe("searchSessions", () => {
  it("returns all sessions when query is empty", () => {
    const fuse = createFuse(SESSIONS);
    // fuse.js v7 returns all items for an empty query
    expect(searchSessions(fuse, "")).toHaveLength(SESSIONS.length);
  });

  it("finds sessions by project name", () => {
    const fuse = createFuse(SESSIONS);
    const results = searchSessions(fuse, "claims");
    expect(results).toHaveLength(1);
    expect(results[0].projectName).toBe("ClaimsService");
  });

  it("finds sessions by summary content", () => {
    const fuse = createFuse(SESSIONS);
    const results = searchSessions(fuse, "helm");
    expect(results[0].projectName).toBe("ClaimsService");
  });

  it("returns fuzzy matches", () => {
    const fuse = createFuse(SESSIONS);
    const results = searchSessions(fuse, "eligiblity"); // intentional typo
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].projectName).toBe("eligibilityservice");
  });
});
