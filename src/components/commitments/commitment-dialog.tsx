"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { IconPicker } from "@/components/ui/icon-picker";
import { saveCommitment } from "@/app/commitments/actions";
import { commitmentInputSchema } from "@/lib/commitments/validation";
import type { Commitment, CommitmentInput } from "@/lib/commitments/types";
import type { Category, Wallet } from "@/lib/dashboard/types";
import dashboardStyles from "@/components/dashboard/components.module.css";
import styles from "./commitments.module.css";

export function CommitmentDialog({ commitment, wallets, categories, today, onClose }: {
  commitment?: Commitment; wallets: Wallet[]; categories: Category[]; today: string; onClose: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState<CommitmentInput>(() => ({
    id: commitment?.id, updatedAt: commitment?.updatedAt, name: commitment?.name ?? "",
    amount: commitment ? `${Math.floor(commitment.amountMinor / 100)}.${String(commitment.amountMinor % 100).padStart(2, "0")}` : "",
    walletId: commitment?.walletId ?? wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? "",
    categoryId: commitment?.categoryId ?? undefined, obligationType: commitment?.obligationType ?? "subscription",
    frequency: commitment?.frequency ?? "monthly", intervalCount: commitment?.intervalCount ?? 1,
    nextDueOn: commitment?.nextDueOn ?? today, totalInstallments: commitment?.totalInstallments ?? 3,
    paidInstallments: commitment?.paidInstallments ?? 0, endDate: commitment?.endDate ?? "", icon: commitment?.icon ?? "rotate-ccw",
  }));
  const [showIcons, setShowIcons] = useState(false);
  const update = <K extends keyof CommitmentInput>(key: K, value: CommitmentInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const wallet = wallets.find((item) => item.id === form.walletId);
  const close = () => { if (!busy.current) onClose(); };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const payload: CommitmentInput = {
      ...form, categoryId: form.categoryId || undefined, endDate: form.obligationType === "bnpl" ? form.endDate || undefined : undefined,
      totalInstallments: form.obligationType === "bnpl" ? form.totalInstallments : undefined,
      paidInstallments: form.obligationType === "bnpl" ? form.paidInstallments : 0,
    };
    const checked = commitmentInputSchema.safeParse(payload);
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Check the form details."); return; }
    busy.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await saveCommitment(payload);
        if (!result.success) { setError(result.error); return; }
        router.refresh();
        onClose();
      } catch { setError("We couldn't save your changes. Please try again."); }
      finally { busy.current = false; }
    });
  }

  return <Modal title={commitment ? "Edit commitment" : "Add a commitment"} onClose={close}>
    <form onSubmit={submit} className={styles.dialogStack}>
      <p className="modal-description">Plan ahead for regular bills and purchases paid in installments.</p>
      <fieldset disabled={pending} className={styles.dialogStack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className={dashboardStyles.segmented} role="group" aria-label="Commitment type">
          {([["subscription", "Subscription"], ["bnpl", "Installment / BNPL"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.obligationType === value}
              onClick={() => update("obligationType", value)}
              className={`${dashboardStyles.segmentedOption} ${form.obligationType === value ? dashboardStyles.segmentedOptionActive : ""}`}
              style={{ flex: 1 }}
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor={`${id}-title`} className={styles.field}>
          Title
          <input id={`${id}-title`} className={styles.input} maxLength={80} required autoFocus placeholder="Netflix, gym, or a PayLater purchase" value={form.name} onChange={(event) => update("name", event.target.value)} />
        </label>
        <div className={styles.formGrid}>
          <label htmlFor={`${id}-amount`} className={styles.field}>
            Amount per payment{wallet ? ` (${wallet.currency})` : ""}
            <input id={`${id}-amount`} className={styles.input} inputMode="decimal" required placeholder="0.00" value={form.amount} onChange={(event) => update("amount", event.target.value)} />
          </label>
          <div className={styles.field}>
            <span>Billing wallet</span>
            <Select aria-label="Billing wallet" value={form.walletId} options={wallets.map((w) => ({ value: w.id, label: `${w.name} · ${w.currency}` }))} onChange={(value) => update("walletId", value)} disabled={pending} />
          </div>
        </div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <span>Expense category</span>
            <Select aria-label="Expense category" value={form.categoryId ?? ""} options={[{ value: "", label: "Uncategorized" }, ...categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }))]} onChange={(value) => update("categoryId", value || undefined)} disabled={pending} />
          </div>
          <div className={styles.field}>
            <span>Billing cycle</span>
            <Select
              aria-label="Billing cycle"
              value={form.frequency}
              options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" },
                ...(commitment?.frequency === "quarterly" ? [{ value: "quarterly", label: "Quarterly" }] : []),
                ...(commitment?.frequency === "custom_months" ? [{ value: "custom_months", label: `Every ${form.intervalCount} months` }] : [])]}
              onChange={(value) => update("frequency", value as CommitmentInput["frequency"])}
              disabled={pending}
            />
          </div>
        </div>
        <label htmlFor={`${id}-next`} className={styles.field}>
          Next payment date
          <input id={`${id}-next`} type="date" required className={styles.input} value={form.nextDueOn} onChange={(event) => update("nextDueOn", event.target.value)} />
          <span className={styles.hint}>Set this to the next unpaid payment. Update it as you record progress.</span>
        </label>
        {form.obligationType === "bnpl" && (
          <div className={styles.bnplBox}>
            <div className={styles.formGrid}>
              <label htmlFor={`${id}-total`} className={styles.field}>
                Total installments
                <input id={`${id}-total`} className={styles.input} type="number" min={1} max={600} step={1} required value={form.totalInstallments ?? ""} onChange={(event) => update("totalInstallments", event.target.value === "" ? undefined : Number(event.target.value))} />
              </label>
              <label htmlFor={`${id}-paid`} className={styles.field}>
                Already paid
                <input id={`${id}-paid`} className={styles.input} type="number" min={0} max={form.totalInstallments ?? 600} step={1} required value={form.paidInstallments} onChange={(event) => update("paidInstallments", Number(event.target.value))} />
              </label>
            </div>
            <label htmlFor={`${id}-deadline`} className={styles.field}>
              Final due date / payoff deadline
              <input id={`${id}-deadline`} className={styles.input} type="date" required value={form.endDate ?? ""} onChange={(event) => update("endDate", event.target.value)} />
            </label>
          </div>
        )}
        <div>
          <button type="button" className={styles.iconToggle} aria-expanded={showIcons} onClick={() => setShowIcons(!showIcons)}>{showIcons ? "Hide icon choices" : "Choose an icon"}</button>
          {showIcons && <div style={{ marginTop: 12 }}><IconPicker value={form.icon} onChange={(value) => update("icon", value)} /></div>}
        </div>
      </fieldset>
      <p className={styles.disclaimer}>This is a planning record. Paid counts are entered manually and do not change wallet balances. Log actual payments as expenses in your ledger.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={pending || wallets.length === 0}>{pending ? "Saving..." : commitment ? "Save changes" : "Add commitment"}</button>
    </form>
  </Modal>;
}
