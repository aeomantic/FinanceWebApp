import { TransactionsView } from "@/components/dashboard/transactions-view";
import { getDashboardData } from "@/lib/dashboard/data";
import { getUpcomingCommitments } from "@/lib/commitments/data";

import { getBills } from "@/lib/bills/data";

export default async function TransactionsPage() {
  const [data, upcoming, billing] = await Promise.all([getDashboardData(), getUpcomingCommitments(), getBills()]);
  return (
    <TransactionsView
      wallets={data.wallets}
      transactions={data.transactions}
      categories={data.categories}
      commitments={upcoming.commitments}
      bills={billing.bills}
      forecastError={billing.error || upcoming.error}
      today={data.today}
      periodStart={data.periodStart}
      name={data.name}
      error={data.error}
      demo={false}
    />
  );
}
