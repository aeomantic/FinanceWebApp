import { WalletsView } from "@/components/dashboard/wallets-view";
import { getDashboardData } from "@/lib/dashboard/data";

export default async function WalletsPage() {
  const data = await getDashboardData();
  return <WalletsView wallets={data.wallets} name={data.name} email={data.email} error={data.error} demo={false} />;
}
