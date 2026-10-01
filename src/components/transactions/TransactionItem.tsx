"use client";

import { ArrowLeftRight } from "lucide-react";
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

export function TransactionItem({ transaction, walletName, onSelect }: { transaction: Transaction; walletName?: string; onSelect?: (transaction: Transaction) => void }) {
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
  return onSelect ? <li className={styles.transactionRowItem}><button type="button" className={`${styles.transactionRow} ${styles.transactionRowButton}`} onClick={() => onSelect(transaction)}>{content}</button></li>
    : <li className={styles.transactionRow}>{content}</li>;
}
