"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { guessMealType, isMealType, saveMealItems, type MealType, type PreviousMeal } from "@/src/lib/meals";
import type { MealDraft } from "@/src/lib/ai/types";
import { useAuth } from "@/src/context/AuthContext";
import { invalidateUserMeals } from "@/src/lib/queryKeys";
import {
  calcMacros,
  sumMacros,
  calculateItemMacros,
  normalizeMacroNutrients,
  type ReviewItem,
} from "@/src/lib/nutrition";
import MealTypePicker from "./MealTypePicker";
import MealItemsEditor, { type MealEditorItem } from "./MealItemsEditor";

interface Props {
  /** AI analysis result. Omitted when editing a previous meal. */
  draft?: MealDraft | null;
  initialRows?: ReviewItem[];
  /** A previous/saved meal to tweak before logging it (no AI involved). */
  template?: PreviousMeal | null;
  targetDate?: Date;
  onBack: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function ReviewScreen({ draft: draftProp, initialRows = [], template, targetDate, onBack }: Props) {
  // With a template there is no AI draft; every AI-only field below is optional-chained or guarded.
  const draft: MealDraft = draftProp ?? ({ items: [] } as unknown as MealDraft);
  const [items, setItems] = useState<MealEditorItem[]>(() =>
    template
      ? template.meal.items.map((it, i) => {
          const p100 = normalizeMacroNutrients(it.per100g);
          const derived = calculateItemMacros(p100, it.grams);
          return {
            id: `tpl-${i}-${it.id}`,
            name: it.name,
            grams: it.grams,
            per100g: p100,
            calories: derived.calories,
            protein: derived.protein_g,
            carbs: derived.carbs_g,
            fat: derived.fat_g,
          };
        })
      : initialRows.map((r, i) => {
      const p100 = normalizeMacroNutrients(r.food?.per100g);
      const derived = calculateItemMacros(p100, r.grams);

      let badge: MealEditorItem["badge"] = undefined;
      if (!r.food) {
        badge = { type: "unmatched", label: "غير موجود" };
      } else if (r.food.source === "ai") {
        badge = { type: "ai_estimate", label: "تقدير ذكي" };
      } else {
        badge = { type: "curated", label: "تقدير مرجعي" };
      }

      return {
        id: r.key || `item-${i}`,
        name: r.parsed.name_ar || r.parsed.name_en || r.food?.name_ar || r.food?.name_en || "صنف",
        grams: r.grams,
        per100g: p100,
        calories: derived.calories,
        protein: derived.protein_g,
        carbs: derived.carbs_g,
        fat: derived.fat_g,
        badge,
        originalFoodId: r.food && r.food.source === "db" ? r.food.id : null,
        reference_unit_g: r.food?.reference_unit_g ?? null,
        default_portion_g: r.food?.default_portion_g ?? null,
        portion_assumed: r.parsed.portion_assumed ?? false,
        category: r.food?.category ?? r.parsed.category,
      };
    }),
  );

  const [mealType, setMealType] = useState<MealType>(() =>
    template && isMealType(template.meal.mealType) ? template.meal.mealType : guessMealType(),
  );
  const [title, setTitle] = useState(() =>
    template ? (template.meal.title ?? "") : draft.dish_name?.ar || draft.dish_name?.en || "",
  );
  const [confirmed, setConfirmed] = useState(true);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState(() => template?.customNote ?? "");
  const [bookmark, setBookmark] = useState(() => !!template?.isSaved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveMealItems(
        items.map((it) => ({
          name: it.name,
          grams: it.grams,
          per100g: it.per100g,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          food_id: it.originalFoodId,
          quality: template ? "user_edit" : it.badge?.type === "verified" ? "db" : "ai_estimate",
        })),
        { mealType, title, targetDate, customNote: note, isSaved: bookmark },
      );
      setSaved(true);
      await invalidateUserMeals(queryClient, user?.id ?? "");
      router.push("/");
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "تعذّر حفظ الوجبة. حاول مرة أخرى.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  const total = useMemo(
    () =>
      sumMacros(
        items.map((it) => ({
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
        })),
      ),
    [items],
  );

  const estimatedCount = items.filter(
    (it) => it.badge?.type !== "verified",
  ).length;
  const estimatedPct = items.length ? Math.round((estimatedCount / items.length) * 100) : 0;
  const unmatched = items.filter((it) => it.badge?.type === "unmatched").length;
  const aiCount = items.filter((it) => it.badge?.type === "ai_estimate" || it.badge?.type === "ai_edited").length;

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
          {template ? "تعديل قبل الإضافة" : "مراجعة الوجبة"}
        </h1>
        <span className="w-8" />
      </div>

      {targetDate && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-secondary-container/15 text-secondary text-[13px] font-medium">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          <span>
            تسجيل الوجبة لتاريخ: {new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(targetDate)}
          </span>
        </div>
      )}

