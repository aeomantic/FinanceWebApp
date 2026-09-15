"use client";

import { CATEGORY_ICON_GROUPS, CategoryIcon } from "./category-icon";

export interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  "aria-label"?: string;
}

/** A compact grouped icon grid for choosing a category icon, matching the
 * kebab-case keys CategoryIcon already renders elsewhere. */
export function IconPicker({ value, onChange, "aria-label": ariaLabel = "Choose an icon" }: IconPickerProps) {
  return (
    <div className="icon-picker" role="group" aria-label={ariaLabel}>
      {CATEGORY_ICON_GROUPS.map((group) => (
        <div key={group.label} className="icon-picker-group">
          <p className="icon-picker-label">{group.label}</p>
          <div className="icon-picker-grid">
            {group.icons.map((icon) => {
              const active = icon === value;
              return (
                <button
                  key={icon}
                  type="button"
                  className={`icon-picker-button ${active ? "icon-picker-button-active" : ""}`}
                  aria-pressed={active}
                  aria-label={icon.replace(/-/g, " ")}
                  onClick={() => onChange(icon)}
                >
                  <CategoryIcon name={icon} size={17} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
