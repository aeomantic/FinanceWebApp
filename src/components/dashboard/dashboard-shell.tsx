"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BalanceCard, type BalanceAction } from "./balance-card";
import { TransactionList } from "./transaction-list";
import { SpendChart } from "./spend-chart";
import { WalletList } from "./wallet-list";
import { MobileNav } from "./mobile-nav";
import { BrandMark, Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Select } from "@/components/ui/select";
import { Wallet as WalletIcon } from "lucide-react";
import { createCategory, recordTransaction } from "@/app/dashboard/actions";
import { DEMO_MONTHLY_POINTS, DEMO_WALLETS } from "@/lib/dashboard/demo";
import { formatMoney, summarizeTransactions } from "@/lib/dashboard/summary";
import { useHiddenWallets } from "@/lib/dashboard/use-hidden-wallets";
import type { Category, DashboardData, Wallet } from "@/lib/dashboard/types";

interface DashboardShellProps { data: DashboardData; demo?: boolean }
type Panel = BalanceAction | "notifications" | "help" | null;

export function DashboardShell({ data, demo = false }: DashboardShellProps) {
  const router = useRouter();
  const wallets = demo ? DEMO_WALLETS : data.wallets;
  const [categories, setCategories] = useState<Category[]>(data.categories);
  const { hiddenIds, toggle: toggleHideBalance } = useHiddenWallets();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>((wallets.find((item) => item.isDefault) ?? wallets[0])?.id ?? null);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const wallet = wallets.find((item) => item.id === selectedWalletId) ?? wallets[0] ?? null;
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
          <a href="#transactions" className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></a>
          <a href="#activity" className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></a>
          <Link href={demo ? "/preview" : "/wallets"} className="rail-link" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <button className="rail-link rail-help" onClick={() => setPanel("help")} aria-label="Help"><Icon name="help" /></button>
        <span className="rail-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href={demo ? "/preview" : "/dashboard"} className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections"><a href="#overview" className="selected">Overview</a><a href="#transactions">Transactions</a><Link href={demo ? "/preview" : "/wallets"}>Wallets</Link></nav>
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
              <TransactionList transactions={transactions} today={data.today} query={query} />
            </div>
            <div className="wallets-area" id="wallets">
              <WalletList wallets={wallets} selectedWalletId={selectedWalletId} onSelect={setSelectedWalletId} onCreated={() => router.refresh()} onChanged={() => router.refresh()} hiddenWalletIds={hiddenIds} onToggleHideBalance={toggleHideBalance} demo={demo} />
              <section className="insight-card">
                <div className="insight-top"><span className="eyebrow">SMALL STEPS. BIG PICTURE.</span><span className="insight-icon"><Icon name="activity" size={18} /></span></div>
                <h2>Good habits start<br />with a clear view.</h2>
                <p>Take a moment to see where your money goes. Your future self will thank you.</p>
                <button className="text-action" onClick={downloadStatement}>Download statement<Icon name="arrow-up-right" size={17} /></button>
                <span className="insight-art" aria-hidden="true"><span /><span /><span /><span /><span /></span>
              </section>
            </div>
          </div>}
          {!data.error && !wallet && (
            <div className="dashboard-grid">
              <div className="wallets-area" id="wallets" style={{ gridColumn: "1 / -1" }}>
                <WalletList wallets={wallets} selectedWalletId={selectedWalletId} onSelect={setSelectedWalletId} onCreated={() => router.refresh()} onChanged={() => router.refresh()} hiddenWalletIds={hiddenIds} onToggleHideBalance={toggleHideBalance} demo={demo} />
              </div>
            </div>
          )}
          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>{demo ? "Demo data · Illustrative exchange rates" : `Recorded activity from ${data.periodStart}. Not a bank balance.`}</span><div>{demo ? <Link href="/login">Sign in<Icon name="arrow-right" size={14} /></Link> : <SignOutButton />}</div></footer>
        </main>
      </div>

      <MobileNav demo={demo} />

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

