/** Compact relative-time formatter for list/table meta (server-rendered). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  return `${days} g`;
}

/** Human-friendly application reference shown instead of raw UUIDs in the UI. */
export function formatApplicationRef(id: string): string {
  const compact = (id ?? "").replace(/-/g, "").toUpperCase();
  if (!compact) {
    return "BASV-XXXX";
  }
  return `BASV-${compact.slice(0, 8)}`;
}

/** Customer-facing application number that never exposes a raw UUID. */
export function formatCustomerFileNo(id: string): string {
  const compact = (id ?? "").replace(/-/g, "").toUpperCase();
  if (!compact) {
    return "Dosya No: ASV-XXXXXX";
  }
  return `Dosya No: ASV-${compact.slice(0, 6)}`;
}

/** Compact ms duration for analytics (e.g. "3d 4h", "5h 12m", "42m"). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "—";
  }
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMin = minutes % 60;
    return remMin ? `${hours} sa ${remMin} dk` : `${hours} sa`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days} g ${remHours} sa` : `${days} g`;
}
