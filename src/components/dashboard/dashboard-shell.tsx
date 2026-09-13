"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BalanceCard, type BalanceAction } from "./balance-card";
import { TransactionList } from "./transaction-list";
import { SpendChart } from "./spend-chart";
import { CurrencySelector } from "./currency-selector";
import { BrandMark, Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { recordTransaction } from "@/app/dashboard/actions";
import { DEMO_MONTHLY_POINTS } from "@/lib/dashboard/demo";
import { formatMoney, summarizeTransactions } from "@/lib/dashboard/summary";
import type { DashboardData } from "@/lib/dashboard/types";

interface DashboardShellProps { data: DashboardData; demo?: boolean }
type Panel = BalanceAction | "notifications" | "help" | null;

export function DashboardShell({ data, demo = false }: DashboardShellProps) {
  const router = useRouter();
  const [currency, setCurrency] = useState(demo ? "USD" : data.transactions[0]?.currency ?? "SGD");
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const summary = summarizeTransactions(data.transactions, currency, data.today);
  const transactions = data.transactions.filter((transaction) => transaction.currency === currency);
  const points = demo && currency === "USD" ? DEMO_MONTHLY_POINTS : summary.monthlyPoints;
  const thisMonth = data.today.slice(0, 7);
  const deltaMinor = transactions.filter((transaction) => transaction.date.startsWith(thisMonth)).reduce((sum, transaction) => sum + (transaction.type === "income" ? transaction.amountMinor : -transaction.amountMinor), 0);
  const name = data.name.split(" ")[0] || "there";
  const dateLabel = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.today}T12:00:00Z`));

  function downloadStatement() {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [["Date", "Description", "Type", "Currency", "Amount"], ...transactions.map((item) => [item.date, /^[=+\-@\t\r]/.test(item.title) ? `'${item.title}` : item.title, item.type, item.currency, (item.amountMinor / 100 * (item.type === "expense" ? -1 : 1)).toFixed(2)])];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `folio-${demo ? "demo-" : ""}${currency}-${data.today}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${currency} statement downloaded.`);
  }

  return (
    <div className="app-frame">
      <a href="#overview" className="skip-link">Skip to dashboard</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href={demo ? "/preview" : "/dashboard"} className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <a href="#overview" className="rail-link active" aria-label="Overview" title="Overview"><Icon name="home" /></a>
          <a href="#transactions" className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></a>
          <a href="#activity" className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></a>
          <a href="#wallets" className="rail-link" aria-label="Currencies" title="Currencies"><Icon name="wallet" /></a>
        </nav>
        <button className="rail-link rail-help" onClick={() => setPanel("help")} aria-label="Help"><Icon name="help" /></button>
        <span className="rail-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href={demo ? "/preview" : "/dashboard"} className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections"><a href="#overview" className="selected">Overview</a><a href="#transactions">Transactions</a><a href="#wallets">Wallets</a></nav>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search transactions" onClick={() => { document.getElementById("transactions")?.scrollIntoView(); searchInput.current?.focus(); }}><Icon name="search" /></button>
            <button className="icon-button" aria-label="Notifications" onClick={() => setPanel("notifications")}><Icon name="bell" /></button>
            <span className="topbar-divider" />
            <div className="user-greeting"><span className="user-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><span>Hi, {name}<span className="user-subtitle">{demo ? "Personal account · Demo" : "Personal account"}</span></span></div>
          </div>
        </header>

        <main id="overview">
          <div className="page-heading">
            <div><div className="eyebrow page-eyebrow">YOUR EVERYDAY, SIMPLIFIED</div><h1>A little more clarity.<span className="heading-spark" aria-hidden="true">✳</span></h1><p>Your money. Your world. All in one place.</p></div>
            <div className="page-date"><Icon name="calendar" size={16} />{dateLabel}</div>
          </div>

          {demo && <div className="demo-banner"><span><span className="status-dot" />You’re exploring Folio. These are sample balances and transactions.</span><Link href="/login">Make it yours<Icon name="arrow-up-right" size={15} /></Link></div>}
          {data.error && <div className="dashboard-alert" role="alert">{data.error}<button onClick={() => router.refresh()}>Try again</button></div>}
          {notice && <div className="success-notice" role="status"><Icon name="check" size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}

          {!data.error && <div className="dashboard-grid">
            <div className="balance-area">
              <BalanceCard currency={currency} balanceMinor={demo && currency === "USD" ? 2688709 : summary.balanceMinor} deltaMinor={demo && currency === "USD" ? 42103 : deltaMinor} demo={demo} onAction={setPanel} />
              <div className="cashflow-summary">
                <div><span className="cashflow-icon incoming"><Icon name="arrow-down-left" size={18} /></span><span><span className="stat-label">Money in</span><strong className="tabular">{formatMoney(summary.incomeMinor, currency)}</strong></span></div>
                <div><span className="cashflow-icon outgoing"><Icon name="arrow-up-right" size={18} /></span><span><span className="stat-label">Money out</span><strong className="tabular">{formatMoney(summary.expensesMinor, currency)}</strong></span></div>
              </div>
            </div>
            <div className="chart-area" id="activity"><SpendChart points={points} currency={currency} /></div>
            <div className="transactions-area" id="transactions">
              <div className="transaction-search"><Icon name="search" size={17} /><input ref={searchInput} aria-label="Filter transactions" placeholder="Find a transaction..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={15} /></button>}</div>
              <TransactionList transactions={transactions} today={data.today} query={query} />
            </div>
            <div className="wallets-area" id="wallets">
              <CurrencySelector selectedCurrency={currency} onSelect={setCurrency} demo={demo} />
              <section className="insight-card">
                <div className="insight-top"><span className="eyebrow">SMALL STEPS. BIG PICTURE.</span><span className="insight-icon"><Icon name="activity" size={18} /></span></div>
                <h2>Good habits start<br />with a clear view.</h2>
                <p>Take a moment to see where your money goes. Your future self will thank you.</p>
                <button className="text-action" onClick={downloadStatement}>Download statement<Icon name="arrow-up-right" size={17} /></button>
                <span className="insight-art" aria-hidden="true"><span /><span /><span /><span /><span /></span>
              </section>
            </div>
          </div>}
          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data · Illustrative exchange rates" : `Recorded activity from ${data.periodStart}. Not a bank balance.`}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#transactions" aria-label="Transactions"><Icon name="transfer" /></a><a href="#overview" className="mobile-home" aria-label="Overview"><Icon name="home" /></a><a href="#wallets" aria-label="Currencies"><Icon name="wallet" /></a></nav>

      {panel && <Modal title={panel === "notifications" ? "You’re all caught up" : panel === "help" ? "A little help with Folio" : panel === "transfer" ? "About transfers" : panel === "pay" ? "Record a payment" : "Record money received"} onClose={() => setPanel(null)}>
        {panel === "pay" || panel === "receive" ? <TransactionForm action={panel} currency={currency} today={data.today} demo={demo} onSaved={() => { setPanel(null); setNotice("Transaction saved. Your overview is up to date."); router.refresh(); }} /> : panel === "transfer" ? <div className="modal-copy"><span className="modal-feature-icon"><Icon name="transfer" size={26} /></span><p>Folio helps you keep track of your money. Bank transfers happen securely through your bank or payment provider.</p><p>Once a payment is complete, you can record it here to keep your overview up to date.</p><button className="primary-button" onClick={() => setPanel("pay")}>Record a payment<Icon name="arrow-up-right" size={17} /></button></div> : panel === "notifications" ? <div className="modal-copy"><span className="modal-feature-icon"><Icon name="check" size={26} /></span><p>No new notifications. A little peace of mind looks good on you.</p></div> : <div className="modal-copy"><p>Folio is your personal money journal. Record payments and income, review spending, and keep each currency in its own view.</p><p>Use Pay or Receive to record a transaction. Choose a currency to filter your overview, or download a statement to keep a copy.</p><p>{demo ? "You’re viewing sample data. Sign in to start your own money journal." : "Your overview shows the net of recorded transactions over the displayed period. Bank accounts and live exchange rates are not connected."}</p></div>}
      </Modal>}
    </div>
  );
}

