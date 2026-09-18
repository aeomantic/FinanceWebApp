"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { IconPicker } from "@/components/ui/icon-picker";
import { formatMoney, SUPPORTED_CURRENCIES } from "@/lib/dashboard/summary";
import { convertWishToGoal, createGoal, createWishlistItem, depositToGoal } from "@/app/goals/actions";
import { convertWishInputSchema, createGoalInputSchema, createWishInputSchema, depositToGoalInputSchema } from "@/lib/goals/validation";
import type { Goal, GoalsResult, WishlistItem } from "@/lib/goals/types";
import styles from "./goals.module.css";

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }));

function minorToAmount(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

/** Shared submit plumbing for the four goal dialogs: one in-flight action at a
 * time, refresh-then-close on success, and a close that ignores clicks while
 * a save is running (the CommitmentDialog pattern). */
function useDialogSubmit(onClose: () => void) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(task: () => Promise<GoalsResult>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.success) { setError(result.error); return; }
        router.refresh();
        onClose();
      } catch { setError("We couldn't save your changes. Please try again."); }
      finally { busy.current = false; }
    });
  }
  return { pending, error, setError, run, close: () => { if (!busy.current) onClose(); } };
}

export function NewGoalDialog({ primaryCurrency, onClose }: { primaryCurrency: string; onClose: () => void }) {
  const id = useId();
  const { pending, error, setError, run, close } = useDialogSubmit(onClose);
  const [form, setForm] = useState({ title: "", target: "", saved: "", currency: primaryCurrency, deadline: "", icon: "piggy-bank" });
  const [showIcons, setShowIcons] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title: form.title, target: form.target, saved: form.saved || undefined,
      currency: form.currency, deadline: form.deadline || undefined, icon: form.icon || undefined,
    };
    const checked = createGoalInputSchema.safeParse(payload);
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Check the goal details."); return; }
    run(() => createGoal(payload));
  }

  return (
    <Modal title="New goal" onClose={close}>
      <form onSubmit={submit} className={styles.dialogStack}>
        <p className="modal-description">Set a target for something you need, then add to it as you set money aside.</p>
        <fieldset disabled={pending} className={styles.dialogStack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <label htmlFor={`${id}-title`} className={styles.field}>
            Name
            <input id={`${id}-title`} className={styles.input} maxLength={80} required autoFocus placeholder="Emergency fund, Japan trip, new laptop" value={form.title} onChange={(event) => update("title", event.target.value)} />
          </label>
          <div className={styles.formGrid}>
            <label htmlFor={`${id}-target`} className={styles.field}>
              Target amount
              <input id={`${id}-target`} className={styles.input} inputMode="decimal" required placeholder="0.00" value={form.target} onChange={(event) => update("target", event.target.value)} />
            </label>
            <div className={styles.field}>
              <span>Currency</span>
              <Select aria-label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(value) => update("currency", value)} disabled={pending} />
            </div>
          </div>
          <div className={styles.formGrid}>
            <label htmlFor={`${id}-saved`} className={styles.field}>
              Already saved (optional)
              <input id={`${id}-saved`} className={styles.input} inputMode="decimal" placeholder="0.00" value={form.saved} onChange={(event) => update("saved", event.target.value)} />
            </label>
            <label htmlFor={`${id}-deadline`} className={styles.field}>
              Deadline (optional)
              <input id={`${id}-deadline`} type="date" className={styles.input} value={form.deadline} onChange={(event) => update("deadline", event.target.value)} />
            </label>
          </div>
          <div>
            <button type="button" className={styles.iconToggle} aria-expanded={showIcons} onClick={() => setShowIcons(!showIcons)}>{showIcons ? "Hide icon choices" : "Choose an icon"}</button>
            {showIcons && <div style={{ marginTop: 12 }}><IconPicker value={form.icon} onChange={(value) => update("icon", value)} /></div>}
          </div>
        </fieldset>
        <p className={styles.disclaimer}>Goals are a savings tally. Adding money here never moves wallet balances or writes ledger entries.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Create goal"}</button>
      </form>
    </Modal>
  );
}

export function DepositDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const id = useId();
  const { pending, error, setError, run, close } = useDialogSubmit(onClose);
  const [amount, setAmount] = useState("");
  const remainingMinor = Math.max(goal.targetMinor - goal.savedMinor, 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { id: goal.id, amount, updatedAt: goal.updatedAt };
    const checked = depositToGoalInputSchema.safeParse(payload);
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Check the amount."); return; }
    run(() => depositToGoal(payload));
  }

  return (
    <Modal title="Add to goal" onClose={close}>
      <form onSubmit={submit} className={styles.dialogStack}>
        <p className="modal-description">Record money you have set aside for {goal.title}.</p>
        <p className={styles.summaryLine}>
          <strong>{formatMoney(goal.savedMinor, goal.currency)}</strong> of {formatMoney(goal.targetMinor, goal.currency)} saved so far.
          {remainingMinor > 0 ? ` ${formatMoney(remainingMinor, goal.currency)} to go.` : " Target reached."}
        </p>
        <fieldset disabled={pending} className={styles.dialogStack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <label htmlFor={`${id}-amount`} className={styles.field}>
            Amount ({goal.currency})
            <input id={`${id}-amount`} className={styles.input} inputMode="decimal" required autoFocus placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
        </fieldset>
        <p className={styles.disclaimer}>This updates the goal tally only. Move the actual money with a transfer or expense in your ledger.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Add to goal"}</button>
      </form>
    </Modal>
  );
}

