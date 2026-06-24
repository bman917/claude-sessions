// src/components/TurnView.tsx
import React from "react";
import { Box, Text } from "ink";
import type { Turn } from "../types";

interface Props {
  turn: Turn;
}

export function TurnView({ turn }: Props) {
  const isUser = turn.role === "user";
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={isUser ? "green" : "blue"} bold>
        {isUser ? "[You]" : "[Claude]"}
      </Text>
      <Box paddingLeft={2}>
        <Text wrap="wrap">{turn.content}</Text>
      </Box>
    </Box>
  );
}
