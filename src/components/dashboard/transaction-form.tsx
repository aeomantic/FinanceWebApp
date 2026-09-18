"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Wallet as WalletIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { Select } from "@/components/ui/select";
import { createCategory, recordTransaction, updateTransaction } from "@/app/dashboard/actions";
import type { Category, Transaction, Wallet } from "@/lib/dashboard/types";

/** amount_minor back to the decimal text the amount input expects. */
function minorToAmount(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export interface TransactionFormProps {
  action: "expense" | "income" | "transfer";
  /** The source wallet: fixed when recording, the starting selection when editing. */
  wallet: Wallet;
  wallets: Wallet[];
  categories: Category[];
  today: string;
  demo: boolean;
  /** Edit mode: prefill from this transaction and save through updateTransaction. */
  existing?: Transaction;
  onCategoryCreated: (category: Category) => void;
  onSaved: () => void;
}

export function TransactionForm({ action, wallet, wallets, categories, today, demo, existing, onCategoryCreated, onSaved }: TransactionFormProps) {
  const [error, setError] = useState("");
  const [sourceWalletId, setSourceWalletId] = useState(wallet.id);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [destinationWalletId, setDestinationWalletId] = useState(
    existing?.destinationWalletId ?? wallets.find((item) => item.id !== wallet.id)?.id ?? "",
  );
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [pending, startTransition] = useTransition();
  const sourceWallet = wallets.find((item) => item.id === sourceWalletId) ?? wallet;
  const otherWallets = wallets.filter((item) => item.id !== sourceWallet.id);
  const relevantCategories = categories.filter((category) => category.type === (action === "income" ? "income" : "expense"));
  const formId = useId();

  function changeSourceWallet(nextId: string) {
    setSourceWalletId(nextId);
    if (destinationWalletId === nextId) {
      setDestinationWalletId(wallets.find((item) => item.id !== nextId)?.id ?? "");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || demo) return;
    const form = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const payload = {
          walletId: sourceWallet.id,
          destinationWalletId: action === "transfer" ? destinationWalletId : undefined,
          categoryId: action !== "transfer" && categoryId ? categoryId : undefined,
          amount: String(form.get("amount") ?? ""),
          date: String(form.get("date") ?? ""),
          type: action,
          note: String(form.get("note") ?? "").trim() || undefined,
        };
        const result = existing
          ? await updateTransaction({ ...payload, id: existing.id })
          : await recordTransaction(payload);
        if (!result.success) setError(result.error ?? "Could not save this transaction. Please try again.");
        else onSaved();
      } catch { setError("Could not connect. Please try again."); }
    });
  }

  return <form className="transaction-form" onSubmit={submit}>
    <p className="modal-description">
      {existing
        ? "Correct the details below. Wallet balances recalculate automatically when you save."
        : action === "expense" ? `Record money spent from ${sourceWallet.name}.` : action === "income" ? `Record money received into ${sourceWallet.name}.` : `Move money from ${sourceWallet.name} to another wallet.`}
      {" "}This records activity and does not move real money.
    </p>
    {demo && <p className="form-information">This is a preview. <Link href="/login">Sign in</Link> to record your own transactions.</p>}

    {existing && (
      <label>{action === "transfer" ? "From wallet" : "Wallet"}
        <Select
          aria-label={action === "transfer" ? "From wallet" : "Wallet"}
          value={sourceWallet.id}
          onChange={changeSourceWallet}
          disabled={pending}
          options={wallets.map((item) => ({ value: item.id, label: `${item.name} (${item.currency})`, icon: <WalletIcon size={16} /> }))}
        />
      </label>
    )}

    {action === "transfer" ? (
      otherWallets.length === 0 ? (
        <p className="form-information">You need at least one other wallet to transfer money. Add a wallet first.</p>
      ) : (
        <label>To wallet
          <Select
            aria-label="To wallet"
            value={destinationWalletId}
            onChange={setDestinationWalletId}
            disabled={pending}
            options={otherWallets.map((item) => ({ value: item.id, label: `${item.name} (${item.currency})`, icon: <WalletIcon size={16} /> }))}
          />
        </label>
      )
    ) : (
      <label>Category
        <Select
          aria-label="Category"
          value={categoryId}
          onChange={setCategoryId}
          disabled={pending}
          placeholder="No category"
          options={[
            { value: "", label: "No category", icon: <CategoryIcon name={null} size={16} /> },
            ...relevantCategories.map((category) => ({ value: category.id, label: category.name, icon: <CategoryIcon name={category.icon} size={16} /> })),
          ]}
          onCreateNew={() => setShowNewCategory(true)}
          createNewLabel="New category"
        />
      </label>
    )}

    {showNewCategory && (
      <NewCategoryFields
        type={action === "income" ? "income" : "expense"}
        onCreated={(category) => { onCategoryCreated(category); setCategoryId(category.id); setShowNewCategory(false); }}
        onCancel={() => setShowNewCategory(false)}
      />
    )}

    <div className="form-columns">
      <label>Amount ({sourceWallet.currency})<input name="amount" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="0.00" defaultValue={existing ? minorToAmount(existing.amountMinor) : undefined} required maxLength={14} disabled={pending} /></label>
      <label>Date<input name="date" type="date" defaultValue={existing?.date ?? today} max={today} required disabled={pending} /></label>
    </div>
    <label htmlFor={`${formId}-note`}>Note (optional)<input id={`${formId}-note`} name="note" placeholder="e.g. Coffee with a friend" defaultValue={existing?.note ?? ""} maxLength={120} disabled={pending} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={pending || demo || (action === "transfer" && otherWallets.length === 0)}>{pending ? "Saving..." : existing ? "Save changes" : "Save transaction"}<Icon name="arrow-right" size={18} /></button>
  </form>;
}

function NewCategoryFields({ type, onCreated, onCancel }: { type: "expense" | "income"; onCreated: (category: Category) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(type === "income" ? "briefcase" : "tag");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // This renders inside the transaction form's own <form>, so it cannot be
  // a nested <form> itself (invalid HTML) or a type="submit" button (which
  // would submit the outer form). Plain buttons with a click handler instead.
  async function handleCreate() {
    if (pending || !name.trim()) return;
    setPending(true);
    setError("");
    const result = await createCategory({ name, type, icon });
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    onCreated(result.category);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "12px 0 0", padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-muted)" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12, fontWeight: 500 }}>
        New {type} category
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="e.g. Dining Out" disabled={pending} style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, fontSize: 13 }} />
      </label>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>Icon</p>
      <IconPicker value={icon} onChange={setIcon} aria-label="Choose a category icon" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={pending} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12 }}>Cancel</button>
        <button type="button" onClick={handleCreate} disabled={pending || !name.trim()} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: 0, background: "#141414", color: "#fff", fontSize: 12 }}>{pending ? "Adding..." : "Add category"}</button>
      </div>
    </div>
  );
}
