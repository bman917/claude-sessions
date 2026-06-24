// src/components/SessionDetail.tsx
import React from "react";
import { Box, Text } from "ink";
import { TurnView } from "./TurnView";
import { relativeTime } from "../utils";
import type { Session, Turn } from "../types";

interface Props {
  session: Session | null;
  turns: Turn[];
  turnCount: number;
  visibleRows: number;
}

export function SessionDetail({ session, turns, turnCount, visibleRows }: Props) {
  if (!session) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>Select a session to view</Text>
      </Box>
    );
  }

  // Show most recent turns that fit
  const visibleTurns = turns.slice(-visibleRows);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>{session.projectPath}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {relativeTime(session.updatedAt)} · {turnCount} turns
        </Text>
      </Box>
      <Box flexDirection="column">
        {visibleTurns.map((turn, i) => (
          <TurnView key={i} turn={turn} />
        ))}
      </Box>
    </Box>
  );
}
