"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { deleteTransactions } from "@/app/dashboard/actions";

export function DeleteTransactionsDialog({ ids, onClose, onDeleted }: {
  ids: string[]; onClose: () => void; onDeleted: () => void;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      const result = await deleteTransactions(ids);
      if (!result.success) { setError(result.error); return; }
      onDeleted();
      router.refresh();
    } catch { setError("We couldn't delete these transactions. Please try again."); }
    finally { locked.current = false; setPending(false); }
  }
  return <Modal title={ids.length === 1 ? "Delete transaction?" : `Delete ${ids.length} transactions?`} busy={pending} onClose={onClose}>
    <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-rose-400">
      <AlertTriangle className="mb-2 h-6 w-6" aria-hidden="true" />
      <p>{ids.length === 1
        ? "Are you sure you want to delete this transaction? Once deleted, it cannot be recovered and will be permanently removed from your ledger."
        : `Delete ${ids.length} transactions? Once deleted, these transactions cannot be recovered. Your wallet balances will be updated accordingly.`}</p>
      {ids.length === 1 && <p className="mt-3 font-bold">Once deleted, this transaction cannot be recovered.</p>}
    </div>
    <p className="my-3 text-sm">Wallet balances will be updated. Any recorded commitment progress stays unchanged.</p>
    {error && <p role="alert" className="my-3 text-rose-400">{error}</p>}
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" autoFocus disabled={pending} onClick={onClose} className="rounded-xl border border-zinc-500 px-4 py-2">Cancel</button>
      <button type="button" disabled={pending} onClick={() => startTransition(confirm)} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{pending ? "Deleting…" : "Delete permanently"}</button>
    </div>
  </Modal>;
}
