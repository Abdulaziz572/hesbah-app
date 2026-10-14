"use client";

import { useState } from "react";

export const MAX_GRAMS = 5000;

interface Props {
  value: number;
  onChange: (grams: number) => void;
  id?: string;
  step?: number;
  disabled?: boolean;
}

/** − / + buttons plus a directly editable numeric field. */
export default function GramsStepper({ value, onChange, id, step = 10, disabled }: Props) {
  // While the field is focused we keep the raw text so users can clear it and retype.
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(MAX_GRAMS, n));

  return (
    <div className="flex items-center gap-1 bg-surface-container-low rounded-xl p-1 shrink-0">
      <button
        type="button"
        aria-label="إنقاص"
        disabled={disabled}
        onClick={() => onChange(clamp(value - step))}
        className="w-8 h-8 rounded-lg bg-surface text-on-surface flex items-center justify-center font-bold text-[18px] active:scale-90 shadow-sm disabled:opacity-50"
      >
        −
      </button>
      <div className="flex items-baseline gap-0.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_GRAMS}
          disabled={disabled}
          value={text ?? (Number.isFinite(value) ? String(value) : "")}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? clamp(n) : 0);
          }}
          onBlur={() => setText(null)}
          className="w-14 text-center font-bold text-[16px] text-on-surface bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[12px] text-on-surface-variant pe-1">g</span>
      </div>
      <button
        type="button"
        aria-label="زيادة"
        disabled={disabled}
        onClick={() => onChange(clamp(value + step))}
        className="w-8 h-8 rounded-lg bg-surface text-on-surface flex items-center justify-center font-bold text-[18px] active:scale-90 shadow-sm disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}
