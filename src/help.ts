export interface Binding {
  key: string;
  description: string;
}

export interface Category {
  title: string;
  bindings: Binding[];
}

export const CATEGORIES: Category[] = [
  {
    title: "NAVIGATION",
    bindings: [
      { key: "j / ↓",   description: "move down" },
      { key: "k / ↑",   description: "move up" },
      { key: "g g",      description: "top" },
      { key: "G",        description: "bottom" },
      { key: "Ctrl+d",   description: "page down" },
      { key: "Ctrl+u",   description: "page up" },
    ],
  },
  {
    title: "ACTIONS",
    bindings: [
      { key: "Enter",    description: "open session" },
      { key: "r",        description: "resume in Claude" },
      { key: "Esc",      description: "back to list" },
      { key: "q",        description: "quit" },
      { key: "?",        description: "toggle help" },
    ],
  },
  {
    title: "SEARCH",
    bindings: [
      { key: "/",           description: "open search" },
      { key: "Enter",       description: "submit" },
      { key: "Esc",         description: "close search" },
      { key: "← → Ctrl+f/b", description: "move cursor" },
      { key: "Ctrl+a",      description: "beginning of line" },
      { key: "Ctrl+e",      description: "end of line" },
      { key: "Ctrl+u",      description: "delete to beginning" },
      { key: "Ctrl+l",      description: "clear" },
    ],
  },
  {
    title: "DETAIL PANE",
    bindings: [
      { key: "Ctrl+o",   description: "expand / collapse block" },
    ],
  },
];

export function splitColumns(
  categories: Category[],
  splitAt: number
): [Category[], Category[]] {
  return [categories.slice(0, splitAt), categories.slice(splitAt)];
}
