"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { markCommitmentPaid } from "@/app/commitments/actions";
import type { Commitment } from "@/lib/commitments/types";

export function PaidButton({ commitment, disabled = false, onPaid }: {
  commitment: Commitment; disabled?: boolean; onPaid: () => void;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [paidVersion, setPaidVersion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const completed = commitment.obligationType === "bnpl" && commitment.paidInstallments >= (commitment.totalInstallments ?? 0);
  async function pay() {
    if (locked.current || paidVersion === commitment.updatedAt) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      const result = await markCommitmentPaid({ id: commitment.id, updatedAt: commitment.updatedAt });
      if (!result.success) { setError(result.error); return; }
      setPaidVersion(commitment.updatedAt);
      onPaid();
      router.refresh();
    } catch { setError("Payment could not be confirmed. Refresh before trying again."); }
    finally { locked.current = false; setPending(false); }
  }
  if (completed) return <span className="text-xs font-semibold text-emerald-400">Completed</span>;
  if (!commitment.isActive) return null;
  return <div>
    <button type="button" onClick={() => startTransition(pay)} disabled={disabled || pending || !commitment.walletId || paidVersion === commitment.updatedAt}
      aria-label={`Mark ${commitment.name} as paid`} title={!commitment.walletId ? "Assign a wallet before recording payment" : undefined}
      className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95 disabled:opacity-50">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />{pending ? "Recording…" : "Paid"}
    </button>
    {error && <p role="alert" className="mt-2 max-w-64 text-xs text-rose-400">{error}<button type="button" className="ml-2 underline" onClick={() => router.refresh()}>Refresh</button></p>}
  </div>;
}

export function PaymentNotice({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => { const timer = setTimeout(onDismiss, 5000); return () => clearTimeout(timer); }, [onDismiss]);
  return <div className="success-notice" role="status">Payment recorded as an expense.<button type="button" onClick={onDismiss} aria-label="Dismiss payment notification">×</button></div>;
}
