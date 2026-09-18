import { WishlistView } from "@/components/goals/wishlist-view";
import { getGoalsData } from "@/lib/goals/data";

export default async function WishlistPage() {
  const data = await getGoalsData();
  return (
    <WishlistView
      wishes={data.wishes}
      primaryCurrency={data.primaryCurrency}
      name={data.name}
      error={data.error}
    />
  );
}
