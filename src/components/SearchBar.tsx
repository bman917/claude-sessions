// src/components/SearchBar.tsx
import React, { useState, useEffect } from "react";
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
  const [cursor, setCursor] = useState(query.length);

  useEffect(() => {
    setCursor((c) => Math.min(c, query.length));
  }, [query.length]);

  useInput(
    (input, key) => {
      if (key.escape) { onExit(); return; }
      if (key.return) { onSubmit(query); return; }

      if (key.leftArrow)  { setCursor((c) => Math.max(0, c - 1)); return; }
      if (key.rightArrow) { setCursor((c) => Math.min(query.length, c + 1)); return; }

      if (key.ctrl) {
        if (input === "a") { setCursor(0); return; }
        if (input === "e") { setCursor(query.length); return; }
        if (input === "f") { setCursor((c) => Math.min(query.length, c + 1)); return; }
        if (input === "b") { setCursor((c) => Math.max(0, c - 1)); return; }
        if (input === "u") { onChange(query.slice(cursor)); setCursor(0); return; }
        if (input === "l") { onChange(""); setCursor(0); return; }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursor > 0) {
          onChange(query.slice(0, cursor - 1) + query.slice(cursor));
          setCursor(cursor - 1);
        }
        return;
      }

      if (!key.meta && input) {
        onChange(query.slice(0, cursor) + input + query.slice(cursor));
        setCursor(cursor + input.length);
      }
    },
    { isActive: focused }
  );

  const view = searchBarView({ query, focused, matchCount, error });

  const before = query.slice(0, cursor);
  const atCursor = query[cursor] ?? "";
  const after = query.slice(cursor + 1);

  return (
    <Box
      borderStyle="round"
      borderColor={view.borderColor}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color={focused ? "cyan" : "gray"}>{"/ "}</Text>
        {view.showPlaceholder ? (
          <Text dimColor>Regex search  (press /)</Text>
        ) : focused ? (
          <>
            <Text>{before}</Text>
            <Text backgroundColor="gray" color="black">{atCursor || " "}</Text>
            <Text>{after}</Text>
          </>
        ) : (
          <Text>{query}</Text>
        )}
      </Box>
      {view.status && <Text color={view.status.color}>{view.status.text}</Text>}
    </Box>
  );
}
