import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDashboardData } from "@/lib/dashboard/data";
import { getGoalsSummary } from "@/lib/goals/data";

export default async function DashboardPage() {
  const [data, goalsSummary] = await Promise.all([getDashboardData(), getGoalsSummary()]);
  return <DashboardShell data={data} goalsSummary={goalsSummary} />;
}
