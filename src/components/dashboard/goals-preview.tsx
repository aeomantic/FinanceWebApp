"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { CategoryIcon } from "@/components/ui/category-icon";
import { formatMoney } from "@/lib/dashboard/summary";
import type { Goal, WishlistItem } from "@/lib/goals/types";

/** Top savings goals with progress, plus a link into the full /goals page.
 * Complements the "Small steps" insight banner rather than replacing it. */
export function GoalsSummaryCard({ goals, demo = false }: { goals: Goal[]; demo?: boolean }) {
  const goalsHref = demo ? "/login" : "/goals";
  return (
    <section className="goals-widget" aria-labelledby="goals-widget-title">
      <div className="goals-widget-head">
        <span className="eyebrow">SAVING FOR</span>
        <span className="goals-widget-icon"><Icon name="target" size={17} /></span>
      </div>
      <h2 id="goals-widget-title">Goals</h2>
      {goals.length === 0 ? (
        <p className="goals-widget-empty">No goals yet. Set a target for something you are saving toward.</p>
      ) : (
        <ul className="goals-widget-list">
          {goals.slice(0, 3).map((goal) => {
            const reached = goal.savedMinor >= goal.targetMinor;
            const percent = goal.targetMinor > 0 ? Math.min(Math.round((goal.savedMinor / goal.targetMinor) * 100), 100) : 0;
            return (
              <li key={goal.id} className="goal-mini">
                <div className="goal-mini-top">
                  <span className="goal-mini-name"><CategoryIcon name={goal.icon ?? "piggy-bank"} size={15} />{goal.title}</span>
                  <span className="goal-mini-percent">{percent}%</span>
                </div>
                <div className="goal-mini-track"><div className={`goal-mini-fill${reached ? " goal-mini-fill-done" : ""}`} style={{ width: `${percent}%` }} /></div>
                <span className="goal-mini-amount">{formatMoney(goal.savedMinor, goal.currency)} of {formatMoney(goal.targetMinor, goal.currency)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <Link className="text-action" href={goalsHref}>View all goals<Icon name="arrow-right" size={17} /></Link>
    </section>
  );
}

/** Compact preview of the most recent wants, linking into /wishlist. */
export function WishlistPreviewCard({ wishes, primaryCurrency, demo = false }: { wishes: WishlistItem[]; primaryCurrency: string; demo?: boolean }) {
  const wishlistHref = demo ? "/login" : "/wishlist";
  return (
    <section className="wishlist-widget" aria-labelledby="wishlist-widget-title">
      <div className="goals-widget-head">
        <span className="eyebrow">STILL DECIDING</span>
        <span className="goals-widget-icon"><Icon name="sparkle" size={17} /></span>
      </div>
      <h2 id="wishlist-widget-title">Wishlist</h2>
      {wishes.length === 0 ? (
        <p className="goals-widget-empty">Nothing here yet. Park a want before you commit to it.</p>
      ) : (
        <ul className="wishlist-widget-list">
          {wishes.slice(0, 3).map((wish) => (
            <li key={wish.id} className="wish-mini">
              <span className="wish-mini-name"><CategoryIcon name={wish.icon ?? "sparkles"} size={15} />{wish.name}</span>
              <span className="wish-mini-price">{wish.priceMinor !== null ? formatMoney(wish.priceMinor, primaryCurrency) : "—"}</span>
            </li>
          ))}
        </ul>
      )}
      <Link className="text-action" href={wishlistHref}>Manage wishlist<Icon name="arrow-right" size={17} /></Link>
    </section>
  );
}
