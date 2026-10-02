"use client";

import { ArrowLeftRight, Check, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MerchantIcon } from "./MerchantIcon";
import { formatMoney } from "@/lib/dashboard/summary";
import type { Transaction } from "@/lib/dashboard/types";
import styles from "../dashboard/components.module.css";

export function MerchantAvatar({ type, categoryIcon, merchant }: Pick<Transaction, "type" | "categoryIcon" | "merchant">) {
  if (type === "transfer") return <span className={`${styles.avatar} ${styles.avatarLavender}`} aria-hidden="true"><ArrowLeftRight size={17} /></span>;
  if (merchant) return <MerchantIcon merchant={merchant} />;
  return <span className={`${styles.avatar} ${type === "income" ? styles.avatarMint : styles.avatarLavender}`} aria-hidden="true"><CategoryIcon name={categoryIcon} size={18} /></span>;
}

export function TransactionItem({ transaction, walletName, onSelect, onDelete, selectable = false, selected = false, onToggleSelect }: {
  transaction: Transaction;
  walletName?: string;
  onSelect?: (transaction: Transaction) => void;
  /** When set (and not in select mode) the row gets a trailing delete button. */
  onDelete?: (transaction: Transaction) => void;
  /** Multi-select mode: the row toggles selection instead of opening the detail. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (transaction: Transaction) => void;
}) {
  const income = transaction.type === "income";
  const transfer = transaction.type === "transfer";
  const title = transaction.merchant?.name ?? transaction.title;
  const subtitle = transaction.merchant
    ? [transaction.category, transaction.note].filter(Boolean).join(" · ") || (income ? "Received" : "Paid")
    : [transfer ? "Transferred" : income ? "Received" : "Paid", transaction.category].filter(Boolean).join(" · ");
  const content = <>
    <MerchantAvatar {...transaction} />
    <div className={styles.transactionDetails}>
      <p className={styles.transactionTitle}>{title}</p>
      <p className={styles.merchantSubtitle}>{subtitle}</p>
    </div>
    <div className={styles.ledgerRowEnd}>
      {walletName && <span className={styles.walletBadge}>{walletName}</span>}
      <span className={`${styles.transactionAmount} ${income ? styles.positive : ""}`}>{transfer ? "" : income ? "+" : "−"}{formatMoney(transaction.amountMinor, transaction.currency)}</span>
    </div>
  </>;

  // Read-only row (e.g. the upcoming-expenses list): no button, no actions.
  if (!onSelect && !selectable) return <li className={styles.transactionRow}>{content}</li>;

  return (
    <li className={`${styles.transactionRowItem} flex items-center gap-2`}>
      <button
        type="button"
        className={`${styles.transactionRow} ${styles.transactionRowButton}`}
        role={selectable ? "checkbox" : undefined}
        aria-checked={selectable ? selected : undefined}
        onClick={() => (selectable ? onToggleSelect?.(transaction) : onSelect?.(transaction))}
      >
        {selectable && <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-zinc-700">{selected && <Check className="h-4 w-4 text-emerald-400" />}</span>}
        {content}
      </button>
      {onDelete && !selectable && <button type="button" aria-label={`Delete ${title}`} onClick={() => onDelete(transaction)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-950/30"><Trash2 size={16} aria-hidden="true" /></button>}
    </li>
  );
}