function TransactionForm({ action, wallet, wallets, categories, today, demo, onCategoryCreated, onSaved }: {
  action: "expense" | "income" | "transfer";
  wallet: Wallet;
  wallets: Wallet[];
  categories: Category[];
  today: string;
  demo: boolean;
  onCategoryCreated: (category: Category) => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [destinationWalletId, setDestinationWalletId] = useState(wallets.find((item) => item.id !== wallet.id)?.id ?? "");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [pending, startTransition] = useTransition();
  const otherWallets = wallets.filter((item) => item.id !== wallet.id);
  const relevantCategories = categories.filter((category) => category.type === (action === "income" ? "income" : "expense"));
  const formId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || demo) return;
    const form = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await recordTransaction({
          walletId: wallet.id,
          destinationWalletId: action === "transfer" ? destinationWalletId : undefined,
          categoryId: action !== "transfer" && categoryId ? categoryId : undefined,
          amount: String(form.get("amount") ?? ""),
          date: String(form.get("date") ?? ""),
          type: action,
          note: String(form.get("note") ?? "").trim() || undefined,
        });
        if (!result.success) setError(result.error ?? "Could not save this transaction. Please try again.");
        else onSaved();
      } catch { setError("Could not connect. Please try again."); }
    });
  }

  return <form className="transaction-form" onSubmit={submit}>
    <p className="modal-description">
      {action === "expense" ? `Record money spent from ${wallet.name}.` : action === "income" ? `Record money received into ${wallet.name}.` : `Move money from ${wallet.name} to another wallet.`}
      {" "}This records activity and does not move real money.
    </p>
    {demo && <p className="form-information">This is a preview. <Link href="/login">Sign in</Link> to record your own transactions.</p>}

    {action === "transfer" ? (
      otherWallets.length === 0 ? (
        <p className="form-information">You need at least one other wallet to transfer money. Add a wallet first.</p>
      ) : (
        <label>To wallet
          <Select
            aria-label="To wallet"
            value={destinationWalletId}
            onChange={setDestinationWalletId}
            disabled={pending}
            options={otherWallets.map((item) => ({ value: item.id, label: `${item.name} (${item.currency})`, icon: <WalletIcon size={16} /> }))}
          />
        </label>
      )
    ) : (
      <label>Category
        <Select
          aria-label="Category"
          value={categoryId}
          onChange={setCategoryId}
          disabled={pending}
          placeholder="No category"
          options={[
            { value: "", label: "No category", icon: <CategoryIcon name={null} size={16} /> },
            ...relevantCategories.map((category) => ({ value: category.id, label: category.name, icon: <CategoryIcon name={category.icon} size={16} /> })),
          ]}
          onCreateNew={() => setShowNewCategory(true)}
          createNewLabel="New category"
        />
      </label>
    )}

    {showNewCategory && (
      <NewCategoryFields
        type={action === "income" ? "income" : "expense"}
        onCreated={(category) => { onCategoryCreated(category); setCategoryId(category.id); setShowNewCategory(false); }}
        onCancel={() => setShowNewCategory(false)}
      />
    )}

    <div className="form-columns">
      <label>Amount ({wallet.currency})<input name="amount" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="0.00" required maxLength={14} disabled={pending} /></label>
      <label>Date<input name="date" type="date" defaultValue={today} max={today} required disabled={pending} /></label>
    </div>
    <label htmlFor={`${formId}-note`}>Note (optional)<input id={`${formId}-note`} name="note" placeholder="e.g. Coffee with a friend" maxLength={120} disabled={pending} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={pending || demo || (action === "transfer" && otherWallets.length === 0)}>{pending ? "Saving..." : "Save transaction"}<Icon name="arrow-right" size={18} /></button>
  </form>;
}

function NewCategoryFields({ type, onCreated, onCancel }: { type: "expense" | "income"; onCreated: (category: Category) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // This renders inside the transaction form's own <form>, so it cannot be
  // a nested <form> itself (invalid HTML) or a type="submit" button (which
  // would submit the outer form). Plain buttons with a click handler instead.
  async function handleCreate() {
    if (pending || !name.trim()) return;
    setPending(true);
    setError("");
    const result = await createCategory({ name, type });
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    onCreated(result.category);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "12px 0 0", padding: 14, border: "1px solid #e6e9e3", borderRadius: 12, background: "#f7f9f6" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12, fontWeight: 500 }}>
        New {type} category
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="e.g. Dining Out" disabled={pending} style={{ width: "100%", background: "#fff", border: "1px solid #e6e9e3", borderRadius: 12, padding: 12, fontSize: 13 }} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={pending} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e6e9e3", background: "#fff", fontSize: 12 }}>Cancel</button>
        <button type="button" onClick={handleCreate} disabled={pending || !name.trim()} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: 0, background: "#141414", color: "#fff", fontSize: 12 }}>{pending ? "Adding..." : "Add category"}</button>
      </div>
    </div>
  );
}
