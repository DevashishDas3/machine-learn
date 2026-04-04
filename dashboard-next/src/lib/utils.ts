export function formatDuration(startTs?: string, endTs?: string): string {
  if (!startTs) return "—";
  const start = new Date(startTs).getTime();
  const end = endTs ? new Date(endTs).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export function formatTs(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function bestMetric(
  metrics?: Record<string, number>,
  metric = "accuracy"
): number | null {
  if (!metrics) return null;
  const v = metrics[metric] ?? metrics[Object.keys(metrics)[0]];
  return typeof v === "number" ? v : null;
}

export function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export function truncateError(err?: string | null, maxLen = 160): string {
  if (!err) return "";
  const single = err.replace(/\n/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) + "…" : single;
}

/** Changed keys between two hyperparameter dicts, formatted as a short string. */
export function diffHyperparams(
  prev?: Record<string, unknown>,
  next?: Record<string, unknown>
): string {
  if (!next) return "";
  const prevObj = prev ?? {};
  const parts: string[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (prevObj[k] !== v) {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.slice(0, 4).join(", ");
}
