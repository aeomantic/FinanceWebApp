"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, Icon } from "@/components/ui/icon";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { formatMoney } from "@/lib/dashboard/summary";
import { changeCommitmentStatus, deleteCommitment } from "@/app/commitments/actions";
import { CommitmentDialog } from "./commitment-dialog";
import type { Commitment } from "@/lib/commitments/types";
import type { Category, Wallet } from "@/lib/dashboard/types";
import dashboardStyles from "@/components/dashboard/components.module.css";
import styles from "./commitments.module.css";

interface CommitmentsViewProps {
  commitments: Commitment[];
  wallets: Wallet[];
  categories: Category[];
  today: string;
  name: string;
  error?: string | null;
}

const FREQUENCY_LABEL: Record<Commitment["frequency"], string> = {
  weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", custom_months: "Recurring",
};

export function CommitmentsView({ commitments, wallets, categories, today, name: fullName, error }: CommitmentsViewProps) {
  const router = useRouter();
  const name = fullName.split(" ")[0] || "there";
  const [dialogTarget, setDialogTarget] = useState<Commitment | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const subscriptions = commitments.filter((commitment) => commitment.obligationType === "subscription");
  const installments = commitments.filter((commitment) => commitment.obligationType === "bnpl");
  const editingCommitment = dialogTarget && dialogTarget !== "new" ? dialogTarget : undefined;

  async function toggleActive(commitment: Commitment) {
    if (pendingId) return;
    setPendingId(commitment.id);
    setActionError("");
    const result = await changeCommitmentStatus({ id: commitment.id, updatedAt: commitment.updatedAt, isActive: !commitment.isActive });
    setPendingId(null);
    if (!result.success) { setActionError(result.error); return; }
    router.refresh();
  }

  async function remove(commitment: Commitment) {
    if (pendingId) return;
    if (!window.confirm(`Delete ${commitment.name}? This can't be undone.`)) return;
    setPendingId(commitment.id);
    setActionError("");
    const result = await deleteCommitment({ id: commitment.id, updatedAt: commitment.updatedAt });
    setPendingId(null);
    if (!result.success) { setActionError(result.error); return; }
    router.refresh();
  }

  return (
    <div className="app-frame transactions-frame">
      <a href="#commitments-main" className="skip-link">Skip to commitments</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href="/dashboard" className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href="/dashboard" className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href="/transactions" className="rail-link active" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
          <Link href="/dashboard" className="rail-link" aria-label="Activity" title="Activity"><Icon name="activity" /></Link>
          <Link href="/wallets" className="rail-link" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <Link href="/settings" className="rail-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href="/dashboard" className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections">
            <Link href="/dashboard">Overview</Link>
            <Link href="/transactions" className="selected">Transactions</Link>
            <Link href="/wallets">Wallets</Link>
          </nav>
          <div className="topbar-actions">
            <div className="user-greeting"><Link href="/settings" className="user-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link><span>Hi, {name}<span className="user-subtitle">Personal account</span></span></div>
          </div>
        </header>

        <main id="commitments-main" className="transactions-page">
          <div className="page-heading">
            <div><div className="eyebrow page-eyebrow">PLAN AHEAD</div><h1>Recurring &amp; commitments<span className="heading-spark" aria-hidden="true">✳</span></h1><p>Subscriptions and installment purchases, tracked in one place.</p></div>
            <Link href="/transactions" className="commitments-link">Back to transactions</Link>
          </div>

          {error && <div className="dashboard-alert" role="alert">{error}<button onClick={() => router.refresh()}>Try again</button></div>}
          {actionError && <div className="dashboard-alert" role="alert">{actionError}<button onClick={() => setActionError("")}>Dismiss</button></div>}

          <div className={styles.pageActions}>
            <button type="button" className={styles.addButton} onClick={() => setDialogTarget("new")} disabled={wallets.length === 0}><Plus size={16} aria-hidden="true" />Add commitment</button>
          </div>

          <section className={`surface-card ${dashboardStyles.transactions}`} aria-labelledby="subscriptions-title">
            <div className={dashboardStyles.cardHeading}>
              <div><p className={dashboardStyles.eyebrow}>ONGOING</p><h2 id="subscriptions-title">Subscriptions</h2></div>
              <span className={dashboardStyles.smallCount}>{subscriptions.length} total</span>
            </div>
            {subscriptions.length === 0 ? (
              <div className={dashboardStyles.emptyState}>
                <span className={dashboardStyles.emptyIcon} aria-hidden="true">↗</span>
                <h3>No subscriptions yet</h3>
                <p>Add a recurring bill like rent, a gym membership, or a streaming service.</p>
              </div>
            ) : (
              <ul className={styles.subscriptionsList}>
                {subscriptions.map((commitment) => (
                  <li key={commitment.id} className={styles.subscriptionRow}>
                    <span className={`${dashboardStyles.avatar} ${dashboardStyles.avatarLavender}`} aria-hidden="true"><CategoryIcon name={commitment.icon} size={18} /></span>
                    <div className={styles.subscriptionInfo}>
                      <span className={styles.subscriptionName}>{commitment.name}</span>
                      <p className={styles.subscriptionMeta}>{FREQUENCY_LABEL[commitment.frequency]} &middot; Next {commitment.nextDueOn}{!commitment.isActive ? " · Paused" : ""}</p>
                    </div>
                    <div className={styles.subscriptionEnd}>
                      <span className={styles.subscriptionAmount}>{formatMoney(commitment.amountMinor, commitment.currency)}</span>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.rowAction} aria-label={commitment.isActive ? `Pause ${commitment.name}` : `Resume ${commitment.name}`} onClick={() => toggleActive(commitment)} disabled={pendingId === commitment.id}>
                          {commitment.isActive ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                        </button>
                        <button type="button" className={styles.rowAction} aria-label={`Edit ${commitment.name}`} onClick={() => setDialogTarget(commitment)}><Pencil size={15} aria-hidden="true" /></button>
                        <button type="button" className={`${styles.rowAction} ${styles.rowActionDanger}`} aria-label={`Delete ${commitment.name}`} onClick={() => remove(commitment)} disabled={pendingId === commitment.id}><Trash2 size={15} aria-hidden="true" /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`surface-card ${dashboardStyles.transactions}`} aria-labelledby="bnpl-title">
            <div className={dashboardStyles.cardHeading}>
              <div><p className={dashboardStyles.eyebrow}>PAY OVER TIME</p><h2 id="bnpl-title">Installments &amp; BNPL</h2></div>
              <span className={dashboardStyles.smallCount}>{installments.length} total</span>
            </div>
            {installments.length === 0 ? (
              <div className={dashboardStyles.emptyState}>
                <span className={dashboardStyles.emptyIcon} aria-hidden="true">↗</span>
                <h3>Nothing on installments</h3>
                <p>Track a PayLater purchase or any bill split into fixed payments.</p>
              </div>
            ) : (
              <ul className={styles.bnplList}>
                {installments.map((commitment) => {
                  const total = commitment.totalInstallments ?? 0;
                  const remaining = Math.max(total - commitment.paidInstallments, 0);
                  const outstandingMinor = commitment.amountMinor * remaining;
                  const percent = total > 0 ? Math.round((commitment.paidInstallments / total) * 100) : 0;
                  return (
                    <li key={commitment.id} className={styles.bnplCard}>
                      <div className={styles.bnplTop}>
                        <span className={`${dashboardStyles.avatar} ${dashboardStyles.avatarMint}`} aria-hidden="true"><CategoryIcon name={commitment.icon} size={18} /></span>
                        <div className={styles.subscriptionInfo}>
                          <span className={styles.subscriptionName}>{commitment.name}</span>
                          <p className={styles.subscriptionMeta}>{commitment.paidInstallments} of {total} paid &middot; {remaining} remaining</p>
                        </div>
                        <div className={styles.subscriptionEnd}>
                          <div className={styles.rowActions}>
                            <button type="button" className={styles.rowAction} aria-label={`Edit ${commitment.name}`} onClick={() => setDialogTarget(commitment)}><Pencil size={15} aria-hidden="true" /></button>
                            <button type="button" className={`${styles.rowAction} ${styles.rowActionDanger}`} aria-label={`Delete ${commitment.name}`} onClick={() => remove(commitment)} disabled={pendingId === commitment.id}><Trash2 size={15} aria-hidden="true" /></button>
                          </div>
                        </div>
                      </div>
                      <div className={styles.bnplProgress} role="meter" aria-label={`${commitment.name} installments paid`} aria-valuenow={commitment.paidInstallments} aria-valuemin={0} aria-valuemax={total}>
                        {total > 0 && total <= 24
                          ? Array.from({ length: total }, (_, index) => <span key={index} className={`${styles.bnplSegment} ${index < commitment.paidInstallments ? styles.bnplSegmentPaid : ""}`} />)
                          : <div className={styles.bnplProgressBar}><div className={styles.bnplProgressBarFill} style={{ width: `${percent}%` }} /></div>}
                      </div>
                      <div className={styles.bnplFooter}>
                        <span className={styles.bnplOutstanding}>{formatMoney(outstandingMinor, commitment.currency)} outstanding</span>
                        <span>Due by {commitment.endDate}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>Planning records only. Log real payments as expenses.</span><div><SignOutButton /></div></footer>
        </main>
      </div>

      <MobileNav />

      {dialogTarget && (
        <CommitmentDialog
          commitment={editingCommitment}
          wallets={wallets}
          categories={categories}
          today={today}
          onClose={() => setDialogTarget(null)}
        />
      )}
    </div>
  );
}
