"use client";

import { useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import type { Transaction } from "@/lib/dashboard/types";
import styles from "./components.module.css";

export interface TransactionListProps {
  transactions: Transaction[];
  today: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  /** When provided, each row becomes a button that opens the detail view. */
  onSelect?: (transaction: Transaction) => void;
}

export function dateHeading(date: string, today: string): string {
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

export function MerchantAvatar({ type, categoryIcon }: Pick<Transaction, "type" | "categoryIcon">) {
  if (type === "transfer") {
    return <span className={`${styles.avatar} ${styles.avatarLavender}`} aria-hidden="true"><ArrowLeftRight size={17} strokeWidth={1.8} /></span>;
  }
  const palette = type === "income" ? styles.avatarMint : styles.avatarLavender;
  return <span className={`${styles.avatar} ${palette}`} aria-hidden="true"><CategoryIcon name={categoryIcon} size={18} /></span>;
}

export function TransactionList({ transactions, today, query = "", onQueryChange, onSelect }: TransactionListProps) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const searchId = useId();
  const listId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const filtered = transactions
    .filter((transaction) => `${transaction.title} ${transaction.category ?? ""}`.toLocaleLowerCase("en-US").includes(normalizedQuery))
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const visible = expanded || normalizedQuery ? filtered : filtered.slice(0, 5);
  const groups = visible.reduce<Map<string, Transaction[]>>((result, transaction) => {
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
                const content = (
                  <>
                    <MerchantAvatar type={transaction.type} categoryIcon={transaction.categoryIcon} />
                    <div className={styles.transactionDetails}>
                      <p className={styles.transactionTitle}>{transaction.title}</p>
                      <p className={styles.transactionMeta}>
                        {transfer ? "Transferred" : income ? "Received" : "Paid"}<span className={styles.statusIcon} aria-hidden="true">{income ? "↙" : "↗"}</span>
                        {transaction.category ? <span className={styles.category}>{transaction.category}</span> : null}
                      </p>
                    </div>
                    <span className={`${styles.transactionAmount} ${income ? styles.positive : ""}`}>{income ? "+" : "−"}{amount}</span>
                  </>
                );
                return onSelect ? (
                  <li key={transaction.id} className={styles.transactionRowItem}>
                    <button type="button" className={`${styles.transactionRow} ${styles.transactionRowButton}`} onClick={() => onSelect(transaction)}>
                      {content}
                    </button>
                  </li>
                ) : (
                  <li key={transaction.id} className={styles.transactionRow}>{content}</li>
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
