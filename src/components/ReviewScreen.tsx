"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMeal } from "@/src/lib/meals";
import type { MealDraft } from "@/src/lib/ai/types";
import {
  calcMacros,
  sumMacros,
  type ReviewItem,
} from "@/src/lib/nutrition";

interface Props {
  draft: MealDraft;
  initialRows: ReviewItem[];
  onBack: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function QualityBadge({ item }: { item: ReviewItem }) {
  if (!item.food) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-error-container text-on-error-container">
        <span className="material-symbols-outlined text-[12px]">help</span>
        <span>غير موجود</span>
      </span>
    );
  }
  if (item.food.source === "ai") {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary-container/15 text-secondary">
        <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
        <span>تقدير ذكي</span>
      </span>
    );
  }
  const verified =
    item.parsed.confidence === "high" && item.parsed.quantity.basis === "user_stated";
  return verified ? (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-fixed text-on-primary-fixed">
      <span className="material-symbols-outlined text-[12px]">check</span>
      <span>موثّق</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-tertiary-fixed text-on-tertiary-fixed">
      <span>≈</span>
      <span>تقديري</span>
    </span>
  );
}

export default function ReviewScreen({ draft, initialRows, onBack }: Props) {
  const [rows] = useState<ReviewItem[]>(initialRows);
  const [grams, setGrams] = useState<number[]>(() => rows.map((r) => r.grams));
  const [confirmed, setConfirmed] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveMeal(rows, grams);
      setSaved(true);
      router.push("/");
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "تعذّر حفظ الوجبة. حاول مرة أخرى.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  const setAt = (i: number, v: number) =>
    setGrams((g) => g.map((x, idx) => (idx === i ? Math.max(0, Math.min(5000, v)) : x)));

  const perItem = useMemo(
    () => rows.map((r, i) => calcMacros(r.food, grams[i])),
    [rows, grams],
  );
  const total = useMemo(() => sumMacros(perItem), [perItem]);

  const estimatedCount = rows.filter(
    (r) =>
      !r.food ||
      r.food.source === "ai" ||
      r.parsed.confidence !== "high" ||
      r.parsed.quantity.basis !== "user_stated",
  ).length;
  const estimatedPct = rows.length ? Math.round((estimatedCount / rows.length) * 100) : 0;
  const unmatched = rows.filter((r) => !r.food).length;
  const aiCount = rows.filter((r) => r.food?.source === "ai").length;

  return (
    <section className="flex flex-col gap-4 w-full" aria-labelledby="review-title">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-primary font-semibold text-[15px] active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[20px] rtl:rotate-180">arrow_back</span>
          <span>رجوع</span>
        </button>
        <h1 id="review-title" className="text-[20px] font-semibold text-on-surface">
          مراجعة الوجبة
        </h1>
        <span className="w-8" />
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed">
            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
            <span>مسودة ذكية</span>
          </span>
          <span className="text-[12px] text-on-surface-variant">رصد {rows.length} مكونات</span>
        </div>
        <h2 className="text-[17px] font-bold leading-tight text-on-surface">
          {draft.dish_name?.ar || draft.dish_name?.en || "وجبتك"}
        </h2>
        <p className="text-[12px] text-on-surface-variant">
          تحقق من أوزان المكونات والزيوت المضافة بالأسفل لضمان دقة السعرات.
        </p>
      </div>

      {(draft.global_warnings?.length > 0 || unmatched > 0) && (
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed text-[12px]">
          {draft.global_warnings?.map((w, i) => (
            <span key={i}>• {w}</span>
          ))}
          {unmatched > 0 && <span>• {unmatched} مكون لا توجد له قيم غذائية، لم تُحتسب سعراته.</span>}
        </div>
      )}

      {aiCount > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary-container/10 text-secondary text-[12px]">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          <span>
            {aiCount} مكون غير موجود في قاعدة بياناتنا، فاستخدمنا تقدير الذكاء الاصطناعي للقيم الغذائية. عدّل الجرامات للحصول على أدق نتيجة.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[15px] font-bold text-on-surface">المكونات المرصودة</span>
          <span className="text-[11px] text-on-surface-variant">قابلة للتعديل</span>
        </div>

        {rows.length === 0 && (
          <div className="p-4 rounded-2xl bg-surface-container-low text-[13px] text-on-surface-variant text-center">
            لم يتم التعرف على أي مكونات غذائية. جرّب وصفاً آخر.
          </div>
        )}

        {rows.map((r, i) => {
          const m = perItem[i];
          return (
            <div key={r.key} className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-[16px] font-bold text-on-surface">
                    {r.parsed.name_ar || r.parsed.name_en}
                  </span>
                  <QualityBadge item={r} />
                </div>
                <span className="text-[13px] text-on-surface-variant font-medium shrink-0">
                  {fmt(m.calories)} سعرة
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <span className="text-[13px] text-secondary font-semibold">
                  بروتين {fmt(m.protein)}g • كربوهيدرات {fmt(m.carbs)}g • دهون {fmt(m.fat)}g
                </span>
                <div className="flex items-center gap-1 bg-surface-container-low rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    aria-label="إنقاص"
                    onClick={() => setAt(i, grams[i] - 10)}
                    className="w-8 h-8 rounded-lg bg-surface text-on-surface flex items-center justify-center font-bold text-[18px] active:scale-90 shadow-sm"
                  >
                    −
                  </button>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      id={`grams-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={Number.isFinite(grams[i]) ? grams[i] : ""}
                      onChange={(e) => setAt(i, e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-14 text-center font-bold text-[16px] text-on-surface bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[12px] text-on-surface-variant pe-1">g</span>
                  </div>
                  <button
                    type="button"
                    aria-label="زيادة"
                    onClick={() => setAt(i, grams[i] + 10)}
                    className="w-8 h-8 rounded-lg bg-surface text-on-surface flex items-center justify-center font-bold text-[18px] active:scale-90 shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {r.parsed.quantity.grams_max > 0 && (
                <span className="text-[11px] text-outline">
                  تقدير الذكاء الاصطناعي: {fmt(r.parsed.quantity.grams_min)}–{fmt(r.parsed.quantity.grams_max)}g
                </span>
              )}
            </div>
          );
        })}
      </div>

      {draft.possible_hidden_items?.length > 0 && (
        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[20px]">visibility_off</span>
            <div>
              <h3 className="text-[15px] font-bold text-on-surface">مكونات مخفية محتملة</h3>
              <p className="text-[12px] text-on-surface-variant">
                الزيوت والصلصات الخفية تصنع فارقاً مهماً في السعرات الدقيقة.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {draft.possible_hidden_items.map((h, i) => (
              <li key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-surface text-[13px]">
                <span className="material-symbols-outlined text-tertiary-container text-[16px] mt-0.5">oil_barrel</span>
                <div className="flex flex-col" dir="auto">
                  <span className="font-semibold text-on-surface">{h.name_en}</span>
                  <span className="text-[12px] text-on-surface-variant">{h.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3.5 mt-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant block">الإجمالي المحسوب</span>
            <span id="total-calories" className="text-[22px] leading-7 font-bold text-on-surface">
              {fmt(total.calories)} سعرة حرارية
            </span>
          </div>
          {estimatedPct > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium bg-tertiary-fixed text-on-tertiary-fixed">
              <span>≈</span>
              <span>{estimatedPct}% تقديري</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <span className="font-semibold text-secondary">بروتين {fmt(total.protein)}g</span>
          <span>•</span>
          <span className="font-semibold text-tertiary">كربوهيدرات {fmt(total.carbs)}g</span>
          <span>•</span>
          <span className="font-semibold text-primary">دهون {fmt(total.fat)}g</span>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer text-[13px] text-on-surface">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
          />
          <span>أؤكد صحة المكونات والتقديرات المحسوبة</span>
        </label>

        {saveError && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[13px]">{saveError}</div>
        )}

        <button
          id="save-meal-btn"
          type="button"
          disabled={!confirmed || rows.length === 0 || saved || saving}
          onClick={handleSave}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{saving ? "جارٍ الحفظ..." : saved ? "تم الحفظ" : "حفظ الوجبة في سجل اليوم"}</span>
        </button>
      </div>
    </section>
  );
}
