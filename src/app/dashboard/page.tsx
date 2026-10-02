import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardData } from "@/lib/dashboard/data";
import { getGoalsSummary } from "@/lib/goals/data";

import { getBills } from "@/lib/bills/data";
import { getUpcomingCommitments } from "@/lib/commitments/data";

export default async function DashboardPage() {
  const [data, goalsSummary, billing, upcoming] = await Promise.all([getDashboardData(), getGoalsSummary(), getBills(), getUpcomingCommitments()]);
  return <DashboardShell data={data} goalsSummary={goalsSummary} bills={billing.bills} commitments={upcoming.commitments} forecastError={billing.error || upcoming.error} />;
}
