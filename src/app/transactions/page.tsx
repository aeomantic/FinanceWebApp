import { TransactionsView } from "@/components/dashboard/transactions-view";
import { getDashboardData } from "@/lib/dashboard/data";

export default async function TransactionsPage() {
  const data = await getDashboardData();
  return <TransactionsView wallets={data.wallets} transactions={data.transactions} today={data.today} periodStart={data.periodStart} name={data.name} error={data.error} demo={false} />;
}
