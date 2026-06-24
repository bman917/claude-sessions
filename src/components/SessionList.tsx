// src/components/SessionList.tsx
import React from "react";
import { Box, Text } from "ink";
import type { ListRow } from "../listrender";

interface Props {
  rows: ListRow[];
  cursor: number;
  scrollOffset: number;
  visibleRows: number;
  width: number;
  dimmed?: boolean;
}

export function SessionList({ rows, cursor, scrollOffset, visibleRows, width, dimmed }: Props) {
  const visible = rows.slice(scrollOffset, scrollOffset + visibleRows);
  const highlight = dimmed ? "gray" : "blue";

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {visible.map((row, i) => {
        const key = scrollOffset + i;
        if (row.kind === "header") {
          return (
            <Box key={key}>
              <Text dimColor bold>{`── ${row.text} ──`}</Text>
            </Box>
          );
        }
        const selected = row.sessionIndex === cursor;
        const gutter = row.kind === "item-name" && selected ? "› " : "  ";
        return (
          <Box key={key}>
            <Text
              backgroundColor={selected ? highlight : undefined}
              color={selected && !dimmed ? "white" : undefined}
              bold={selected && !dimmed && row.kind === "item-name"}
              dimColor={!selected && row.kind === "item-summary"}
              wrap="truncate"
            >
              {gutter}
              {row.text}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
