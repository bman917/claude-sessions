// src/components/App.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, useStdout, useApp } from "ink";
import { loadSessions, loadTurns } from "../sessions";
import { searchBodies } from "../search";
import { useVimNav, useScroll } from "../nav";
import { turnsToLines } from "../render";
import { SearchBar } from "./SearchBar";
import { SessionList } from "./SessionList";
import { SessionDetail } from "./SessionDetail";
import { StatusBar } from "./StatusBar";
import type { Session, Turn } from "../types";

const LIST_WIDTH = 35;

type Focus = "list" | "detail";

interface AppProps {
  // Called when the user requests resume. The entry point unmounts Ink
  // (restoring the terminal) before launching `claude --resume`.
  onResume?: (session: Session) => void;
}

export function App({ onResume }: AppProps = {}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termCols = stdout.columns;
  const termRows = stdout.rows;
  const showDetail = termCols >= 80;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  // null means no active filter; a set restricts the list to matching session ids.
  const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [focus, setFocus] = useState<Focus>("list");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnCount, setTurnCount] = useState(0);

  // Load sessions on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
  }, []);

  const filteredSessions = useMemo(
    () => (matchedIds ? sessions.filter((s) => matchedIds.has(s.id)) : sessions),
    [matchedIds, sessions]
  );

  // Run ripgrep over the transcript bodies on Enter. An empty query clears the
  // filter; an rg failure leaves the list unfiltered and surfaces an error.
  const handleSearchSubmit = (q: string) => {
    setSearchFocused(false);
    if (!q.trim()) {
      setMatchedIds(null);
      setSearchError(null);
      return;
    }
    const result = searchBodies(q);
    if (result.ok) {
      setMatchedIds(result.ids);
      setSearchError(null);
    } else {
      setMatchedIds(null);
      setSearchError(result.error === "rg-missing" ? "ripgrep not found" : "search error");
    }
  };

  const listVisibleRows = termRows - 4;
  const detailVisibleRows = Math.max(1, termRows - 6);
  const itemHeight = 3; // each SessionItem takes 3 rows
  const detailWidth = Math.max(20, termCols - LIST_WIDTH - 4);

  // Flatten the selected session's conversation into scrollable lines.
  const lines = useMemo(() => turnsToLines(turns, detailWidth), [turns, detailWidth]);

  const detailFocused = focus === "detail";

  const { index: selectedIndex, offset: listScroll, reset: resetList } = useVimNav(
    filteredSessions.length,
    Math.max(1, Math.floor(listVisibleRows / itemHeight)),
    !searchFocused && focus === "list"
  );

  const { offset: detailScroll, reset: resetDetailScroll } = useScroll(
    lines.length,
    detailVisibleRows,
    !searchFocused && detailFocused
  );

  // Reset everything when the applied filter changes
  useEffect(() => {
    resetList();
    setFocus("list");
    setSelectedSession(null);
    setTurns([]);
  }, [matchedIds]);

  // q quits regardless of mode — exit() lets Ink restore the terminal cleanly
  useInput((input) => {
    if (input === "q") exit();
  });

  // Action keys — inactive while search is focused. j/k are owned by
  // useVimNav (list) or useScroll (detail) depending on focus, so they are
  // intentionally not handled here.
  useInput(
    (input, key) => {
      if (key.escape) {
        if (detailFocused) setFocus("list");
        return;
      }
      if (input === "/") {
        if (focus === "list") setSearchFocused(true);
        return;
      }
      if (key.return && focus === "list") {
        const session = filteredSessions[selectedIndex];
        if (!session) return;
        setSelectedSession(session);
        const { turns: t, turnCount: tc } = loadTurns(session);
        setTurns(t);
        setTurnCount(tc);
        if (showDetail) {
          resetDetailScroll();
          setFocus("detail");
        }
        return;
      }
      if (input === "r" && selectedSession) {
        // Hand off to the entry point: it unmounts Ink (restoring terminal
        // modes and draining query responses) before spawning claude.
        onResume?.(selectedSession);
        exit();
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
        onSubmit={handleSearchSubmit}
        onExit={() => setSearchFocused(false)}
        matchCount={matchedIds ? filteredSessions.length : null}
        error={searchError}
      />

      {/* Main panes */}
      <Box flexGrow={1} flexDirection="row">
        <SessionList
          sessions={filteredSessions}
          selectedIndex={selectedIndex}
          scrollOffset={listScroll}
          visibleRows={Math.max(1, Math.floor(listVisibleRows / itemHeight))}
          width={showDetail ? LIST_WIDTH : termCols}
          dimmed={detailFocused}
        />
        {showDetail && (
          <>
            <Box borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} />
            <SessionDetail
              session={selectedSession}
              lines={lines}
              turnCount={turnCount}
              scrollOffset={detailScroll}
              visibleRows={detailVisibleRows}
              focused={detailFocused}
            />
          </>
        )}
      </Box>

      {/* Status bar */}
      <StatusBar focus={focus} hasDetail={showDetail && selectedSession !== null} />
    </Box>
  );
}
