import type { CategoryType } from "./types";

export const DEFAULT_CATEGORIES: { name: string; type: CategoryType; icon: string }[] = [
  { name: "Food & Dining", type: "expense", icon: "utensils" },
  { name: "Groceries", type: "expense", icon: "shopping-cart" },
  { name: "Housing & Rent", type: "expense", icon: "home" },
  { name: "Utilities & Bills", type: "expense", icon: "zap" },
  { name: "Transportation", type: "expense", icon: "car" },
  { name: "Entertainment", type: "expense", icon: "film" },
  { name: "Shopping & Retail", type: "expense", icon: "shopping-bag" },
  { name: "Healthcare & Fitness", type: "expense", icon: "heart-pulse" },
  { name: "Education", type: "expense", icon: "graduation-cap" },
  { name: "Personal Care", type: "expense", icon: "sparkles" },
  { name: "Salary & Wages", type: "income", icon: "briefcase" },
  { name: "Freelance & Consulting", type: "income", icon: "laptop" },
  { name: "Investments & Dividends", type: "income", icon: "trending-up" },
  { name: "Gifts & Grants", type: "income", icon: "gift" },
  { name: "Refunds & Cashbacks", type: "income", icon: "rotate-ccw" },
  { name: "Other Income", type: "income", icon: "coins" },
];
