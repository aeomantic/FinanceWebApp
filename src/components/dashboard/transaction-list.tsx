"use client";

import { useId, useState } from "react";
import { TransactionItem } from "@/components/transactions/TransactionItem";
export { MerchantAvatar } from "@/components/transactions/TransactionItem";
import { DeleteTransactionsDialog } from "./delete-transactions-dialog";
import type { Transaction } from "@/lib/dashboard/types";
import styles from "./components.module.css";

export interface TransactionListProps {
  transactions: Transaction[];
  today: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  /** When provided, each row becomes a button that opens the detail view. */
  onSelect?: (transaction: Transaction) => void;
  demo?: boolean;
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

export function TransactionList({ transactions, today, query = "", onQueryChange, onSelect, demo = false }: TransactionListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const searchId = useId();
  const listId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const filtered = transactions
    .filter((transaction) => `${transaction.title} ${transaction.category ?? ""} ${transaction.note ?? ""}`.toLocaleLowerCase("en-US").includes(normalizedQuery))
    .toSorted((a, b) => b.date.localeCompare(a.date) || (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
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
              {rows.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  onSelect={onSelect}
                  onDelete={demo ? undefined : (selected) => setDeleteId(selected.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {groups.size > 0 ? <p className={styles.transactionFooter}><span className={styles.statusDot} />All your activity, in one place</p> : null}
      {deleteId && <DeleteTransactionsDialog ids={[deleteId]} onClose={() => setDeleteId(null)} onDeleted={() => setDeleteId(null)} />}
    </section>
  );
}
