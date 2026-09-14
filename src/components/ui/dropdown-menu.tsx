"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  triggerLabel: string;
  items: DropdownMenuItem[];
  align?: "start" | "end";
}

/**
 * The menu (action list) pattern, distinct from Select's listbox (bound
 * value) pattern: items trigger side effects rather than setting a value,
 * so this uses role="menu"/"menuitem" instead of role="listbox"/"option".
 * Hand-rolled for the same reason as Select - no UI library dependency yet.
 */
export function DropdownMenu({ trigger, triggerLabel, items, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const enabledCount = items.length;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function openMenu(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
    setActiveIndex(items.findIndex((item) => !item.disabled));
    setOpen(true);
  }

  function toggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    if (open) setOpen(false);
    else openMenu(event);
  }

  function commit(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    setOpen(false);
    item.onSelect();
  }

  function handleListKeyDown(event: React.KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => {
        for (let next = index + 1; next < enabledCount; next += 1) if (!items[next].disabled) return next;
        return index;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => {
        for (let next = index - 1; next >= 0; next -= 1) if (!items[next].disabled) return next;
        return index;
      });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} onClick={(event) => event.stopPropagation()} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={toggleMenu}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") openMenu(event); }}
        className="menu-trigger"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          role="menu"
          tabIndex={-1}
          aria-label={triggerLabel}
          id={`${instanceId}-menu`}
          className={`select-menu menu-panel ${align === "end" ? "menu-panel-end" : ""}`}
          onKeyDown={handleListKeyDown}
          autoFocus
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`select-option ${index === activeIndex ? "select-option-active" : ""} ${item.destructive ? "menu-option-destructive" : ""}`}
              onMouseEnter={() => !item.disabled && setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              {item.icon}
              <span className="select-option-label">{item.label}</span>
              {item.trailing}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
