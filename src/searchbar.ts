// src/searchbar.ts
// Pure view-state for the search bar so the component stays presentational.

export interface SearchBarView {
  borderColor: string; // "red" on error, "cyan" when focused or filtering, else "gray"
  showPlaceholder: boolean;
  status: { text: string; color?: string } | null;
}

export function searchBarView(p: {
  query: string;
  focused: boolean;
  matchCount: number | null;
  error: string | null;
}): SearchBarView {
  const filtering = p.matchCount !== null;
  const borderColor = p.error ? "red" : p.focused || filtering ? "cyan" : "gray";
  const showPlaceholder = !p.focused && !filtering && p.query === "" && !p.error;

  let status: SearchBarView["status"] = null;
  if (p.error) {
    status = { text: p.error, color: "red" };
  } else if (p.matchCount !== null) {
    status = {
      text: `${p.matchCount} ${p.matchCount === 1 ? "match" : "matches"}`,
      color: "cyan",
    };
  }

  return { borderColor, showPlaceholder, status };
}
