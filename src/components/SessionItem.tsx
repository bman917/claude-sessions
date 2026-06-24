// src/components/SessionItem.tsx
import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types";
import { relativeTime } from "../utils";

interface Props {
  session: Session;
  selected: boolean;
  width: number;
  dimmed?: boolean;
}

export function SessionItem({ session, selected, width, dimmed }: Props) {
  const maxSummary = width - 4; // account for padding
  const summary = session.summary.length > maxSummary
    ? session.summary.slice(0, maxSummary - 1) + "…"
    : session.summary;

  // When the detail pane has focus, show the selection muted so it's clear
  // the list isn't the active pane.
  const selectedColor = selected ? (dimmed ? "gray" : "cyan") : undefined;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={selectedColor} bold={selected && !dimmed}>
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
