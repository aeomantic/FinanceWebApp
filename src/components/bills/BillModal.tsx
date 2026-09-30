"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { saveBill, mutateBill } from "@/app/bills/actions";
import type { Bill } from "@/lib/bills/types";
import type { Wallet, Category } from "@/lib/dashboard/types";
import { initialBillDueDate } from "@/lib/monthly-expense";

export function BillModal({ bill, wallets, categories, today, onClose }: { bill?: Bill; wallets: Wallet[]; categories: Category[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [day, setDay] = useState(bill?.due_day ?? Number(today.slice(8)));
  const field = "w-full rounded-xl border border-zinc-500/30 bg-transparent px-3 py-2.5";
  function finish(result: { success: boolean; error?: string }) { if (!result.success) setError(result.error ?? "Unable to save."); else { router.refresh(); onClose(); } }
  return <Modal title={bill ? "Manage bill" : "Add bill"} onClose={onClose} busy={pending}>
    <form className="grid gap-4" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); start(async () => { try { finish(await saveBill({ id: bill?.id, updated_at: bill?.updated_at, biller_name: String(f.get("name")), amount: String(f.get("amount")), due_day: day, frequency: f.get("frequency") as Bill["frequency"], wallet_id: String(f.get("wallet")), category_id: String(f.get("category")), notes: String(f.get("notes")), auto_pay: f.has("auto") })); } catch { setError("Could not confirm this change. Refresh before retrying."); } }); }}>
      <label>Biller name<input name="name" className={field} defaultValue={bill?.biller_name} required maxLength={120} /></label>
      <label>Amount<input name="amount" className={field} type="number" min="0.01" step="0.01" defaultValue={bill?.amount} required /></label>
      <label>Due day of month<input className={field} type="number" min={1} max={31} value={day} onChange={e => setDay(Number(e.target.value))} required /></label>
      <label>Frequency<select name="frequency" className={field} defaultValue={bill?.frequency ?? "monthly"}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
      <p className="text-xs opacity-70">Next due: {bill && day === bill.due_day ? bill.next_due_date : day >= 1 && day <= 31 ? initialBillDueDate(day, bill ? `${bill.next_due_date.slice(0, 7)}-01` : today) : "Choose a day"}. Shorter months use their last day.</p>
      <label>Assigned wallet<select name="wallet" className={field} defaultValue={bill?.wallet_id ?? wallets.find(w => w.isDefault)?.id ?? ""} required><option value="">Choose wallet</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency})</option>)}</select></label>
      <label>Category<select name="category" className={field} defaultValue={bill?.category_id ?? ""}><option value="">Uncategorized</option>{categories.filter(c => c.type === "expense").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Notes<textarea name="notes" className={field} defaultValue={bill?.notes ?? ""} maxLength={2000} /></label>
      <label className="text-sm"><input name="auto" type="checkbox" defaultChecked={bill?.auto_pay} /> Auto-pay arranged with biller (record payments manually)</label>
      {error && <p role="alert" className="text-rose-500">{error}</p>}
      <button disabled={pending} className="rounded-2xl bg-[#FEF38B] px-4 py-3 font-semibold text-zinc-950">{pending ? "Saving…" : "Save bill"}</button>
      {bill && (confirmDelete ? <div className="rounded-xl bg-rose-500/10 p-3 text-sm"><p>Delete this bill schedule? Recorded expenses will remain.</p><button type="button" disabled={pending} className="p-2 text-rose-500" onClick={() => start(async () => { finish(await mutateBill(bill, "delete")); })}>Delete schedule</button><button type="button" disabled={pending} className="p-2" onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button type="button" disabled={pending} className="text-sm text-rose-500" onClick={() => setConfirmDelete(true)}>Delete bill schedule</button>)}
    </form>
  </Modal>;
}
