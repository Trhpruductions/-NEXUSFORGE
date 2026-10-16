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
