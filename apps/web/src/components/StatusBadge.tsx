type Props = {
  status: string;
  map?: Record<string, string>;
};

const STATUS_CLASS: Record<string, string> = {
  running: "status-running",
  scraping: "status-running",
  organizing: "status-running",
  queued: "status-muted",
  pending: "status-muted",
  planned: "status-muted",
  paused: "status-warn",
  done: "status-ok",
  scraped: "status-ok",
  ok: "status-ok",
  failed: "status-error",
  cancelled: "status-muted",
  skipped: "status-muted",
};

export function StatusBadge({ status, map }: Props) {
  const label = map?.[status] ?? status;
  const cls = STATUS_CLASS[status] ?? "status-muted";
  return <span className={`status-badge ${cls}`}>{label}</span>;
}
