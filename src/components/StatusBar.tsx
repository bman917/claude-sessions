// src/components/StatusBar.tsx
import React from "react";
import { Box, Text } from "ink";

export function StatusBar() {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>j/k navigate · / search · enter select · r resume · q quit</Text>
    </Box>
  );
}
