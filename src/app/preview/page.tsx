import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DEMO_WALLETS, getDemoTransactions } from "@/lib/dashboard/demo";
import type { DashboardData } from "@/lib/dashboard/types";

export const metadata = { title: "Explore Folio | A calmer way to money" };

export default function PreviewPage() {
  const today = "2026-09-13";
  const data: DashboardData = {
    name: "Alex Morgan",
    email: "alex@example.com",
    today,
    wallets: DEMO_WALLETS,
    categories: [],
    transactions: getDemoTransactions(today),
    error: null,
    periodStart: "2025-10-01",
  };
  return <DashboardShell data={data} demo />;
}
