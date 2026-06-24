// src/components/SessionList.tsx
import React from "react";
import { Box } from "ink";
import { SessionItem } from "./SessionItem";
import type { Session } from "../types";

interface Props {
  sessions: Session[];
  selectedIndex: number;
  scrollOffset: number;
  visibleRows: number;
  width: number;
  dimmed?: boolean;
}

export function SessionList({ sessions, selectedIndex, scrollOffset, visibleRows, width, dimmed }: Props) {
  const visible = sessions.slice(scrollOffset, scrollOffset + visibleRows);

  return (
    <Box flexDirection="column" width={width}>
      {visible.map((session, i) => (
        <SessionItem
          key={session.id}
          session={session}
          selected={scrollOffset + i === selectedIndex}
          dimmed={dimmed}
          width={width}
        />
      ))}
    </Box>
  );
}
