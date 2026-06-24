// src/components/SearchBar.tsx
import React from "react";
import { Box, Text, useInput } from "ink";
import { searchBarView } from "../searchbar";

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

  const view = searchBarView({ query, focused, matchCount, error });

  return (
    <Box
      borderStyle="round"
      borderColor={view.borderColor}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color={focused ? "cyan" : "gray"}>{"🔍 "}</Text>
        {view.showPlaceholder ? (
          <Text dimColor>Search transcripts  (press /)</Text>
        ) : (
          <Text>{query}</Text>
        )}
        {focused && <Text color="gray">{"█"}</Text>}
      </Box>
      {view.status && <Text color={view.status.color}>{view.status.text}</Text>}
    </Box>
  );
}
