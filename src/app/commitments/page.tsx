import { CommitmentsView } from "@/components/commitments/commitments-view";
import { getCommitmentsData } from "@/lib/commitments/data";

export default async function CommitmentsPage() {
  const data = await getCommitmentsData();
  return (
    <CommitmentsView
      commitments={data.commitments}
      wallets={data.wallets}
      categories={data.categories}
      today={data.today}
      name={data.name}
      error={data.error}
    />
  );
}
