// src/components/SearchBar.tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  query: string;
  focused: boolean;
  onChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onExit: () => void;
  matchCount: number | null;
  error: string | null;
}

export function SearchBar({
  query,
  focused,
  onChange,
  onSubmit,
  onExit,
  matchCount,
  error,
}: Props) {
  useInput(
    (input, key) => {
      if (key.escape) { onExit(); return; }
      if (key.backspace || key.delete) { onChange(query.slice(0, -1)); return; }
      if (key.return) { onSubmit(query); return; }
      if (!key.ctrl && !key.meta && input) onChange(query + input);
    },
    { isActive: focused }
  );

  return (
    <Box paddingX={1}>
      <Text color="yellow">/ </Text>
      <Text>{query || ""}</Text>
      {focused && <Text color="gray">█</Text>}
      {error ? (
        <Text color="red"> {error}</Text>
      ) : matchCount !== null ? (
        <Text dimColor> {matchCount} {matchCount === 1 ? "match" : "matches"}</Text>
      ) : null}
    </Box>
  );
}
