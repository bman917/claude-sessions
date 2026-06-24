// src/utils.ts
export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}

export function truncateEnd(s: string, n: number): string {
  if (n <= 0) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function headerSummary(total: number, matchCount: number | null, query: string): string {
  if (matchCount !== null) return `${matchCount} of ${total} · filter: "${query}"`;
  return `${total} ${total === 1 ? "session" : "sessions"}`;
}
