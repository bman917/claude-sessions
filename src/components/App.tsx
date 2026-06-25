// src/components/App.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Text, useInput, useStdout, useApp } from "ink";
import { loadSessions, loadBlocks } from "../sessions";
import { searchBodies } from "../search";
import { useBlockNav } from "../nav";
import { blocksToLines } from "../render";
import { sessionsToRows } from "../listrender";
import { headerSummary } from "../utils";
import { compileQuery, findMatches, findBlocksMatching } from "../insearch";
import type { Match } from "../insearch";
import { SearchBar } from "./SearchBar";
import { DetailSearchBar } from "./DetailSearchBar";
import { SessionList } from "./SessionList";
import { SessionDetail } from "./SessionDetail";
import { StatusBar } from "./StatusBar";
import { HelpScreen } from "./HelpScreen";
import type { Session, Block } from "../types";

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
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [turnCount, setTurnCount] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  // Ref so the useInput closure always reads the current value without re-registering.
  // Ink's useInput captures a closure; without this, double-registration on re-render
  // causes v=>!v to fire twice and cancel out.
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;

  // Detail-pane (in-session) search state
  const [dQuery, setDQuery] = useState("");
  const [dPattern, setDPattern] = useState<string | null>(null);
  const [dFocused, setDFocused] = useState(false);
  const [dMatchIdx, setDMatchIdx] = useState(0);
  const [dError, setDError] = useState<string | null>(null);

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

  const handleDetailSearchSubmit = (q: string) => {
    setDFocused(false);
    if (!q.trim()) {
      setDPattern(null);
      setDError(null);
      return;
    }
    const re = compileQuery(q);
    if (!re) {
      setDError("invalid regex");
      setDFocused(true); // keep prompt open
      return;
    }
    // Auto-expand all blocks that contain matches.
    const matchingBlocks = findBlocksMatching(blocks, detailWidth, re);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const idx of matchingBlocks) next.add(idx);
      return next;
    });
    setDPattern(q);
    setDMatchIdx(0);
    setDError(null);
  };

  const listPaneWidth = showDetail ? LIST_WIDTH : termCols;
  // Overhead: 1 (header) + 3 (SearchBar round border) + 2 (StatusBar top border + text) = 6
  const listVisibleRows = Math.max(1, termRows - 6);
  const detailVisibleRows = Math.max(1, termRows - 6);
  const detailWidth = Math.max(20, termCols - LIST_WIDTH - 4);

  const { rows: listRows, ranges: listRanges } = useMemo(
    () => sessionsToRows(filteredSessions, listPaneWidth),
    [filteredSessions, listPaneWidth]
  );

  // Flatten the selected conversation into scrollable lines + per-block ranges.
  const { lines, ranges } = useMemo(
    () => blocksToLines(blocks, detailWidth, expanded),
    [blocks, detailWidth, expanded]
  );

  const detailFocused = focus === "detail";

  // Derive matches from active pattern + currently rendered lines.
  const dRegex = useMemo(
    () => (dPattern ? compileQuery(dPattern) : null),
    [dPattern]
  );
  const matches: Match[] = useMemo(
    () => (dRegex ? findMatches(lines, dRegex) : []),
    [lines, dRegex]
  );

  // Clamp matchIdx when matches shrinks (expand/collapse/resize reflow).
  useEffect(() => {
    if (matches.length > 0) {
      setDMatchIdx((prev) => Math.min(prev, matches.length - 1));
    } else {
      setDMatchIdx(0);
    }
  }, [matches.length]);

  const { cursor: selectedIndex, offset: listScroll, reset: resetList } = useBlockNav(
    listRanges,
    listRows.length,
    listVisibleRows,
    !searchFocused && focus === "list"
  );

  const { cursor: detailCursor, offset: detailScroll, reset: resetDetailScroll, jumpTo: jumpToDetail } = useBlockNav(
    ranges,
    lines.length,
    detailVisibleRows,
    !searchFocused && !dFocused && detailFocused
  );

  // Ref so the jump effect always calls the latest jumpToDetail without
  // adding it to deps (it's a new reference every render from useBlockNav).
  const jumpToDetailRef = useRef(jumpToDetail);
  jumpToDetailRef.current = jumpToDetail;

  // Jump to the current match whenever matchIdx or matches change.
  useEffect(() => {
    if (matches.length > 0 && dPattern) {
      const m = matches[dMatchIdx];
      jumpToDetailRef.current(m.lineIndex, m.blockIndex);
    }
  }, [dMatchIdx, matches]);

  // Reset detail-search when the selected session changes.
  useEffect(() => {
    setDQuery("");
    setDPattern(null);
    setDFocused(false);
    setDMatchIdx(0);
    setDError(null);
  }, [selectedSession?.id]);

  const currentMatch = matches.length > 0 ? matches[dMatchIdx] : null;
  const matchInfo =
    dPattern
      ? { index: dMatchIdx, total: matches.length }
      : null;

  // Reset everything when the applied filter changes
  useEffect(() => {
    resetList();
    setFocus("list");
    setSelectedSession(null);
    setBlocks([]);
    setExpanded(new Set());
  }, [matchedIds]);

  // q quits regardless of mode — exit() lets Ink restore the terminal cleanly
  useInput((input) => {
    if (input === "q") exit();
    if (input === "?" && !searchFocused) setHelpOpen(!helpOpenRef.current);
  });

  // Action keys — inactive while search is focused. j/k are owned by
  // useBlockNav (list or detail) depending on focus, so they are
  // intentionally not handled here.
  useInput(
    (input, key) => {
      if (key.escape) {
        if (detailFocused) {
          if (dPattern) {
            // First Esc clears in-session search; second Esc returns to list.
            setDPattern(null);
            setDQuery("");
            setDError(null);
          } else {
            setFocus("list");
          }
        }
        return;
      }
      if (key.ctrl && input === "o" && detailFocused) {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(detailCursor)) next.delete(detailCursor);
          else next.add(detailCursor);
          return next;
        });
        return;
      }
      if (input === "/") {
        if (focus === "list") setSearchFocused(true);
        else if (focus === "detail") setDFocused(true);
        return;
      }
      if (input === "n" && detailFocused && dPattern) {
        setDMatchIdx((prev) => (matches.length === 0 ? 0 : (prev + 1) % matches.length));
        return;
      }
      if (input === "N" && detailFocused && dPattern) {
        setDMatchIdx((prev) => (matches.length === 0 ? 0 : (prev - 1 + matches.length) % matches.length));
        return;
      }
      if (key.return && focus === "list") {
        const session = filteredSessions[selectedIndex];
        if (!session) return;
        setSelectedSession(session);
        const { blocks: b, turnCount: tc } = loadBlocks(session);
        setBlocks(b);
        setTurnCount(tc);
        setExpanded(new Set());
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
    { isActive: !searchFocused && !helpOpen && !dFocused }
  );

  return (
    <Box flexDirection="column" height={termRows}>
      {helpOpen ? (
        <HelpScreen onClose={() => setHelpOpen(false)} termCols={termCols} />
      ) : (
        <>
          {/* Header */}
          <Box paddingX={1} justifyContent="space-between">
            <Text bold color="cyan">Claude Sessions</Text>
            <Text dimColor>
              {headerSummary(sessions.length, matchedIds ? filteredSessions.length : null, query)}
            </Text>
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
              rows={listRows}
              cursor={selectedIndex}
              scrollOffset={listScroll}
              visibleRows={listVisibleRows}
              width={listPaneWidth}
              dimmed={detailFocused}
            />
            {showDetail && (
              <>
                <Box
                  borderStyle="single"
                  borderColor={detailFocused ? "cyan" : "gray"}
                  borderLeft
                  borderRight={false}
                  borderTop={false}
                  borderBottom={false}
                />
                <SessionDetail
                  session={selectedSession}
                  lines={lines}
                  turnCount={turnCount}
                  scrollOffset={detailScroll}
                  visibleRows={detailVisibleRows}
                  focused={detailFocused}
                  cursor={detailCursor}
                  currentMatch={currentMatch}
                  matchInfo={matchInfo}
                  matchError={dError}
                />
              </>
            )}
          </Box>

          {/* Detail search prompt — shown only while dFocused */}
          {dFocused && (
            <DetailSearchBar
              query={dQuery}
              focused={dFocused}
              error={dError}
              onChange={setDQuery}
              onSubmit={handleDetailSearchSubmit}
              onCancel={() => setDFocused(false)}
            />
          )}

          {/* Status bar */}
          <StatusBar focus={focus} hasDetail={showDetail && selectedSession !== null} />
        </>
      )}
    </Box>
  );
}
