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
import { deleteGoal, deleteWishlistItem } from "@/app/goals/actions";
import { ConvertWishDialog, DepositDialog, NewGoalDialog, NewWishDialog } from "./goal-dialogs";
import type { Goal, WishlistItem } from "@/lib/goals/types";
import dashboardStyles from "@/components/dashboard/components.module.css";
import styles from "./goals.module.css";

interface GoalsViewProps {
  goals: Goal[];
  wishes: WishlistItem[];
  primaryCurrency: string;
  today: string;
  name: string;
  error?: string | null;
}

type GoalsDialog =
  | { kind: "new-goal" }
  | { kind: "deposit"; goal: Goal }
  | { kind: "new-wish" }
  | { kind: "convert"; wish: WishlistItem };

/** Deadlines are date-only, so format at UTC noon like the feeds do - a
 * timezone can never shift the day. */
function formatDeadline(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00.000Z`));
}

export function GoalsView({ goals, wishes, primaryCurrency, today, name: fullName, error }: GoalsViewProps) {
  const router = useRouter();
  const name = fullName.split(" ")[0] || "there";
  const [tab, setTab] = useState<"goals" | "wishlist">("goals");
  const [dialog, setDialog] = useState<GoalsDialog | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function removeGoal(goal: Goal) {
    if (pendingId) return;
    if (!window.confirm(`Delete ${goal.title}? This can't be undone.`)) return;
    setPendingId(goal.id);
    setActionError("");
    const result = await deleteGoal({ id: goal.id, updatedAt: goal.updatedAt });
    setPendingId(null);
    if (!result.success) { setActionError(result.error); return; }
    router.refresh();
  }

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
      <a href="#goals-main" className="skip-link">Skip to goals</a>
      <aside className="side-rail" aria-label="Main navigation">
        <Link href="/dashboard" className="rail-brand" aria-label="Folio home"><BrandMark /></Link>
        <nav className="rail-nav">
          <Link href="/dashboard" className="rail-link" aria-label="Overview" title="Overview"><Icon name="home" /></Link>
          <Link href="/transactions" className="rail-link" aria-label="Transactions" title="Transactions"><Icon name="transfer" /></Link>
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
            <Link href="/transactions">Transactions</Link>
            <Link href="/wallets">Wallets</Link>
          </nav>
          <div className="topbar-actions">
            <div className="user-greeting"><Link href="/settings" className="user-avatar" aria-label="Account settings">{name.slice(0, 1).toUpperCase()}</Link><span>Hi, {name}<span className="user-subtitle">Personal account</span></span></div>
          </div>
        </header>

        <main id="goals-main" className="transactions-page">
          <div className="page-heading">
            <div>
              <Link href="/dashboard" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" />Back to overview</Link>
              <div className="eyebrow page-eyebrow">NEEDS AND WANTS</div>
              <h1>Goals &amp; wishlist<span className="heading-spark" aria-hidden="true">✳</span></h1>
              <p>Savings targets you are committed to, and wants you are still weighing.</p>
            </div>
            <button type="button" className={styles.addButton} onClick={() => setDialog(tab === "goals" ? { kind: "new-goal" } : { kind: "new-wish" })}>
              <Plus size={16} aria-hidden="true" />{tab === "goals" ? "New goal" : "Add wish"}
            </button>
          </div>

          {error && <div className="dashboard-alert" role="alert">{error}<button onClick={() => router.refresh()}>Try again</button></div>}
          {actionError && <div className="dashboard-alert" role="alert">{actionError}<button onClick={() => setActionError("")}>Dismiss</button></div>}

          <div className={`${dashboardStyles.segmented} ${styles.tabs}`} role="group" aria-label="Goals or wishlist">
            {([["goals", `Goals (${goals.length})`], ["wishlist", `Wishlist (${wishes.length})`]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`${dashboardStyles.segmentedOption} ${tab === value ? dashboardStyles.segmentedOptionActive : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "goals" && (
            <section className={`surface-card ${dashboardStyles.transactions}`} aria-labelledby="goals-title">
              <div className={dashboardStyles.cardHeading}>
                <div><p className={dashboardStyles.eyebrow}>SAVING FOR</p><h2 id="goals-title">Goals</h2></div>
                <span className={dashboardStyles.smallCount}>{goals.length} total</span>
              </div>
              {goals.length === 0 ? (
                <div className={dashboardStyles.emptyState}>
                  <span className={dashboardStyles.emptyIcon} aria-hidden="true">↗</span>
                  <h3>No goals yet</h3>
                  <p>Turn a need into a target: an emergency fund, a trip, a new laptop.</p>
                </div>
              ) : (
                <ul className={styles.list}>
                  {goals.map((goal) => {
                    const reached = goal.savedMinor >= goal.targetMinor;
                    const percent = goal.targetMinor > 0 ? Math.round((goal.savedMinor / goal.targetMinor) * 100) : 0;
                    const pastDue = !reached && goal.deadline !== null && goal.deadline < today;
                    return (
                      <li key={goal.id} className={styles.card}>
                        <div className={styles.cardTop}>
                          <span className={`${dashboardStyles.avatar} ${dashboardStyles.avatarMint}`} aria-hidden="true"><CategoryIcon name={goal.icon ?? "piggy-bank"} size={18} /></span>
                          <div className={styles.info}>
                            <span className={styles.name}>{goal.title}</span>
                            <p className={styles.meta}>
                              {goal.deadline ? `By ${formatDeadline(goal.deadline)}` : "No deadline"}
                              {pastDue && <span className={styles.metaDue}> · Past due</span>}
                            </p>
                          </div>
                          <div className={styles.rowActions}>
                            <button type="button" className={`${styles.rowAction} ${styles.rowActionDanger}`} aria-label={`Delete ${goal.title}`} onClick={() => removeGoal(goal)} disabled={pendingId === goal.id}><Trash2 size={15} aria-hidden="true" /></button>
                          </div>
                        </div>
                        <div
                          className={styles.meterTrack}
                          role="meter"
                          aria-label={`${goal.title} progress`}
                          aria-valuenow={goal.savedMinor}
                          aria-valuemin={0}
                          aria-valuemax={goal.targetMinor}
                          aria-valuetext={`${formatMoney(goal.savedMinor, goal.currency)} of ${formatMoney(goal.targetMinor, goal.currency)}`}
                        >
                          <div className={`${styles.meterFill} ${reached ? styles.meterFillDone : ""}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                        <div className={styles.cardFooter}>
                          <span className={styles.savedLine}><strong>{formatMoney(goal.savedMinor, goal.currency)}</strong> of {formatMoney(goal.targetMinor, goal.currency)}</span>
                          <span className={styles.percent}>{percent}%</span>
                        </div>
                        <div className={styles.cardActions}>
                          <button type="button" className={styles.pillButton} onClick={() => setDialog({ kind: "deposit", goal })}><Plus size={14} aria-hidden="true" />Add money</button>
                          {reached && <span className={styles.reachedBadge}>Target reached</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === "wishlist" && (
            <section className={`surface-card ${dashboardStyles.transactions}`} aria-labelledby="wishlist-title">
              <div className={dashboardStyles.cardHeading}>
                <div><p className={dashboardStyles.eyebrow}>STILL DECIDING</p><h2 id="wishlist-title">Wishlist</h2></div>
                <span className={dashboardStyles.smallCount}>{wishes.length} total</span>
              </div>
              {wishes.length === 0 ? (
                <div className={dashboardStyles.emptyState}>
                  <span className={dashboardStyles.emptyIcon} aria-hidden="true">↗</span>
                  <h3>Nothing on your wishlist</h3>
                  <p>Park the wants here first. Convert one to a goal when you are ready to save for it.</p>
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
                            <button type="button" className={styles.pillButton} onClick={() => setDialog({ kind: "convert", wish })}>Add to goals<ArrowRight size={14} aria-hidden="true" /></button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <footer className="dashboard-footer"><span><span className="footer-leaf">✳</span> A calmer way to money.</span><span>Planning records only. Moving real money stays in your ledger.</span><div><SignOutButton /></div></footer>
        </main>
      </div>

      <MobileNav />

      {dialog?.kind === "new-goal" && <NewGoalDialog primaryCurrency={primaryCurrency} onClose={() => setDialog(null)} />}
      {dialog?.kind === "deposit" && <DepositDialog goal={dialog.goal} onClose={() => setDialog(null)} />}
      {dialog?.kind === "new-wish" && <NewWishDialog primaryCurrency={primaryCurrency} onClose={() => setDialog(null)} />}
      {dialog?.kind === "convert" && <ConvertWishDialog wish={dialog.wish} primaryCurrency={primaryCurrency} onClose={() => setDialog(null)} />}
    </div>
  );
}
