// src/components/App.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { loadSessions, loadTurns } from "../sessions";
import { createFuse, searchSessions } from "../fuzzy";
import { useVimNav } from "../nav";
import { SearchBar } from "./SearchBar";
import { SessionList } from "./SessionList";
import { SessionDetail } from "./SessionDetail";
import { StatusBar } from "./StatusBar";
import type { Session, Turn } from "../types";

const LIST_WIDTH = 35;

export function App() {
  const { stdout } = useStdout();
  const termCols = stdout.columns;
  const termRows = stdout.rows;
  const showDetail = termCols >= 80;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnCount, setTurnCount] = useState(0);

  // Load sessions on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
  }, []);

  const fuse = useMemo(() => createFuse(sessions), [sessions]);
  const filteredSessions = useMemo(
    () => (query ? searchSessions(fuse, query) : sessions),
    [fuse, query, sessions]
  );

  const listVisibleRows = termRows - 4;
  const detailVisibleRows = termRows - 6;
  const itemHeight = 3; // each SessionItem takes 3 rows

  const { index: selectedIndex, offset: scrollOffset, reset } = useVimNav(
    filteredSessions.length,
    Math.max(1, Math.floor(listVisibleRows / itemHeight)),
    !searchFocused
  );

  // Reset scroll and clear detail when query changes
  useEffect(() => {
    reset();
    setSelectedSession(null);
    setTurns([]);
  }, [query]);

  // q quits regardless of mode
  useInput((input) => {
    if (input === "q") process.exit(0);
  });

  // Navigation and action keys — inactive while search is focused
  useInput(
    (input, key) => {
      if (input === "/") { setSearchFocused(true); return; }
      if (key.return) {
        const session = filteredSessions[selectedIndex];
        if (!session) return;
        setSelectedSession(session);
        const { turns: t, turnCount: tc } = loadTurns(session);
        setTurns(t);
        setTurnCount(tc);
      }
      if (input === "r" && selectedSession) {
        Bun.spawn(["claude", "--resume", selectedSession.id], {
          stdio: ["inherit", "inherit", "inherit"],
        });
        process.exit(0);
      }
    },
    { isActive: !searchFocused }
  );

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">Claude Sessions</Text>
        <Text dimColor>q to quit</Text>
      </Box>

      {/* Search bar */}
      <SearchBar
        query={query}
        focused={searchFocused}
        onChange={setQuery}
        onExit={() => setSearchFocused(false)}
      />

      {/* Main panes */}
      <Box flexGrow={1} flexDirection="row">
        <SessionList
          sessions={filteredSessions}
          selectedIndex={selectedIndex}
          scrollOffset={scrollOffset}
          visibleRows={Math.max(1, Math.floor(listVisibleRows / itemHeight))}
          width={showDetail ? LIST_WIDTH : termCols}
        />
        {showDetail && (
          <>
            <Box borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} />
            <SessionDetail
              session={selectedSession}
              turns={turns}
              turnCount={turnCount}
              visibleRows={detailVisibleRows}
            />
          </>
        )}
      </Box>

      {/* Status bar */}
      <StatusBar />
    </Box>
  );
}
