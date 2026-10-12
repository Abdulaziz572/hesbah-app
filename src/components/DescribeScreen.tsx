"use client";

import { useState } from "react";

const EXAMPLE = "أكلت نص حبة دجاج شواية مع صحن رز بخاري صغير، وشربت بيبسي دايت";

interface Props {
  onAnalyze: (text: string) => void | Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function DescribeScreen({ onAnalyze, loading, error }: Props) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && !loading;

  return (
    <section className="flex flex-col gap-4 w-full" aria-labelledby="describe-title">
      <div className="flex flex-col gap-1 px-1">
        <h1 id="describe-title" className="text-[28px] leading-[34px] font-bold text-on-surface">
          اكتب أو أملِ
        </h1>
        <p className="text-[13px] text-on-surface-variant">
          تحدث بالعامية أو اكتب مكونات وجبتك بحرية، وسنحلّلها لك.
        </p>
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-md shadow-secondary/20">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </div>
          <span className="text-[15px] font-bold text-on-surface">ماذا أكلت؟</span>
        </div>

        <textarea
          id="meal-text"
          dir="rtl"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          rows={5}
          placeholder="مثال: أكلت صحن كبسة دجاج وشربت قهوة عربية…"
          className="w-full resize-none rounded-xl bg-surface-container-low p-3 text-[16px] leading-6 text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => setText(EXAMPLE)}
          disabled={loading}
          className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary-container/10 text-secondary text-[12px] font-medium active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[14px]">lightbulb</span>
          <span>جرّب مثالاً</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-error-container text-on-error-container text-[13px]"
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      <button
        id="analyze-btn"
        type="button"
        onClick={() => onAnalyze(text.trim())}
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
      >
        {loading ? (
          <>
            <span
              className="w-5 h-5 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
              aria-hidden
            />
            <span>جاري التحليل…</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            <span>Analyze · حلّل الوجبة</span>
          </>
        )}
      </button>
    </section>
  );
}
