/** Pure formatting for the daily beta pulse (no database or Discord imports, so it is unit-testable). */

export type PulseStats = {
  newUsers: number;
  newVerified: number;
  totalUsers: number;
  activeUsers: number;
  messages: number;
  directMessages: number;
  newForges: number;
  totalForges: number;
  payments: number;
  paymentCents: number;
  paidActive: number;
  lifetime: number;
  problemNew: number;
  problemOpen: number;
  ticketsNew: number;
  ticketsWaiting: number;
  errorGroups: number;
  errorHits: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The post body. Kept under Discord's 1024-character field limit. */
export function composePulse(stats: PulseStats, siteUrl: string): string {
  const site = siteUrl.replace(/\/+$/, "");
  const lines = [
    "**Last 24 hours**",
    `• Sign-ups: ${stats.newUsers} (${stats.newVerified} verified) · ${stats.totalUsers} accounts in total`,
    `• People active: ${stats.activeUsers}`,
    `• Messages: ${stats.messages} in servers, ${stats.directMessages} in DMs`,
    `• New servers: ${stats.newForges} · ${stats.totalForges} in total`,
    `• Core+: ${plural(stats.payments, "payment")} (${money(stats.paymentCents)}) · ${stats.paidActive} paid, ${stats.lifetime} lifetime`,
  ];

  const attention: string[] = [];
  if (stats.problemNew || stats.problemOpen) attention.push(`• Problem reports: ${stats.problemNew} new · ${stats.problemOpen} open → ${site}/admin/problem-reports`);
  if (stats.ticketsNew || stats.ticketsWaiting) attention.push(`• Support tickets: ${stats.ticketsNew} new · ${stats.ticketsWaiting} waiting on staff → ${site}/app/support`);
  if (stats.errorGroups) attention.push(`• Server errors: ${plural(stats.errorGroups, "kind")} · ${plural(stats.errorHits, "hit")} → ${site}/admin/errors`);

  lines.push("", attention.length ? "**Needs a look**" : "**Needs a look:** nothing, all quiet.", ...attention);
  return lines.join("\n");
}
