"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerCard, OwnerEmpty, OwnerStat } from "@/components/owner/owner-ui";
import { OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatCents, formatCount, formatDateTime } from "@/components/owner/format";
import { EXPENSE_CATEGORIES, ownerWrite, type Expense, type ExpenseCategory, type ExpenseInput, type FinanceSummary, type Paged } from "@/lib/owner-api";
import { useAuthStore } from "@/store/auth-store";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  HOSTING: "Hosting and infrastructure",
  SOFTWARE: "Software and subscriptions",
  PAYMENT_PROCESSING: "Payment processing (already netted from revenue; not counted again)",
  REFUNDS_AND_CHARGEBACKS: "Refunds and chargebacks (recorded outside Stripe)",
  MARKETING: "Marketing and advertising",
  CONTRACTORS: "Development and contractors",
  OTHER: "Other operating expense",
};

type FormState = {
  id: string | null;
  category: ExpenseCategory;
  customCategory: string;
  description: string;
  amount: string;
  incurredOn: string;
  recurring: boolean;
  reference: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  category: "HOSTING",
  customCategory: "",
  description: "",
  amount: "",
  incurredOn: new Date().toISOString().slice(0, 10),
  recurring: false,
  reference: "",
};

export default function OwnerExpensesPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const expenses = useOwnerQuery<Paged<Expense>>("/finance/expenses", { params: { page, pageSize: 25 }, refetchMs: 60_000 });
  const month = useOwnerQuery<FinanceSummary>("/finance/summary", { params: { period: "month", mode: "live" }, refetchMs: 60_000 });
  const year = useOwnerQuery<FinanceSummary>("/finance/summary", { params: { period: "year", mode: "live" }, refetchMs: 60_000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["owner"] });
  };

  const save = async () => {
    setFormError(null);
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!form.description.trim() || !Number.isFinite(amountCents) || amountCents <= 0) {
      setFormError("Enter a description and an amount greater than zero.");
      return;
    }
    if (form.category === "OTHER" && !form.customCategory.trim()) {
      setFormError("Name the category for an OTHER expense.");
      return;
    }
    const body: ExpenseInput = {
      category: form.category,
      customCategory: form.category === "OTHER" ? form.customCategory.trim() : null,
      description: form.description.trim(),
      amountCents,
      currency: "usd",
      incurredOn: new Date(`${form.incurredOn}T00:00:00.000Z`).toISOString(),
      recurring: form.recurring,
      reference: form.reference.trim() || null,
    };
    setSaving(true);
    try {
      if (form.id) {
        await ownerWrite(accessToken!, "patch", `/finance/expenses/${form.id}`, body);
      } else {
        await ownerWrite(accessToken!, "post", "/finance/expenses", body);
      }
      setForm(EMPTY_FORM);
      refresh();
    } catch {
      setFormError("The expense could not be saved. Check the values and try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      await ownerWrite(accessToken!, "delete", `/finance/expenses/${id}`);
      setConfirmDelete(null);
      refresh();
    } catch {
      setFormError("The expense could not be deleted.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (expense: Expense) => {
    setForm({
      id: expense.id,
      category: expense.category,
      customCategory: expense.customCategory ?? "",
      description: expense.description,
      amount: (expense.amountCents / 100).toFixed(2),
      incurredOn: expense.incurredOn.slice(0, 10),
      recurring: expense.recurring,
      reference: expense.reference ?? "",
    });
  };

  const totalPages = expenses.data ? Math.max(1, Math.ceil(expenses.data.total / 25)) : 1;

  return (
    <OwnerFrame title="Expenses & profit" subtitle="Record business costs so profit can be calculated. Every change is written to the audit log with who made it and what changed.">
      <div className="grid gap-4 md:grid-cols-2">
        <OwnerCard title="This month (live)">
          <OwnerStat label="Net collected" value={month.data ? formatCents(month.data.totals.netCents) : "—"} />
          <OwnerStat label="Operating expenses" value={month.data ? `−${formatCents(month.data.totals.operatingExpenseCents)}` : "—"} hint={month.data ? `${formatCount(month.data.totals.operatingExpenseCount)} records` : undefined} />
          <OwnerStat label="Recorded profit" value={month.data ? formatCents(month.data.totals.recordedProfitCents) : "—"} hint="Based on recorded data only" />
        </OwnerCard>
        <OwnerCard title="This year (live)">
          <OwnerStat label="Net collected" value={year.data ? formatCents(year.data.totals.netCents) : "—"} />
          <OwnerStat label="Operating expenses" value={year.data ? `−${formatCents(year.data.totals.operatingExpenseCents)}` : "—"} />
          <OwnerStat label="Recorded profit" value={year.data ? formatCents(year.data.totals.recordedProfitCents) : "—"} hint="Based on recorded data only" />
        </OwnerCard>
      </div>

      <section className="nexus-display-panel rounded-[24px] p-5" aria-label={form.id ? "Edit expense" : "Add expense"}>
        <h2 className="text-sm font-semibold text-slate-100">{form.id ? "Edit expense" : "Add expense"}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-slate-400">
            Category
            <select className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}>
              {EXPENSE_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>)}
            </select>
          </label>
          {form.category === "OTHER" ? (
            <label className="text-xs text-slate-400">
              Category name
              <input className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.customCategory} onChange={(event) => setForm({ ...form, customCategory: event.target.value })} />
            </label>
          ) : null}
          <label className="text-xs text-slate-400">
            Description
            <input className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label className="text-xs text-slate-400">
            Amount (USD)
            <input inputMode="decimal" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </label>
          <label className="text-xs text-slate-400">
            Date incurred
            <input type="date" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.incurredOn} onChange={(event) => setForm({ ...form, incurredOn: event.target.value })} />
          </label>
          <label className="text-xs text-slate-400">
            Reference (optional)
            <input className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 pt-5 text-xs text-slate-300">
            <input type="checkbox" checked={form.recurring} onChange={(event) => setForm({ ...form, recurring: event.target.checked })} />
            Recurring cost
          </label>
        </div>
        {formError ? <p className="mt-3 text-xs text-rose-200" role="alert">{formError}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={saving} onClick={save} className="rounded-lg border border-amber-400/60 bg-amber-400/15 px-4 py-1.5 text-xs text-amber-100 disabled:opacity-50">{form.id ? "Save changes" : "Add expense"}</button>
          {form.id ? <button type="button" onClick={() => setForm(EMPTY_FORM)} className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-slate-300">Cancel edit</button> : null}
        </div>
      </section>

      <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
        <h2 className="text-sm font-semibold text-slate-100">Recorded expenses</h2>
        <table className="mt-3 w-full min-w-[780px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <tr><th className="px-2 py-2">Date</th><th className="px-2">Category</th><th className="px-2">Description</th><th className="px-2 text-right">Amount</th><th className="px-2">Recurring</th><th className="px-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {expenses.isLoading ? <tr><td colSpan={6}><OwnerEmpty>Loading expenses…</OwnerEmpty></td></tr> : null}
            {expenses.data && expenses.data.items.length === 0 ? <tr><td colSpan={6}><OwnerEmpty>No expenses recorded yet. Profit is not complete until costs are entered.</OwnerEmpty></td></tr> : null}
            {expenses.data?.items.map((expense) => (
              <tr key={expense.id} className="align-top text-slate-300">
                <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(expense.incurredOn)}</td>
                <td className="px-2 text-xs">{expense.category === "OTHER" ? expense.customCategory ?? "Other" : CATEGORY_LABEL[expense.category].split(" (")[0]}</td>
                <td className="px-2 text-xs">{expense.description}{expense.reference ? <span className="block text-[11px] text-slate-500">{expense.reference}</span> : null}</td>
                <td className="px-2 text-right tabular-nums">{formatCents(expense.amountCents, expense.currency)}</td>
                <td className="px-2 text-xs">{expense.recurring ? "Yes" : "No"}</td>
                <td className="px-2 text-right text-xs whitespace-nowrap">
                  <button type="button" onClick={() => edit(expense)} className="mr-2 text-amber-200 hover:text-amber-100">Edit</button>
                  {confirmDelete === expense.id ? (
                    <>
                      <button type="button" onClick={() => remove(expense.id)} className="mr-2 text-rose-200">Confirm delete</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-400">Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(expense.id)} className="text-slate-400 hover:text-rose-200">Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </section>
    </OwnerFrame>
  );
}
