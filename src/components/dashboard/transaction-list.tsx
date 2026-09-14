"use client";

import { useId, useState } from "react";
import styles from "./components.module.css";

export interface DashboardTransaction {
  id: string;
  title: string;
  date: string;
  amountMinor: number;
  currency: string;
  type: "income" | "expense" | "transfer";
  category?: string;
}

export interface TransactionListProps {
  transactions: DashboardTransaction[];
  today: string;
  query?: string;
  onQueryChange?: (query: string) => void;
}

function dateHeading(date: string, today: string): string {
  if (date === today) return "Today";
  const yesterday = new Date(`${today}T12:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.slice(0, 4) !== today.slice(0, 4) ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function MerchantAvatar({ title, type }: Pick<DashboardTransaction, "title" | "type">) {
  const initials = title.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  if (/binance/i.test(title)) {
    return (
      <span className={`${styles.avatar} ${styles.binance}`} aria-hidden="true">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
          <path d="m12 2 4 4-2 2-2-2-2 2-2-2 4-4ZM6 8l2 2-2 2-2-2 2-2Zm12 0 2 2-2 2-2-2 2-2Zm-6 0 4 4-4 4-4-4 4-4ZM2 12l4 4-2 2-4-4 2-2Zm20 0 2 2-4 4-2-2 4-4Zm-12 4 2 2 2-2 2 2-4 4-4-4 2-2Z" />
        </svg>
      </span>
    );
  }
  if (/multiplex/i.test(title)) {
    return <span className={`${styles.avatar} ${styles.avatarDark}`} aria-hidden="true"><span className={styles.cinemaMark}>mx</span></span>;
  }
  if (/spotify/i.test(title)) {
    return <span className={`${styles.avatar} ${styles.avatarDark}`} aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#91db9a" strokeWidth="1.8" strokeLinecap="round"><path d="M5 8c4-1.9 9-1.7 14 .7M6 12c3.5-1.6 7.4-1.4 11.7.5M7 16c2.8-1.2 6-1.1 9.4.3" /></svg></span>;
  }
  const palette = type === "income" ? styles.avatarMint : styles.avatarLavender;
  return <span className={`${styles.avatar} ${palette}`} aria-hidden="true">{initials}</span>;
}

export function TransactionList({ transactions, today, query = "", onQueryChange }: TransactionListProps) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const searchId = useId();
  const listId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const filtered = transactions
    .filter((transaction) => `${transaction.title} ${transaction.category ?? ""}`.toLocaleLowerCase("en-US").includes(normalizedQuery))
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const visible = expanded || normalizedQuery ? filtered : filtered.slice(0, 5);
  const groups = visible.reduce<Map<string, DashboardTransaction[]>>((result, transaction) => {
    const group = result.get(transaction.date) ?? [];
    group.push(transaction);
    result.set(transaction.date, group);
    return result;
  }, new Map());

  return (
    <section className={`surface-card ${styles.transactions}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <p className={styles.eyebrow}>YOUR MONEY IN MOTION</p>
          <h2 id={titleId}>Transactions</h2>
        </div>
        {filtered.length > 5 && !normalizedQuery ? (
          <button type="button" className={styles.textButton} onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={listId}>
            {expanded ? "Show less" : "View all"}<span aria-hidden="true">↗</span>
          </button>
        ) : <span className={styles.smallCount}>{filtered.length} total</span>}
      </div>
      {onQueryChange ? (
        <div className={styles.transactionSearch}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.7" /><path d="m16 16 4 4" /></svg>
          <label htmlFor={searchId} className={styles.srOnly}>Search transactions</label>
          <input id={searchId} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search transactions" />
        </div>
      ) : null}
      <div id={listId} className={styles.transactionGroups}>
        {groups.size === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">↗</span>
            <h3>{normalizedQuery ? "No matching transactions" : "A fresh start"}</h3>
            <p>{normalizedQuery ? "Try another name or category." : "Your income and spending will appear here."}</p>
          </div>
        ) : Array.from(groups, ([date, rows]) => (
          <div key={date} className={styles.transactionGroup}>
            <h3 className={styles.dateHeading}>{dateHeading(date, today)}</h3>
            <ul className={styles.transactionRows}>
              {rows.map((transaction) => {
                const income = transaction.type === "income";
                const transfer = transaction.type === "transfer";
                const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: transaction.currency }).format(Math.abs(transaction.amountMinor) / 100);
                return (
                  <li key={transaction.id} className={styles.transactionRow}>
                    <MerchantAvatar title={transaction.title} type={transaction.type} />
                    <div className={styles.transactionDetails}>
                      <p className={styles.transactionTitle}>{transaction.title}</p>
                      <p className={styles.transactionMeta}>
                        {transfer ? "Transferred" : income ? "Received" : "Paid"}<span className={styles.statusIcon} aria-hidden="true">{income ? "↙" : "↗"}</span>
                        {transaction.category ? <span className={styles.category}>{transaction.category}</span> : null}
                      </p>
                    </div>
                    <span className={`${styles.transactionAmount} ${income ? styles.positive : ""}`}>{income ? "+" : "−"}{amount}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {groups.size > 0 ? <p className={styles.transactionFooter}><span className={styles.statusDot} />All your activity, in one place</p> : null}
    </section>
  );
}