export function NewWishDialog({ primaryCurrency, onClose }: { primaryCurrency: string; onClose: () => void }) {
  const id = useId();
  const { pending, error, setError, run, close } = useDialogSubmit(onClose);
  const [form, setForm] = useState({ name: "", price: "", url: "", note: "", icon: "sparkles" });
  const [showIcons, setShowIcons] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: form.name, price: form.price || undefined, url: form.url.trim() || undefined,
      note: form.note || undefined, icon: form.icon || undefined,
    };
    const checked = createWishInputSchema.safeParse(payload);
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Check the wish details."); return; }
    run(() => createWishlistItem(payload));
  }

  return (
    <Modal title="Add a wish" onClose={close}>
      <form onSubmit={submit} className={styles.dialogStack}>
        <p className="modal-description">Park a want here until you are ready to commit to it.</p>
        <fieldset disabled={pending} className={styles.dialogStack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <label htmlFor={`${id}-name`} className={styles.field}>
            Name
            <input id={`${id}-name`} className={styles.input} maxLength={80} required autoFocus placeholder="Camera, concert tickets, new chair" value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <div className={styles.formGrid}>
            <label htmlFor={`${id}-price`} className={styles.field}>
              Rough price in {primaryCurrency} (optional)
              <input id={`${id}-price`} className={styles.input} inputMode="decimal" placeholder="0.00" value={form.price} onChange={(event) => update("price", event.target.value)} />
            </label>
            <label htmlFor={`${id}-url`} className={styles.field}>
              Link (optional)
              <input id={`${id}-url`} type="url" className={styles.input} maxLength={300} placeholder="https://" value={form.url} onChange={(event) => update("url", event.target.value)} />
            </label>
          </div>
          <label htmlFor={`${id}-note`} className={styles.field}>
            Note (optional)
            <input id={`${id}-note`} className={styles.input} maxLength={300} placeholder="Why you want it, the model, the size" value={form.note} onChange={(event) => update("note", event.target.value)} />
          </label>
          <div>
            <button type="button" className={styles.iconToggle} aria-expanded={showIcons} onClick={() => setShowIcons(!showIcons)}>{showIcons ? "Hide icon choices" : "Choose an icon"}</button>
            {showIcons && <div style={{ marginTop: 12 }}><IconPicker value={form.icon} onChange={(value) => update("icon", value)} /></div>}
          </div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Add wish"}</button>
      </form>
    </Modal>
  );
}

export function ConvertWishDialog({ wish, primaryCurrency, onClose }: { wish: WishlistItem; primaryCurrency: string; onClose: () => void }) {
  const id = useId();
  const { pending, error, setError, run, close } = useDialogSubmit(onClose);
  const [form, setForm] = useState({
    target: wish.priceMinor !== null ? minorToAmount(wish.priceMinor) : "",
    currency: primaryCurrency, deadline: "",
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { id: wish.id, target: form.target, currency: form.currency, deadline: form.deadline || undefined };
    const checked = convertWishInputSchema.safeParse(payload);
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Check the goal details."); return; }
    run(() => convertWishToGoal(payload));
  }

  return (
    <Modal title="Make it a goal" onClose={close}>
      <form onSubmit={submit} className={styles.dialogStack}>
        <p className="modal-description">Committing to {wish.name}. Set the target you will save toward.</p>
        <fieldset disabled={pending} className={styles.dialogStack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className={styles.formGrid}>
            <label htmlFor={`${id}-target`} className={styles.field}>
              Target amount
              <input id={`${id}-target`} className={styles.input} inputMode="decimal" required autoFocus placeholder="0.00" value={form.target} onChange={(event) => update("target", event.target.value)} />
            </label>
            <div className={styles.field}>
              <span>Currency</span>
              <Select aria-label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(value) => update("currency", value)} disabled={pending} />
            </div>
          </div>
          <label htmlFor={`${id}-deadline`} className={styles.field}>
            Deadline (optional)
            <input id={`${id}-deadline`} type="date" className={styles.input} value={form.deadline} onChange={(event) => update("deadline", event.target.value)} />
          </label>
        </fieldset>
        <p className={styles.disclaimer}>The wish stays on your wishlist with a link to this goal. Delete the goal and the wish becomes convertible again.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Add to goals"}</button>
      </form>
    </Modal>
  );
}
