// src/fuzzy.ts
import Fuse, { type IFuseOptions } from "fuse.js";
import type { Session } from "./types";

const FUSE_OPTIONS: IFuseOptions<Session> = {
  keys: [
    { name: "projectName", weight: 0.6 },
    { name: "summary", weight: 0.4 },
  ],
  threshold: 0.4,
};

export function createFuse(sessions: Session[]): Fuse<Session> {
  return new Fuse(sessions, FUSE_OPTIONS);
}

export function searchSessions(fuse: Fuse<Session>, query: string): Session[] {
  return fuse.search(query).map((r) => r.item);
}
