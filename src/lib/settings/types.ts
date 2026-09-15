import type { Category, Wallet } from "@/lib/dashboard/types";
export type ThemePreference = "light" | "dark" | "system";
export interface SettingsData {
  email: string;
  displayName: string;
  themePreference: ThemePreference;
  wallets: Wallet[];
  categories: Category[];
  error: string | null;
}
export type SettingsResult = { success: true } | { success: false; error: string };
export interface ProfileInput { displayName: string }
export interface CategoryUpdateInput { categoryId: string; name: string; icon: string }
