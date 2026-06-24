// src/components/SessionDetail.tsx
import React from "react";
import { Box, Text } from "ink";
import path from "path";
import { relativeTime } from "../utils";
import type { Session } from "../types";
import type { Line } from "../render";

interface Props {
  session: Session | null;
  lines: Line[];
  turnCount: number;
  scrollOffset: number;
  visibleRows: number;
  focused: boolean;
  cursor: number;
}

export function SessionDetail({ session, lines, turnCount, scrollOffset, visibleRows, focused, cursor }: Props) {
  if (!session) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>Press Enter on a session to view it</Text>
      </Box>
    );
  }

  const visible = lines.slice(scrollOffset, scrollOffset + visibleRows);
  const maxOffset = Math.max(0, lines.length - visibleRows);
  const scrollable = lines.length > visibleRows;
  const pct = maxOffset === 0 ? 100 : Math.round((scrollOffset / maxOffset) * 100);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box>
        <Text bold color={focused ? "cyan" : undefined}>
          {session.projectPath}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {path.basename(session.filePath)} · {relativeTime(session.updatedAt)} · {turnCount} turns
          {scrollable ? ` · ${pct}%` : ""}
          {focused ? " · scrolling · Ctrl+O expand · Esc to list" : ""}
        </Text>
      </Box>
      <Box flexDirection="column">
        {visible.map((ln, i) => {
          const isLineFocused = ln.blockIndex === cursor;
          return (
            <Box key={scrollOffset + i}>
              <Text color="cyan">{isLineFocused ? "▌" : " "}</Text>
              <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                {ln.text === "" ? " " : ln.text}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
