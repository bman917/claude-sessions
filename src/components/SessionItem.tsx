// src/components/SessionItem.tsx
import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types";
import { relativeTime } from "../utils";

interface Props {
  session: Session;
  selected: boolean;
  width: number;
}

export function SessionItem({ session, selected, width }: Props) {
  const maxSummary = width - 4; // account for padding
  const summary = session.summary.length > maxSummary
    ? session.summary.slice(0, maxSummary - 1) + "…"
    : session.summary;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={selected ? "cyan" : undefined} bold={selected}>
          {selected ? "› " : "  "}
          {session.projectName}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>{relativeTime(session.updatedAt)}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor wrap="truncate">"{summary}"</Text>
      </Box>
    </Box>
  );
}
