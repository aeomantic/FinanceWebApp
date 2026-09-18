"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, Icon } from "@/components/ui/icon";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { formatMoney } from "@/lib/dashboard/summary";
import { deleteWishlistItem } from "@/app/goals/actions";
import { ConvertWishDialog, NewWishDialog } from "./goal-dialogs";
import type { WishlistItem } from "@/lib/goals/types";
import dashboardStyles from "@/components/dashboard/components.module.css";
import styles from "./goals.module.css";

interface WishlistViewProps {
  wishes: WishlistItem[];
  primaryCurrency: string;
  name: string;
  error?: string | null;
}

type WishlistDialog = { kind: "new-wish" } | { kind: "convert"; wish: WishlistItem };

export function WishlistView({ wishes, primaryCurrency, name: fullName, error }: WishlistViewProps) {
  const router = useRouter();
  const name = fullName.split(" ")[0] || "there";
  const [dialog, setDialog] = useState<WishlistDialog | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function removeWish(wish: WishlistItem) {
    if (pendingId) return;
    if (!window.confirm(`Delete ${wish.name}? This can't be undone.`)) return;
    setPendingId(wish.id);
    setActionError("");
    const result = await deleteWishlistItem({ id: wish.id });
    setPendingId(null);
    if (!result.success) { setActionError(result.error); return; }
    router.refresh();
  }

  return (
    <div className="app-frame transactions-frame">
      <a href="#wishlist-main" className="skip-link">Skip to wishlist</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href="/dashboard" className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href="/dashboard" className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href="/transactions" className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
          <Link href="/goals" className="rail-link" aria-label="Goals" title="Goals"><Icon name="target" /></Link>
          <Link href="/wallets" className="rail-link" aria-label="Wallets" title="Wallets"><Icon name="wallet" /></Link>
        </nav>
        <Link href="/settings" className="rail-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <Link href="/dashboard" className="wordmark">folio<span>.</span></Link>
          <nav className="top-nav" aria-label="Dashboard sections">
            <Link href="/dashboard">Overview</Link>
            <Link href="/goals">Goals</Link>
            <Link href="/wishlist" className="selected">Wishlist</Link>
            <Link href="/wallets">Wallets</Link>
          </nav>
          <div className="topbar-actions">
            <div className="user-greeting"><Link href="/settings" className="user-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link><span>Hi, {name}<span className="user-subtitle">Personal account</span></span></div>
          </div>
        </header>

        <main id="wishlist-main" className="transactions-page">
          <div className="page-heading">
            <div>
              <Link href="/dashboard" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" />Back to overview</Link>
              <div className="eyebrow page-eyebrow">WANTS AND MAYBES</div>
              <h1>Wishlist<span className="heading-spark" aria-hidden="true">✳</span></h1>
              <p>Wants you are still weighing. Ready to save for one? <Link href="/goals" className={styles.inlineLink}>See your goals</Link>.</p>
            </div>
            <button type="button" className={styles.addButton} onClick={() => setDialog({ kind: "new-wish" })}>
              <Plus size={16} aria-hidden="true" />Add wish
            </button>
          </div>

          {error && <div className="dashboard-alert" role="alert">{error}<button onClick={() => router.refresh()}>Try again</button></div>}
          {actionError && <div className="dashboard-alert" role="alert">{actionError}<button onClick={() => setActionError("")}>Dismiss</button></div>}

          <section className={`surface-card ${dashboardStyles.transactions}`} aria-labelledby="wishlist-title">
            <div className={dashboardStyles.cardHeading}>
              <div><p className={dashboardStyles.eyebrow}>STILL DECIDING</p><h2 id="wishlist-title">Wishlist</h2></div>
              <span className={dashboardStyles.smallCount}>{wishes.length} total</span>
            </div>
            {wishes.length === 0 ? (
              <div className={dashboardStyles.emptyState}>
                <span className={dashboardStyles.emptyIcon} aria-hidden="true">↗</span>
                <h3>Nothing on your wishlist</h3>
                <p>Park the wants here first. Move one to your goals when you are ready to save for it.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {wishes.map((wish) => {
                  const safeUrl = wish.url && /^https?:\/\//i.test(wish.url) ? wish.url : null;
                  return (
                    <li key={wish.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <span className={`${dashboardStyles.avatar} ${dashboardStyles.avatarLavender}`} aria-hidden="true"><CategoryIcon name={wish.icon ?? "sparkles"} size={18} /></span>
                        <div className={styles.info}>
                          <span className={styles.name}>{wish.name}</span>
                          <p className={styles.meta}>{wish.priceMinor !== null ? `About ${formatMoney(wish.priceMinor, primaryCurrency)}` : "No price yet"}</p>
                        </div>
                        <div className={styles.rowActions}>
                          <button type="button" className={`${styles.rowAction} ${styles.rowActionDanger}`} aria-label={`Delete ${wish.name}`} onClick={() => removeWish(wish)} disabled={pendingId === wish.id}><Trash2 size={15} aria-hidden="true" /></button>
                        </div>
                      </div>
                      {wish.note && <p className={styles.wishNote}>{wish.note}</p>}
                      <div className={styles.cardActions}>
                        {safeUrl ? (
                          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={styles.wishLink}>View item<Icon name="arrow-up-right" size={13} /></a>
                        ) : <span />}
                        {wish.convertedGoalId ? (
                          <span className={styles.convertedChip}>In your goals</span>
                        ) : (
                          <button type="button" className={styles.pillButton} onClick={() => setDialog({ kind: "convert", wish })}>Move to Goals<ArrowRight size={14} aria-hidden="true" /></button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>Planning records only. Moving real money stays in your ledger.</span><div><SignOutButton /></div></footer>
        </main>
      </div>

      <MobileNav />

      {dialog?.kind === "new-wish" && <NewWishDialog primaryCurrency={primaryCurrency} onClose={() => setDialog(null)} />}
      {dialog?.kind === "convert" && <ConvertWishDialog wish={dialog.wish} primaryCurrency={primaryCurrency} onClose={() => setDialog(null)} />}
    </div>
  );
}
