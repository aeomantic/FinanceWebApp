"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Receipt } from "lucide-react";
import { mutateBill } from "@/app/bills/actions";
import { PaidButton, PaymentNotice } from "@/components/commitments/paid-button";
import { BillModal } from "./BillModal";
import { MonthlySpendCard } from "./MonthlySpendCard";
import { calculateMonthlySpend } from "@/lib/monthly-expense";
import { formatMoney } from "@/lib/dashboard/summary";
import type { Bill } from "@/lib/bills/types";
import type { Commitment } from "@/lib/commitments/types";
import type { Wallet, Category, Transaction } from "@/lib/dashboard/types";

function BillPaidButton({ bill, onPaid }: { bill: Bill; onPaid: () => void }) {
  const [pending, start] = useTransition();
  const [paidVersion, setPaidVersion] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return <div><button disabled={pending || !bill.wallet_id || paidVersion === bill.updated_at} aria-label={`Mark ${bill.biller_name} as paid`} title={!bill.wallet_id ? "Assign a wallet first" : undefined} className="flex items-center gap-1 rounded-xl border border-orange-500/20 dark:border-orange-400/20 bg-orange-500/10 dark:bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 disabled:opacity-50" onClick={() => start(async () => {
    setError("");
    try { const r = await mutateBill(bill, "pay"); if (!r.success) setError(r.error); else { setPaidVersion(bill.updated_at); onPaid(); router.refresh(); } }
    catch { setError("Payment could not be confirmed. Refresh before retrying."); }
  })}><Check size={14} />{pending ? "Recording…" : "Paid"}</button>{error && <p role="alert" className="max-w-48 text-xs text-rose-500">{error}</p>}</div>;
}
export function UpcomingExpensesCard({ bills, commitments, wallets, categories, today }: { bills: Bill[]; commitments: Commitment[]; wallets: Wallet[]; categories: Category[]; today: string }) {
  const [editing, setEditing] = useState<Bill | "new" | null>(null);
  const [notice, setNotice] = useState(false);
  const items = [
    ...bills.map(b => ({ id: b.id, name: b.biller_name, date: b.next_due_date, amount: Math.round(b.amount * 100), currency: b.currency, bill: b, commitment: null })),
    ...commitments.filter(c => c.isActive && (c.obligationType === "subscription" || c.paidInstallments < (c.totalInstallments ?? 0))).map(c => ({ id: c.id, name: c.obligationType === "bnpl" ? `${c.name} ${c.paidInstallments + 1}/${c.totalInstallments}` : c.name, date: c.nextDueOn, amount: c.amountMinor, currency: c.currency, bill: null, commitment: c })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return <section className="surface-card min-w-0 rounded-3xl p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Upcoming expenses</h2><button onClick={() => setEditing("new")} className="rounded-xl bg-orange-500/10 dark:bg-orange-400/10 px-3 py-2 text-sm text-orange-600 dark:text-orange-400">+ Add bill</button></div>
    <Link href="/commitments" className="my-2 inline-block text-xs underline">Manage subscriptions & BNPL</Link>
    {notice && <PaymentNotice onDismiss={() => setNotice(false)} />}
    {!items.length && <p className="py-6 text-sm opacity-70">No bills or commitments yet. Add a bill to plan your upcoming expenses.</p>}
    <ul className="max-h-[32rem] overflow-y-auto">{items.map(item => {
      const bnpl = item.commitment?.obligationType === "bnpl";
      const tone = item.bill ? "text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/10 border-orange-500/20 dark:border-orange-400/20" : bnpl ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-400/10 border-rose-500/20 dark:border-rose-400/20" : "bg-zinc-500/10 border-zinc-500/20";
      const days = Math.round((Date.parse(item.date) - Date.parse(today)) / 86400000);
      return <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-zinc-500/10 py-4 last:border-0">
        <span className={`rounded-xl border p-2 ${tone}`}>{item.bill ? <Receipt size={18} /> : <Clock size={18} />}</span>
        <div className="min-w-0 flex-1 basis-32"><p className="break-words text-sm font-semibold">{item.name}</p><span className={`mt-1 inline-block rounded-lg px-2 py-1 text-xs ${tone}`}>{days < 0 ? "Overdue" : days === 0 ? "Due today" : `Due in ${days} days`} · {item.date}</span>{item.bill && <button className="ml-2 text-xs underline" onClick={() => setEditing(item.bill)}>Manage</button>}</div>
        <div className="flex flex-wrap items-center gap-3"><strong className="text-sm">{formatMoney(item.amount, item.currency)}</strong>{item.bill ? <BillPaidButton bill={item.bill} onPaid={() => setNotice(true)} /> : <PaidButton commitment={item.commitment!} onPaid={() => setNotice(true)} />}</div>
      </li>;
    })}</ul>
    {editing && <BillModal bill={editing === "new" ? undefined : editing} wallets={wallets} categories={categories} today={today} onClose={() => setEditing(null)} />}
  </section>;
}

export function BillsOverview(props: { bills: Bill[]; commitments: Commitment[]; wallets: Wallet[]; categories: Category[]; transactions: Transaction[]; today: string; currency: string; error?: string | null }) {
  return <div className="my-5 grid min-w-0 gap-4 lg:grid-cols-2">
    {props.error ? <div className="surface-card rounded-3xl p-5" role="alert">Forecast unavailable. {props.error}</div> : <MonthlySpendCard forecast={calculateMonthlySpend(props.transactions, props.bills, props.commitments, props.today, props.currency)} today={props.today} currency={props.currency} />}
    <UpcomingExpensesCard {...props} />
  </div>;
}