      <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-on-surface">نوع الوجبة</span>
        <MealTypePicker value={mealType} onChange={setMealType} disabled={saving} />
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed">
            <span className="material-symbols-outlined text-[13px]">{template ? "history" : "auto_awesome"}</span>
            <span>{template ? "من وجباتك السابقة" : "مسودة ذكية"}</span>
          </span>
          <span className="text-[12px] text-on-surface-variant">{template ? "" : "رصد "}{items.length} مكونات</span>
        </div>
        <label htmlFor="meal-title" className="sr-only">عنوان الوجبة</label>
        <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary/40">
          <input
            id="meal-title"
            type="text"
            dir="rtl"
            value={title}
            maxLength={120}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان الوجبة (مثال: غداء الشغل)"
            className="flex-1 min-w-0 h-11 bg-transparent outline-none text-[17px] font-bold text-on-surface placeholder:text-outline placeholder:font-normal"
          />
          <span className="material-symbols-outlined text-[18px] text-outline" aria-hidden>edit</span>
        </div>
        <p className="text-[12px] text-on-surface-variant pt-1">
          تحقق من أوزان المكونات والزيوت المضافة بالأسفل لضمان دقة السعرات.
        </p>
      </div>

      {draft.transcribed_or_detected_description_ar?.trim() && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-surface-container-low">
          <span className="material-symbols-outlined text-[20px] text-secondary mt-0.5">
            {draft.input_type === "voice" ? "graphic_eq" : draft.input_type === "photo" ? "image_search" : "visibility"}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold text-secondary">ما فهمناه من إدخالك</span>
            <p className="text-[13px] leading-5 text-on-surface">
              {draft.transcribed_or_detected_description_ar}
            </p>
          </div>
        </div>
      )}


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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[15px] font-bold text-on-surface">المكونات المرصودة</span>
          <span className="text-[11px] text-on-surface-variant">قابلة للتعديل والإضافة بالـ AI</span>
        </div>

        <MealItemsEditor items={items} onChange={setItems} disabled={saving} />
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

      <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="meal-note" className="text-[13px] font-bold text-on-surface">
            وصف خاص للوجبة (اختياري)
          </label>
          <textarea
            id="meal-note"
            dir="rtl"
            rows={2}
            maxLength={500}
            value={note}
            disabled={saving}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: وجبتي بعد النادي بعد يوم الأرجل…"
            className="w-full resize-none rounded-xl bg-surface-container-low p-3 text-[15px] leading-6 text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
        </div>
        <button
          id="bookmark-meal-toggle"
          type="button"
          role="switch"
          aria-checked={bookmark}
          disabled={saving}
          onClick={() => setBookmark((b) => !b)}
          className="min-h-[44px] flex items-center justify-between gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-xl"
        >
          <span className="flex items-center gap-2 text-[13px] text-on-surface">
            <span
              className={`material-symbols-outlined text-[22px] ${bookmark ? "text-primary" : "text-outline"}`}
              style={{ fontVariationSettings: `"FILL" ${bookmark ? 1 : 0}` }}
              aria-hidden
            >
              bookmark
            </span>
            حفظ كقالب لإعادة إضافتها لاحقاً
          </span>
          <span
            aria-hidden
            className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${bookmark ? "bg-primary" : "bg-surface-container-highest"}`}
          >
            <span
              className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${bookmark ? "ltr:translate-x-5 rtl:-translate-x-5" : ""}`}
            />
          </span>
        </button>
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3.5 mt-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant block">الإجمالي المحسوب</span>
            <span id="total-calories" className="text-[22px] leading-7 font-bold text-on-surface">
              {fmt(total.calories)} سعرة حرارية
            </span>
          </div>
          {estimatedPct > 0 && !template && (
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
          disabled={!confirmed || items.length === 0 || saved || saving}
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
