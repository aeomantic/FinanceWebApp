export interface Goal {
  id: string;
  title: string;
  targetMinor: number;
  savedMinor: number;
  currency: string;
  deadline: string | null;
  icon: string | null;
  updatedAt: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  priceMinor: number | null;
  url: string | null;
  note: string | null;
  icon: string | null;
  /** Set when the wish was converted; the goals FK clears it if that goal is deleted. */
  convertedGoalId: string | null;
}

export interface GoalsData {
  goals: Goal[];
  wishes: WishlistItem[];
  /** The default wallet's currency, used to display wish prices (wishes carry no currency column). */
  primaryCurrency: string;
  today: string;
  name: string;
  error: string | null;
}

/** Compact goals + wishlist preview for the dashboard bento cards. */
export interface GoalsSummary {
  goals: Goal[];
  wishes: WishlistItem[];
  primaryCurrency: string;
}

export type GoalsResult = { success: true } | { success: false; error: string };

export interface CreateGoalInput { title: string; target: string; saved?: string; currency: string; deadline?: string; icon?: string }
export interface DepositToGoalInput { id: string; amount: string; updatedAt: string }
export interface CreateWishInput { name: string; price?: string; url?: string; note?: string; icon?: string }
export interface ConvertWishInput { id: string; target: string; currency: string; deadline?: string }
