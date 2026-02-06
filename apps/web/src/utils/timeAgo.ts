/**
 * Converts an ISO timestamp into a compact relative label used by the article list.
 */
export function timeAgo(iso: string | null): string {
  if (!iso) {
    return "Unknown";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    return "Unknown";
  }

  const now = Date.now();
  const deltaMs = now - date.valueOf();

  if (deltaMs < 0) {
    return "Just now";
  }

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (deltaMs < minute) {
    return "Just now";
  }

  if (deltaMs < hour) {
    return `${Math.floor(deltaMs / minute)}m ago`;
  }

  if (deltaMs < day) {
    return `${Math.floor(deltaMs / hour)}h ago`;
  }

  if (deltaMs < week) {
    return `${Math.floor(deltaMs / day)}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
