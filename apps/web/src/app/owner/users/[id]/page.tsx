"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { OwnerCard, OwnerEmpty, OwnerStat } from "@/components/owner/owner-ui";
import { OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatCents, formatDateTime } from "@/components/owner/format";
import type { UserDetail } from "@/lib/owner-api";

export default function OwnerUserDetailPage() {
  const params = useParams<{ id: string }>();
  const query = useOwnerQuery<UserDetail>(`/users/${params.id}`, { refetchMs: 60_000 });
  const data = query.data;

  return (
    <OwnerFrame title={data ? data.user.username : "User"} subtitle="Account, membership, payments and audit history. Passwords and tokens are never shown.">
      <Link href="/owner/users" className="text-xs text-amber-200 hover:text-amber-100">← All users</Link>
      {query.isError ? <OwnerEmpty>User not found or not accessible.</OwnerEmpty> : null}
      {!data && !query.isError ? <OwnerEmpty>Loading user…</OwnerEmpty> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OwnerCard title="Account">
              <OwnerStat label="Email" value={data.user.email} />
              <OwnerStat label="Role" value={data.user.appRole} />
              <OwnerStat label="Email verified" value={data.user.emailVerified ? "Yes" : "No"} />
              <OwnerStat label="Phone verified" value={data.user.phoneVerified ? "Yes" : "No"} />
              <OwnerStat label="Age verified" value={data.user.ageVerified ? "Yes" : "No"} />
              <OwnerStat label="Joined" value={formatDateTime(data.user.createdAt)} />
              <OwnerStat label="Last seen" value={formatDateTime(data.user.lastSeenAt)} />
            </OwnerCard>
            <OwnerCard title="Membership">
              <OwnerStat label="Premium flag" value={data.user.premium ? data.user.premiumTier : "Off"} />
              <OwnerStat label="Verified payment" value={data.membership.hasVerifiedPayment ? "Yes" : "No"} />
              {data.membership.premiumWithoutBillingRecord ? <p className="text-xs text-amber-200">Premium is set but there is no billing record. It may be a manual or legacy grant, and it is not counted as paid.</p> : null}
              {data.user.suspendedAt ? <p className="text-xs text-rose-200">Suspended {formatDateTime(data.user.suspendedAt)}: {data.user.suspensionReason ?? "no reason recorded"}</p> : null}
            </OwnerCard>
            <OwnerCard title="Subscriptions">
              {data.user.billingSubscriptions.length === 0 ? <OwnerEmpty>No billing subscriptions.</OwnerEmpty> : data.user.billingSubscriptions.map((sub) => (
                <OwnerStat key={sub.id} label={`${sub.tier} · ${sub.interval.toLowerCase()}`} value={sub.status} hint={`${sub.livemode ? "Live" : "Test"}${sub.cancelAtPeriodEnd ? " · cancels at period end" : ""}`} />
              ))}
            </OwnerCard>
          </div>

          <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
            <h2 className="text-sm font-semibold text-slate-100">Payments</h2>
            {data.user.paymentTransactions.length === 0 ? <OwnerEmpty>No payments recorded.</OwnerEmpty> : (
              <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-2 py-2">Date</th><th className="px-2">Product</th><th className="px-2">Mode</th><th className="px-2">Status</th><th className="px-2 text-right">Amount</th><th className="px-2 text-right">Refunded</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.user.paymentTransactions.map((payment) => (
                    <tr key={payment.id} className="text-slate-300">
                      <td className="px-2 py-2 text-xs whitespace-nowrap">{formatDateTime(payment.createdAt)}</td>
                      <td className="px-2 text-xs">{payment.featureCode} · {payment.kind.replace("_", " ").toLowerCase()}</td>
                      <td className="px-2 text-xs">{payment.livemode ? "Live" : "Test"}</td>
                      <td className="px-2 text-xs">{payment.status}</td>
                      <td className="px-2 text-right tabular-nums">{formatCents(payment.amountCents, payment.currency)}</td>
                      <td className="px-2 text-right tabular-nums">{payment.refundedCents > 0 ? formatCents(payment.refundedCents, payment.currency) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
            <h2 className="text-sm font-semibold text-slate-100">Audit history for this account</h2>
            {data.auditEvents.length === 0 ? <OwnerEmpty>No audited events reference this account.</OwnerEmpty> : (
              <ul className="mt-3 divide-y divide-white/5 text-sm">
                {data.auditEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap gap-x-4 py-2 text-slate-300"><span className="text-slate-100">{event.operation}</span><span>{event.resourceType}</span><span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span><span className="text-xs text-slate-500">{event.status}</span></li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </OwnerFrame>
  );
}
