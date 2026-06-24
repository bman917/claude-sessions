// src/index.tsx
import React from "react";
import { render } from "ink";
import { App } from "./components/App";
import { execReplace } from "./exec";
import type { Session } from "./types";

let resumeTarget: Session | null = null;

const instance = render(
  <App
    onResume={(session) => {
      resumeTarget = session;
    }}
  />
);

// Wait for Ink to fully unmount (terminal modes restored, cursor shown,
// pending query responses drained) before handing the terminal to claude.
await instance.waitUntilExit();

if (resumeTarget) {
  const session: Session = resumeTarget;
  // Resume in the session's own project directory, and replace this process
  // with claude entirely — no lingering parent.
  process.chdir(session.projectPath);
  execReplace(["claude", "--resume", session.id]);
  // Only reached if exec failed.
  console.error(`Failed to launch: claude --resume ${session.id}`);
  process.exit(1);
}
