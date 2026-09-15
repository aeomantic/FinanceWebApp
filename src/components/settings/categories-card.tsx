"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, Trash2 } from "lucide-react";
import { deleteCategory, updateCategory } from "@/app/settings/actions";
import { ConfirmationDialog } from "./confirmation-dialog";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import type { Category, CategoryType } from "@/lib/dashboard/types";
import styles from "./settings.module.css";

export function CategoriesCard({ categories, disabled = false }: { categories: Category[]; disabled?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<CategoryType>("expense");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const visible = categories.filter((category) => category.type === tab);

  return (
    <section className={styles.card} aria-labelledby="categories-title">
      <div className={styles.cardHeading}>
        <div><h2 id="categories-title">Categories</h2><p className={styles.description}>Manage spending and income categories and their icons.</p></div>
        <span className={styles.cardIcon}><Tags size={18} aria-hidden="true" /></span>
      </div>
      <div className={styles.tabs} role="group" aria-label="Category type">
        <button type="button" aria-pressed={tab === "expense"} onClick={() => setTab("expense")}>Expense categories</button>
        <button type="button" aria-pressed={tab === "income"} onClick={() => setTab("income")}>Income categories</button>
      </div>
      {visible.length === 0 ? (
        <p className={styles.empty}>No {tab} categories yet.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              disabled={disabled}
              onDelete={() => setDeleteTarget(category)}
              onSaved={() => router.refresh()}
            />
          ))}
        </ul>
      )}
      {deleteTarget && (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.name}?`}
          description={`Transactions already using ${deleteTarget.name} keep their history but show as uncategorized. This can't be undone.`}
          onConfirm={() => deleteCategory(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => { setDeleteTarget(null); router.refresh(); }}
        />
      )}
    </section>
  );
}

function CategoryRow({ category, disabled, onDelete, onSaved }: {
  category: Category;
  disabled: boolean;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const originalIcon = category.icon ?? "tag";
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(originalIcon);
  const [showIcons, setShowIcons] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dirty = name.trim() !== category.name || icon !== originalIcon;

  async function save() {
    if (pending || !dirty || !name.trim()) return;
    setPending(true);
    setError("");
    const result = await updateCategory({ categoryId: category.id, name, icon });
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setShowIcons(false);
    onSaved();
  }

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Change icon for ${category.name}`}
          aria-expanded={showIcons}
          onClick={() => setShowIcons((value) => !value)}
          disabled={disabled}
        >
          <CategoryIcon name={icon} size={17} />
        </button>
        <div className={styles.rowContent}>
          <input
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            disabled={disabled || pending}
            aria-label={`Category name for ${category.name}`}
          />
        </div>
      </div>
      {showIcons && (
        <div className={styles.iconWell}>
          <IconPicker value={icon} onChange={setIcon} aria-label={`Choose an icon for ${category.name}`} />
        </div>
      )}
      <div className={styles.actions}>
        {dirty && <button type="button" className={styles.textButton} onClick={save} disabled={pending || !name.trim()}>{pending ? "Saving..." : "Save"}</button>}
        <button type="button" className={styles.iconButton} aria-label={`Delete ${category.name}`} onClick={onDelete} disabled={disabled}>
          <Trash2 size={16} className={styles.dangerIcon} aria-hidden="true" />
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </li>
  );
}
