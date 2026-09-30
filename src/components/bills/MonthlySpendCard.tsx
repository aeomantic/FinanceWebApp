import { Clock, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/dashboard/summary";
import type { MonthlySpendForecast } from "@/lib/monthly-expense";

export function MonthlySpendCard({ forecast: f, today, currency }: { forecast: MonthlySpendForecast; today: string; currency: string }) {
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`));
  const segments = [
    { label: "Spent", value: f.actualSpent, tone: "", bar: "bg-zinc-800 dark:bg-[#FEF38B]", icon: null },
    { label: "Bills (Upcoming)", value: f.pendingBillsTotal, tone: "text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/10 border-orange-500/20 dark:border-orange-400/20", bar: "bg-orange-500", icon: <Receipt size={15} /> },
    { label: "BNPL (Upcoming)", value: f.pendingBNPLTotal, tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-400/10 border-rose-500/20 dark:border-rose-400/20", bar: "bg-rose-500", icon: <Clock size={15} /> },
  ];
  return <section className="surface-card rounded-3xl p-5 min-w-0" aria-label="Monthly spending forecast">
    <h2 className="text-sm font-semibold">{month} Forecast</h2>
    <p className="my-3 text-3xl font-semibold break-words">{formatMoney(f.totalProjectedSpend, currency)}</p>
    <p className="text-xs opacity-70">Across all {currency} wallets · recorded expenses and scheduled bills / BNPL</p>
    <div className="my-4 flex h-3 overflow-hidden rounded-full bg-zinc-500/10" aria-hidden="true">{segments.map(s => <span key={s.label} className={s.bar} style={{ width: `${f.totalProjectedSpend ? s.value / f.totalProjectedSpend * 100 : 0}%` }} />)}</div>
    <div className="flex flex-wrap gap-2">{segments.map(s => <div key={s.label} className={`flex flex-wrap items-center gap-2 rounded-2xl border border-transparent px-3 py-2 text-xs ${s.tone}`}>{s.icon}<span>{s.label}</span><strong>{formatMoney(s.value, currency)}</strong></div>)}</div>
  </section>;
}
