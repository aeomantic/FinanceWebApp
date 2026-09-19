"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BalanceCard, type BalanceAction } from "./balance-card";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { SpendChart } from "./spend-chart";
import { WalletList } from "./wallet-list";
import { MobileNav } from "./mobile-nav";
import { GoalsSummaryCard, WishlistPreviewCard } from "./goals-preview";
import { BrandMark, Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { DEMO_MONTHLY_POINTS, DEMO_WALLETS } from "@/lib/dashboard/demo";
import { formatMoney, summarizeTransactions } from "@/lib/dashboard/summary";
import { useHiddenWallets } from "@/lib/dashboard/use-hidden-wallets";
import type { Category, DashboardData, Transaction } from "@/lib/dashboard/types";
import type { GoalsSummary } from "@/lib/goals/types";

const DEMO_GOALS_SUMMARY: GoalsSummary = {
  primaryCurrency: "USD",
  goals: [
    { id: "demo-goal-1", title: "Emergency fund", targetMinor: 500000, savedMinor: 320000, currency: "USD", deadline: null, icon: "piggy-bank", updatedAt: "" },
    { id: "demo-goal-2", title: "Japan trip", targetMinor: 300000, savedMinor: 90000, currency: "USD", deadline: null, icon: "sparkles", updatedAt: "" },
  ],
  wishes: [
    { id: "demo-wish-1", name: "Standing desk", priceMinor: 45000, url: null, note: null, icon: "sparkles", convertedGoalId: null },
    { id: "demo-wish-2", name: "Noise-cancelling headphones", priceMinor: 38000, url: null, note: null, icon: "sparkles", convertedGoalId: null },
  ],
};

interface DashboardShellProps { data: DashboardData; goalsSummary?: GoalsSummary; demo?: boolean }
type Panel = BalanceAction | "notifications" | "help" | null;

export function DashboardShell({ data, goalsSummary, demo = false }: DashboardShellProps) {
  const router = useRouter();
  const wallets = demo ? DEMO_WALLETS : data.wallets;
  const goalsPreview = demo ? DEMO_GOALS_SUMMARY : (goalsSummary ?? { goals: [], wishes: [], primaryCurrency: "SGD" });
  const [categories, setCategories] = useState<Category[]>(data.categories);
  const { hiddenIds, toggle: toggleHideBalance } = useHiddenWallets();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>((wallets.find((item) => item.isDefault) ?? wallets[0])?.id ?? null);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const wallet = wallets.find((item) => item.id === selectedWalletId) ?? wallets.find((item) => item.isDefault) ?? wallets[0] ?? null;
  const currency = wallet?.currency ?? "SGD";
  const walletTransactions = wallet ? data.transactions.filter((transaction) => transaction.walletId === wallet.id) : [];
  const transactions = demo ? data.transactions.filter((transaction) => transaction.walletId === wallet?.id) : walletTransactions;
  const summary = summarizeTransactions(transactions, currency, data.today);
  const points = demo && wallet?.id === "demo-main" ? DEMO_MONTHLY_POINTS : summary.monthlyPoints;
  const thisMonth = data.today.slice(0, 7);
  const deltaMinor = transactions.filter((transaction) => transaction.date.startsWith(thisMonth)).reduce((sum, transaction) => sum + (transaction.type === "income" ? transaction.amountMinor : -transaction.amountMinor), 0);
  const name = data.name.split(" ")[0] || "there";
  const dateLabel = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.today}T12:00:00Z`));

  function downloadStatement() {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [["Date", "Description", "Type", "Currency", "Amount"], ...transactions.map((item) => [item.date, /^[=+\-@\t\r]/.test(item.title) ? `'${item.title}` : item.title, item.type, item.currency, (item.amountMinor / 100 * (item.type === "income" ? 1 : -1)).toFixed(2)])];
    const blob = new Blob(["﻿", rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `folio-${demo ? "demo-" : ""}${wallet?.name ?? "wallet"}-${data.today}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${wallet?.name ?? "Wallet"} statement downloaded.`);
  }

  return (
    <div className="app-frame">
      <a href="#overview" className="skip-link">Skip to dashboard</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href={demo ? "/preview" : "/dashboard"} className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <a href="#overview" className="rail-link active" aria-label="Overview" title="Overview"><Icon name="home" /></a>
          <Link href={demo ? "/preview" : "/transactions"} className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
          <a href="#activity" className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></a>
          <Link href={demo ? "/login" : "/goals"} className="rail-link" aria-label="Goals" title="Goals"><Icon name="target" /></Link>
          <Link href={demo ? "/preview" : "/wallets"} className="rail-link" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <button className="rail-link rail-help" onClick={() => setPanel("help")} aria-label="Help"><Icon name="help" /></button>
        <Link href={demo ? "/login" : "/settings"} className="rail-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href={demo ? "/preview" : "/dashboard"} className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections"><a href="#overview" className="selected">Overview</a><Link href={demo ? "/preview" : "/transactions"}>Transactions</Link><Link href={demo ? "/login" : "/goals"}>Goals</Link><Link href={demo ? "/preview" : "/wallets"}>Wallets</Link></nav>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search transactions" onClick={() => { document.getElementById("transactions")?.scrollIntoView(); searchInput.current?.focus(); }}><Icon name="search" /></button>
            <button className="icon-button" aria-label="Notifications" onClick={() => setPanel("notifications")}><Icon name="bell" /></button>
            <span className="topbar-divider" />
            <div className="user-greeting"><Link href={demo ? "/login" : "/settings"} className="user-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link><span>Hi, {name}<span className="user-subtitle">{demo ? "Personal account · Demo" : "Personal account"}</span></span></div>
          </div>
        </header>

        <main id="overview">
          <div className="page-heading">
            <div><div className="eyebrow page-eyebrow">YOUR EVERYDAY, SIMPLIFIED</div><h1>A little more clarity.<span className="heading-spark" aria-hidden="true">✳</span></h1><p>Your money. Your world. All in one place.</p></div>
            <div className="page-date"><Icon name="calendar" size={16} />{dateLabel}</div>
          </div>

          {demo && <div className="demo-banner"><span><span className="status-dot" />You’re exploring Folio. These are sample wallets and transactions.</span><Link href="/login">Make it yours<Icon name="arrow-up-right" size={15} /></Link></div>}
          {data.error && <div className="dashboard-alert" role="alert">{data.error}<button onClick={() => router.refresh()}>Try again</button></div>}
          {notice && <div className="success-notice" role="status"><Icon name="check" size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}

          {!data.error && wallet && <div className="dashboard-grid">
            <div className="balance-area">
              <BalanceCard currency={currency} balanceMinor={wallet.balanceMinor} deltaMinor={deltaMinor} demo={demo} onAction={setPanel} />
              <div className="cashflow-summary">
                <div><span className="cashflow-icon incoming"><Icon name="arrow-down-left" size={18} /></span><span><span className="stat-label">Money in</span><strong className="tabular">{formatMoney(summary.incomeMinor, currency)}</strong></span></div>
                <div><span className="cashflow-icon outgoing"><Icon name="arrow-up-right" size={18} /></span><span><span className="stat-label">Money out</span><strong className="tabular">{formatMoney(summary.expensesMinor, currency)}</strong></span></div>
              </div>
            </div>
            <div className="chart-area" id="activity"><SpendChart points={points} currency={currency} /></div>
            <div className="transactions-area" id="transactions">
              <div className="transaction-search"><Icon name="search" size={17} /><input ref={searchInput} aria-label="Filter transactions" placeholder="Find a transaction..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={15} /></button>}</div>
              <TransactionList transactions={transactions} today={data.today} query={query} onSelect={setDetail} />
            </div>
            <div className="wallets-area" id="wallets">
              <WalletList wallets={wallets} selectedWalletId={wallet?.id ?? null} onSelect={setSelectedWalletId} onCreated={() => router.refresh()} onChanged={() => router.refresh()} hiddenWalletIds={hiddenIds} onToggleHideBalance={toggleHideBalance} demo={demo} />
              <section className="insight-card">
                <div className="insight-top"><span className="eyebrow">SMALL STEPS. BIG PICTURE.</span><span className="insight-icon"><Icon name="activity" size={18} /></span></div>
                <h2>Good habits start<br />with a clear view.</h2>
                <p>Take a moment to see where your money goes. Your future self will thank you.</p>
                <button className="text-action" onClick={downloadStatement}>Download statement<Icon name="arrow-up-right" size={17} /></button>
                <span className="insight-art" aria-hidden="true"><span /><span /><span /><span /><span /></span>
              </section>
              <GoalsSummaryCard goals={goalsPreview.goals} demo={demo} />
              <WishlistPreviewCard wishes={goalsPreview.wishes} primaryCurrency={goalsPreview.primaryCurrency} demo={demo} />
            </div>
          </div>}
          {!data.error && !wallet && (
            <div className="dashboard-grid">
              <div className="wallets-area" id="wallets" style={{ gridColumn: "1 / -1" }}>
                <WalletList wallets={wallets} selectedWalletId={null} onSelect={setSelectedWalletId} onCreated={() => router.refresh()} onChanged={() => router.refresh()} hiddenWalletIds={hiddenIds} onToggleHideBalance={toggleHideBalance} demo={demo} />
              </div>
            </div>
          )}
          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data · Illustrative exchange rates" : `Recorded activity from ${data.periodStart}. Not a bank balance.`}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <MobileNav demo={demo} />

      {detail && (
        <TransactionDetailDialog
          transaction={detail}
          wallets={wallets}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); }}
        />
      )}

      {editing && (() => {
        const editingWallet = wallets.find((item) => item.id === editing.walletId) ?? wallets[0];
        return editingWallet ? (
          <Modal title="Edit transaction" onClose={() => setEditing(null)}>
            <TransactionForm
              action={editing.type}
              wallet={editingWallet}
              wallets={wallets}
              categories={categories}
              today={data.today}
              demo={demo}
              existing={editing}
              onCategoryCreated={(category) => setCategories((previous) => [...previous, category])}
              onSaved={() => { setEditing(null); setNotice("Transaction updated. Balances are refreshed."); router.refresh(); }}
            />
          </Modal>
        ) : null;
      })()}

      {panel && wallet && <Modal title={panel === "notifications" ? "You’re all caught up" : panel === "help" ? "A little help with Folio" : panel === "transfer" ? "Transfer between wallets" : panel === "expense" ? "Record an expense" : "Record income"} onClose={() => setPanel(null)}>
        {panel === "expense" || panel === "income" || panel === "transfer" ? (
          <TransactionForm
            action={panel}
            wallet={wallet}
            wallets={wallets}
            categories={categories}
            today={data.today}
            demo={demo}
            onCategoryCreated={(category) => setCategories((previous) => [...previous, category])}
            onSaved={() => { setPanel(null); setNotice("Transaction saved. Your overview is up to date."); router.refresh(); }}
          />
        ) : panel === "notifications" ? <div className="modal-copy"><span className="modal-feature-icon"><Icon name="check" size={26} /></span><p>No new notifications. A little peace of mind looks good on you.</p></div> : <div className="modal-copy"><p>Folio is your personal money journal. Record expenses and income against a wallet, and transfer between wallets when you move money around.</p><p>Use the balance card to add a transaction, or choose a wallet below to see its own activity.</p><p>{demo ? "You’re viewing sample data. Sign in to start your own money journal." : "Your overview shows each wallet's recorded balance. Bank accounts and live exchange rates are not connected."}</p></div>}
      </Modal>}
    </div>
  );
}
