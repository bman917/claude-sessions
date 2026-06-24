// src/index.tsx
import React from "react";
import { render } from "ink";
import { App } from "./components/App";
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
  Bun.spawnSync(["claude", "--resume", session.id], {
    cwd: session.projectPath,
    stdio: ["inherit", "inherit", "inherit"],
  });
}
