const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2 });

/** Formats integer cents. Callers pass the currency of the records being shown. */
export function formatCents(cents: number, currency = "usd") {
  return currencyFormatter(currency).format(cents / 100);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Percentage change between a current and a previous value. Null when there is no previous value to compare. */
export function percentChange(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatChange(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined) return "No comparison period";
  if (previous === 0) return "Previous period was zero, so no percentage";
  const change = percentChange(current, previous);
  if (change === null) return "No comparison period";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs previous period`;
}
