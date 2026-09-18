import { TransactionsView } from "@/components/dashboard/transactions-view";
import { getDashboardData } from "@/lib/dashboard/data";
import { getUpcomingCommitments } from "@/lib/commitments/data";

export default async function TransactionsPage() {
  const [data, upcoming] = await Promise.all([getDashboardData(), getUpcomingCommitments()]);
  return (
    <TransactionsView
      wallets={data.wallets}
      transactions={data.transactions}
      categories={data.categories}
      commitments={upcoming.commitments}
      today={data.today}
      periodStart={data.periodStart}
      name={data.name}
      error={data.error}
      demo={false}
    />
  );
}