function TransactionForm({ action, currency, today, demo, onSaved }: { action: "pay" | "receive"; currency: string; today: string; demo: boolean; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || demo) return;
    const form = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await recordTransaction({ title: String(form.get("title") ?? ""), amount: String(form.get("amount") ?? ""), currency, date: String(form.get("date") ?? ""), type: action === "pay" ? "expense" : "income" });
        if (!result.success) setError(result.error ?? "Could not save this transaction. Please try again.");
        else onSaved();
      } catch { setError("Could not connect. Please try again."); }
    });
  }
  return <form className="transaction-form" onSubmit={submit}>
    <p className="modal-description">Add {action === "pay" ? "an outgoing payment" : "income"} to your personal journal. This records activity and does not move money.</p>
    {demo && <p className="form-information">This is a preview. <Link href="/login">Sign in</Link> to record your own transactions.</p>}
    <label> {action === "pay" ? "Paid to" : "Received from"}<input name="title" placeholder={action === "pay" ? "e.g. Your favorite coffee shop" : "e.g. Salary or a friend"} required maxLength={120} disabled={pending} /></label>
    <div className="form-columns"><label>Amount ({currency})<input name="amount" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="0.00" required maxLength={14} disabled={pending} /></label><label>Date<input name="date" type="date" defaultValue={today} max={today} required disabled={pending} /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={pending || demo}>{pending ? "Saving..." : "Save transaction"}<Icon name="arrow-right" size={18} /></button>
  </form>;
}
