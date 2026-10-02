export interface Bill {
  id: string;
  biller_name: string;
  amount: number;
  currency: string;
  wallet_id: string | null;
  category_id: string | null;
  due_day: number;
  frequency: "monthly" | "quarterly" | "yearly";
  auto_pay: boolean;
  notes: string | null;
  last_paid_date: string | null;
  next_due_date: string;
  updated_at: string;
}
