// src/components/DetailSearchBar.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  query: string;
  focused: boolean;
  error: string | null;
  onChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onCancel: () => void;
}

export function DetailSearchBar({ query, focused, error, onChange, onSubmit, onCancel }: Props) {
  const [cursor, setCursor] = useState(query.length);

  useEffect(() => {
    setCursor((c) => Math.min(c, query.length));
  }, [query.length]);

  useInput(
    (input, key) => {
      if (key.escape) { onCancel(); return; }
      if (key.return) { onSubmit(query); return; }

      if (key.leftArrow)  { setCursor((c) => Math.max(0, c - 1)); return; }
      if (key.rightArrow) { setCursor((c) => Math.min(query.length, c + 1)); return; }

      if (key.ctrl) {
        if (input === "a") { setCursor(0); return; }
        if (input === "e") { setCursor(query.length); return; }
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

  const before = query.slice(0, cursor);
  const atCursor = query[cursor] ?? "";
  const after = query.slice(cursor + 1);

  return (
    <Box paddingX={1}>
      <Text color="cyan">{"/ "}</Text>
      {query === "" && !error ? (
        <Text dimColor>Search in session…</Text>
      ) : (
        <>
          <Text>{before}</Text>
          <Text backgroundColor="gray" color="black">{atCursor || " "}</Text>
          <Text>{after}</Text>
        </>
      )}
      {error && <Text color="red">{" " + error}</Text>}
    </Box>
  );
}
