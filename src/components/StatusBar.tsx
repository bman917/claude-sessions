// src/components/StatusBar.tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  focus?: "list" | "detail";
  hasDetail?: boolean;
}

export function StatusBar({ focus = "list", hasDetail = false }: Props) {
  const hint =
    focus === "detail"
      ? "j/k scroll · Ctrl-d/u page · g/G top/bottom · Ctrl+O expand · r resume · Esc back · q quit"
      : hasDetail
        ? "j/k navigate · / search · enter view · r resume · q quit"
        : "j/k navigate · / search · enter view · q quit";

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
