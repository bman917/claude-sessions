import React from "react";
import { Box, Text, useInput } from "ink";
import { CATEGORIES, splitColumns, type Category } from "../help";

interface Props {
  onClose: () => void;
  termCols: number;
}

function CategoryBlock({ category }: { category: Category }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="yellow">{category.title}</Text>
      {category.bindings.map((b) => (
        <Box key={b.key}>
          <Box width={20}><Text color="cyan">{b.key}</Text></Box>
          <Text dimColor>{b.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpScreen({ onClose, termCols }: Props) {
  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  const isTwoColumn = termCols >= 80;
  const [left, right] = isTwoColumn ? splitColumns(CATEGORIES, 2) : [CATEGORIES, []];

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">Claude Sessions — Help</Text>
      </Box>

      <Box flexDirection={isTwoColumn ? "row" : "column"} gap={isTwoColumn ? 4 : 0} flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          {left.map((cat) => <CategoryBlock key={cat.title} category={cat} />)}
        </Box>
        {isTwoColumn && (
          <Box flexDirection="column" flexGrow={1}>
            {right.map((cat) => <CategoryBlock key={cat.title} category={cat} />)}
          </Box>
        )}
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>? or Esc to close</Text>
      </Box>
    </Box>
  );
}
