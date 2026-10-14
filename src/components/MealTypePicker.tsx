"use client";

import { MEAL_TYPES, type MealType } from "@/src/lib/meals";

interface Props {
  value: MealType;
  onChange: (v: MealType) => void;
  disabled?: boolean;
}

/** Arabic pill selector: فطور / غداء / عشاء / سناك. */
export default function MealTypePicker({ value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="نوع الوجبة" className="grid grid-cols-4 gap-2">
      {MEAL_TYPES.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`meal-type-${t.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(t.value)}
            className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
              active
                ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
