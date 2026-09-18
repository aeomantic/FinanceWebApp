"use client";

import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MerchantAvatar } from "./transaction-list";
import { formatMoney } from "@/lib/dashboard/summary";
import type { Transaction, TransactionType, Wallet } from "@/lib/dashboard/types";
import styles from "./components.module.css";

const TYPE_LABEL: Record<TransactionType, string> = { income: "Income", expense: "Expense", transfer: "Transfer" };

/** `occurred_on` is date-only, so it is formatted at UTC noon - the same guard
 * the feed's date headings use so a timezone can never shift the day. */
function formatOccurredOn(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00.000Z`));
}

/** `created_at` is a real instant, so it is shown in the reader's own timezone. */
function formatRecordedAt(value: string): string | null {
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(stamp);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(stamp);
  return `${day} · ${time}`;
}

export function TransactionDetailDialog({ transaction, wallets, onClose, onEdit }: {
  transaction: Transaction;
  wallets: Wallet[];
  onClose: () => void;
  /** When provided, the dialog offers an Edit action (hosts open the prefilled form). */
  onEdit?: () => void;
}) {
  const income = transaction.type === "income";
  const transfer = transaction.type === "transfer";
  const amountTone = income ? styles.detailAmountPositive : transfer ? styles.detailAmountNeutral : "";
  const sign = transfer ? "" : income ? "+" : "−";
  const walletName = (id: string | undefined) => (id ? wallets.find((wallet) => wallet.id === id)?.name : undefined);
  const recordedAt = transaction.recordedAt ? formatRecordedAt(transaction.recordedAt) : null;

  return (
    <Modal title="Transaction" onClose={onClose} className="modal-sheet">
      <div className={styles.detailHero}>
        <MerchantAvatar type={transaction.type} categoryIcon={transaction.categoryIcon} />
        <div className={styles.detailHeroText}>
          <span className={`${styles.detailAmount} ${amountTone}`}>{sign}{formatMoney(transaction.amountMinor, transaction.currency)}</span>
          <p className={styles.detailTitle}>{transaction.title}</p>
        </div>
      </div>

      <ul className={styles.detailRows}>
        <li className={styles.detailRow}>
          <span className={styles.detailLabel}>Date</span>
          <span className={styles.detailValue}>{formatOccurredOn(transaction.date)}</span>
        </li>
        {recordedAt ? (
          <li className={styles.detailRow}>
            <span className={styles.detailLabel}>Recorded</span>
            <span className={styles.detailValue}>{recordedAt}</span>
          </li>
        ) : null}
        {transfer ? null : (
          <li className={styles.detailRow}>
            <span className={styles.detailLabel}>Category</span>
            <span className={styles.detailValue}>
              <CategoryIcon name={transaction.categoryIcon} size={15} />
              {transaction.category ?? "Uncategorized"}
            </span>
          </li>
        )}
        <li className={styles.detailRow}>
          <span className={styles.detailLabel}>{transfer ? "From" : "Wallet"}</span>
          <span className={styles.detailValue}><Icon name="wallet" size={15} />{walletName(transaction.walletId) ?? "Unknown wallet"}</span>
        </li>
        {transfer ? (
          <li className={styles.detailRow}>
            <span className={styles.detailLabel}>To</span>
            <span className={styles.detailValue}><Icon name="wallet" size={15} />{walletName(transaction.destinationWalletId) ?? "Unknown wallet"}</span>
          </li>
        ) : null}
        <li className={styles.detailRow}>
          <span className={styles.detailLabel}>Type</span>
          <span className={styles.detailValue}><span className={styles.typeBadge}>{TYPE_LABEL[transaction.type]}</span></span>
        </li>
      </ul>

      <div className={styles.noteCard}>
        <span className={styles.noteLabel}>Note</span>
        <p className={styles.noteBody}>
          {transaction.note ? transaction.note : <span className={styles.noteEmpty}>No note added</span>}
        </p>
      </div>

      {onEdit && (
        <button type="button" className="primary-button" onClick={onEdit}>
          Edit transaction<Icon name="pencil" size={16} />
        </button>
      )}
    </Modal>
  );
}
