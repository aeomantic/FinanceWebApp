import { GoalsView } from "@/components/goals/goals-view";
import { getGoalsData } from "@/lib/goals/data";

export default async function GoalsPage() {
  const data = await getGoalsData();
  return (
    <GoalsView
      goals={data.goals}
      wishes={data.wishes}
      primaryCurrency={data.primaryCurrency}
      today={data.today}
      name={data.name}
      error={data.error}
    />
  );
}
