// src/components/SessionDetail.tsx
import React from "react";
import { Box, Text } from "ink";
import { relativeTime } from "../utils";
import { scrollbar } from "../scrollbar";
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
  currentMatch: { lineIndex: number; col: number; length: number } | null;
  matchInfo: { index: number; total: number } | null;
  matchError: string | null;
}

export function SessionDetail({
  session,
  lines,
  turnCount,
  scrollOffset,
  visibleRows,
  focused,
  cursor,
  currentMatch,
  matchInfo,
  matchError,
}: Props) {
  if (!session) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>Press Enter on a session to view it</Text>
      </Box>
    );
  }

  const visible = lines.slice(scrollOffset, scrollOffset + visibleRows);
  const bar = scrollbar(scrollOffset, lines.length, visibleRows);
  const maxOffset = Math.max(0, lines.length - visibleRows);
  const scrollable = lines.length > visibleRows;
  const pct = maxOffset === 0 ? 100 : Math.round((scrollOffset / maxOffset) * 100);

  const matchStatus = matchError
    ? <Text color="red"> · {matchError}</Text>
    : matchInfo
      ? matchInfo.total === 0
        ? <Text dimColor> · no matches</Text>
        : <Text dimColor> · {matchInfo.index + 1}/{matchInfo.total}</Text>
      : null;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box>
        <Text bold color={focused ? "cyan" : undefined}>
          {session.projectPath}
        </Text>
        {matchStatus}
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {relativeTime(session.updatedAt)} · {turnCount} {turnCount === 1 ? "turn" : "turns"}
          {scrollable ? ` · ${pct}%` : ""}
        </Text>
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          {visible.map((ln, i) => {
            const absoluteLineIndex = scrollOffset + i;
            const isLineFocused = ln.blockIndex === cursor;
            const isMatchLine =
              currentMatch !== null && absoluteLineIndex === currentMatch.lineIndex;

            return (
              <Box key={absoluteLineIndex}>
                <Text color={isLineFocused ? "cyan" : ln.accent} dimColor={!isLineFocused}>
                  {isLineFocused ? "▌" : ln.accent ? "│" : " "}
                </Text>
                {isMatchLine ? (
                  <>
                    <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                      {ln.text.slice(0, currentMatch.col)}
                    </Text>
                    <Text
                      backgroundColor="yellow"
                      color="black"
                      bold
                      wrap="truncate"
                    >
                      {ln.text.slice(currentMatch.col, currentMatch.col + currentMatch.length)}
                    </Text>
                    <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                      {ln.text.slice(currentMatch.col + currentMatch.length)}
                    </Text>
                  </>
                ) : (
                  <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                    {ln.text === "" ? " " : ln.text}
                  </Text>
                )}
                {isLineFocused && ln.hint ? <Text dimColor>{"   "}{ln.hint}</Text> : null}
              </Box>
            );
          })}
        </Box>
        <Box flexDirection="column" width={1}>
          {bar.map((c, i) => (
            <Text key={i} dimColor>{c}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
