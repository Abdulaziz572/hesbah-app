"use client";

import { useEffect, useMemo, useState } from "react";
import {
  copyMealToDate,
  deleteMeal,
  isMealType,
  localDateString,
  updateMeal,
  type DiaryMeal,
  type MealType,
} from "@/src/lib/meals";
import { sumMacros, type Macros } from "@/src/lib/nutrition";
import MealTypePicker from "./MealTypePicker";
import MealItemsEditor, { type MealEditorItem } from "./MealItemsEditor";

interface Props {
  meal: DiaryMeal;
  /** Whether the meal is from a past date. If omitted, checks meal.localDate vs today. */
  isPastDate?: boolean;
  onClose: () => void;
  /** Called after a successful save or delete; the sheet stays in its saving state until resolved. */
  onSaved: () => void | Promise<void>;
  /** Called after the meal was copied to today's diary (sheet should close and show today). */
  onCopied?: () => void | Promise<void>;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDec = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function EditMealSheet({ meal, isPastDate, onClose, onSaved, onCopied }: Props) {
  const [title, setTitle] = useState(meal.title ?? "");
  const [note, setNote] = useState(meal.customNote ?? "");
  const [bookmarked, setBookmarked] = useState(!!meal.isSaved);
  const [copying, setCopying] = useState(false);

  const showCopy = isPastDate !== undefined ? isPastDate : meal.localDate !== localDateString();
  const [mealType, setMealType] = useState<MealType>(
    isMealType(meal.mealType) ? meal.mealType : "snack",
  );

  // Initialize items using MealEditorItem
  const [items, setItems] = useState<MealEditorItem[]>(() =>
    meal.items.map((it) => {
      const g = it.grams || 100;
      const f = g / 100;
      const p100 = it.per100g ?? {
        calories: Math.round(it.calories / f),
        protein: Math.round((it.protein / f) * 10) / 10,
        carbs: Math.round((it.carbs / f) * 10) / 10,
        fat: Math.round((it.fat / f) * 10) / 10,
      };

      return {
        id: it.id,
        name: it.name,
        grams: it.grams,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        per100g: p100,
      };
    }),
  );

  // Manual total override state
  const [isManualTotal, setIsManualTotal] = useState(false);
  const [manualTotals, setManualTotals] = useState<Macros>(() => ({
    calories: Math.round(meal.totals?.calories ?? 0),
    protein: Math.round((meal.totals?.protein ?? 0) * 10) / 10,
    carbs: Math.round((meal.totals?.carbs ?? 0) * 10) / 10,
    fat: Math.round((meal.totals?.fat ?? 0) * 10) / 10,
  }));

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes sheet when not saving/deleting
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !deleting && !copying) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [saving, deleting, copying, onClose]);

  // Derived sum of items
  const itemsTotal = useMemo(
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

  // Active totals depending on manual override
  const displayedTotals = isManualTotal ? manualTotals : itemsTotal;

  // Toggle manual total override
  function toggleManualTotals() {
    if (!isManualTotal) {
      // Sync manual total with current items total when opening
      setManualTotals({
        calories: itemsTotal.calories,
        protein: itemsTotal.protein,
        carbs: itemsTotal.carbs,
        fat: itemsTotal.fat,
      });
      setIsManualTotal(true);
    } else {
      setIsManualTotal(false);
    }
  }

  // Save changes handler
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMeal(meal.id, {
        title,
        meal_type: mealType,
        items: items.map((it) => ({
          id: it.id.startsWith("added-") || it.id.startsWith("manual-") ? undefined : it.id,
          name: it.name,
          grams: it.grams,
          per100g: it.per100g,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
        })),
        totals: isManualTotal ? manualTotals : undefined,
        customNote: note.trim() !== (meal.customNote ?? "") ? note.trim() : undefined,
        isSaved: bookmarked !== !!meal.isSaved ? bookmarked : undefined,
      });
      await onSaved();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "تعذّر حفظ التعديلات. حاول مرة أخرى.");
      setSaving(false);
    }
  }

  // Delete meal handler
  async function handleDeleteMeal() {
    setDeleting(true);
    setError(null);
    try {
      await deleteMeal(meal.id);
      await onSaved();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "تعذّر حذف الوجبة. حاول مرة أخرى.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // Copy this meal (any past day) into today's diary without calling the AI
  async function handleCopyToToday() {
    setCopying(true);
    setError(null);
    try {
      await copyMealToDate({ ...meal, customNote: note.trim() || null });
      await (onCopied ?? onSaved)();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "تعذّر نسخ الوجبة. حاول مرة أخرى.");
      setCopying(false);
    }
  }

  const isBusy = saving || deleting || copying;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="إغلاق"
        tabIndex={-1}
        onClick={() => !isBusy && onClose()}
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
      />

      {/* Sheet content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-meal-title"
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-surface rounded-t-[28px] shadow-2xl flex flex-col gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] z-10"
      >
        {/* Drag handle & Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-1 rounded-full bg-outline-variant/50" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
              </span>
              <div>
                <h2 id="edit-meal-title" className="text-[18px] font-bold text-on-surface">
                  تعديل الوجبة المسجلة
                </h2>
                <span className="text-[11px] text-on-surface-variant block">
                  يمكنك تعديل المكونات، نوع الوجبة، أو الإجماليات
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              aria-label="إغلاق"
              className={`w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Meal Type & Title card */}
        <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm border border-outline-variant/20 flex flex-col gap-3">
          <span className="text-[13px] font-bold text-on-surface">نوع الوجبة</span>
          <MealTypePicker value={mealType} onChange={setMealType} disabled={isBusy} />

          <div className="flex flex-col gap-1 pt-1">
            <label htmlFor="edit-meal-title-input" className="text-[13px] font-bold text-on-surface">
              عنوان الوجبة (اختياري)
            </label>
            <input
              id="edit-meal-title-input"
              type="text"
              dir="rtl"
              value={title}
              maxLength={120}
              disabled={isBusy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: غداء العمل، فطور خفيف..."
              className={`h-11 rounded-xl bg-surface-container-low px-3 text-[15px] text-on-surface placeholder:text-outline border border-transparent outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 transition-all ${focusRing}`}
            />
          </div>
        </div>

        {/* Personal note + bookmark */}
        <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm border border-outline-variant/20 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-meal-note" className="text-[13px] font-bold text-on-surface">
              وصف خاص للوجبة (اختياري)
            </label>
            <textarea
              id="edit-meal-note"
              dir="rtl"
              rows={2}
              maxLength={500}
              value={note}
              disabled={isBusy}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: غداء الدوام المعتاد…"
              className={`w-full resize-none rounded-xl bg-surface-container-low p-3 text-[15px] leading-6 text-on-surface placeholder:text-outline border border-transparent outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${focusRing}`}
            />
          </div>
          <button
            id="edit-bookmark-toggle"
            type="button"
            role="switch"
            aria-checked={bookmarked}
            disabled={isBusy}
            onClick={() => setBookmarked((b) => !b)}
            className={`min-h-[44px] flex items-center justify-between gap-3 text-start rounded-xl ${focusRing}`}
          >
            <span className="flex items-center gap-2 text-[13px] text-on-surface">
              <span
                className={`material-symbols-outlined text-[22px] ${bookmarked ? "text-primary" : "text-outline"}`}
                style={{ fontVariationSettings: `"FILL" ${bookmarked ? 1 : 0}` }}
                aria-hidden
              >
                bookmark
              </span>
              حفظ كقالب في «وجباتي السابقة»
            </span>
            <span
              aria-hidden
              className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${bookmarked ? "bg-primary" : "bg-surface-container-highest"}`}
            >
              <span
                className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${bookmarked ? "ltr:translate-x-5 rtl:-translate-x-5" : ""}`}
              />
            </span>
          </button>
        </div>

        {/* Meal Items Section with Reusable MealItemsEditor */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-on-surface">مكونات الوجبة</span>
              <span className="text-[12px] text-on-surface-variant">({items.length})</span>
            </div>
            <span className="text-[11px] text-on-surface-variant">عدّل بالذكاء الاصطناعي أو يدوياً</span>
          </div>

          <MealItemsEditor items={items} onChange={setItems} disabled={isBusy} />
        </div>

        {/* Quick Manual Total Override Section */}
        <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm border border-outline-variant/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
              <span className="text-[13px] font-bold text-on-surface">
                تعديل إجمالي السعرات والماكروز يدوياً
              </span>
            </div>
            <button
              type="button"
              onClick={toggleManualTotals}
              disabled={isBusy}
              className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
                isManualTotal
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:text-primary"
              } ${focusRing}`}
            >
              {isManualTotal ? "مفعّل ✓" : "تفعيل التعديل اليدوي"}
            </button>
          </div>

          {isManualTotal ? (
            <div className="flex flex-col gap-3 pt-1 border-t border-outline-variant/20">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                عند تفعيل هذا الخيار، سيتم اعتماد هذه الأرقام كإجمالي للوجبة بدلاً من مجموع الأصناف الفردية:
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="manual-total-cal" className="text-[12px] font-semibold text-on-surface-variant">
                    إجمالي السعرات (kcal)
                  </label>
                  <input
                    id="manual-total-cal"
                    type="number"
                    min={0}
                    max={10000}
                    disabled={isBusy}
                    value={manualTotals.calories}
                    onChange={(e) =>
                      setManualTotals({ ...manualTotals, calories: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className={`h-10 rounded-xl bg-surface-container-low px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="manual-total-p" className="text-[12px] font-semibold text-secondary">
                    بروتين (g)
                  </label>
                  <input
                    id="manual-total-p"
                    type="number"
                    step="0.1"
                    min={0}
                    max={1000}
                    disabled={isBusy}
                    value={manualTotals.protein}
                    onChange={(e) =>
                      setManualTotals({ ...manualTotals, protein: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className={`h-10 rounded-xl bg-surface-container-low px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="manual-total-c" className="text-[12px] font-semibold text-tertiary">
                    كربوهيدرات (g)
                  </label>
                  <input
                    id="manual-total-c"
                    type="number"
                    step="0.1"
                    min={0}
                    max={1000}
                    disabled={isBusy}
                    value={manualTotals.carbs}
                    onChange={(e) =>
                      setManualTotals({ ...manualTotals, carbs: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className={`h-10 rounded-xl bg-surface-container-low px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="manual-total-f" className="text-[12px] font-semibold text-primary">
                    دهون (g)
                  </label>
                  <input
                    id="manual-total-f"
                    type="number"
                    step="0.1"
                    min={0}
                    max={1000}
                    disabled={isBusy}
                    value={manualTotals.fat}
                    onChange={(e) =>
                      setManualTotals({ ...manualTotals, fat: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className={`h-10 rounded-xl bg-surface-container-low px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsManualTotal(false)}
                className="text-[11px] text-primary underline self-start pt-0.5"
              >
                العودة للاحتساب التلقائي من الأصناف
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-on-surface-variant">
              يتم الحساب تلقائياً من مجموع مكونات الوجبة أعلاه.
            </span>
          )}
        </div>

        {/* Total Summary Card */}
        <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm border border-outline-variant/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-variant">
                {isManualTotal ? "الإجمالي المعدّل يدوياً" : "الإجمالي المحسوب للوجبة"}
              </span>
              <span className="text-[22px] leading-7 font-bold text-on-surface tabular-nums">
                {fmt(displayedTotals.calories)} سعرة حرارية
              </span>
            </div>

            {isManualTotal && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed">
                تعديل إجمالي
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <span className="text-secondary">بروتين {fmtDec(displayedTotals.protein)}g</span>
            <span className="text-outline-variant">•</span>
            <span className="text-tertiary">كربوهيدرات {fmtDec(displayedTotals.carbs)}g</span>
            <span className="text-outline-variant">•</span>
            <span className="text-primary">دهون {fmtDec(displayedTotals.fat)}g</span>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-error-container text-on-error-container text-[13px]">
              {error}
            </div>
          )}

          {/* Delete confirmation block or action buttons */}
          {showDeleteConfirm ? (
            <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/20 flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-error text-[20px] mt-0.5">warning</span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-on-surface">حذف الوجبة نهائياً؟</span>
                  <span className="text-[11px] text-on-surface-variant">
                    سيتم حذف هذه الوجبة وجميع مكوناتها من يومياتك ولن يمكنك التراجع.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 h-10 rounded-xl bg-surface-container-low text-on-surface-variant text-[13px] font-semibold active:scale-95 transition-transform disabled:opacity-50"
                >
                  تراجع
                </button>
                <button
                  id="confirm-delete-in-sheet-btn"
                  type="button"
                  onClick={handleDeleteMeal}
                  disabled={deleting}
                  className="flex-1 h-10 rounded-xl bg-error text-on-error text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-md shadow-error/20 active:scale-95 transition-all disabled:opacity-60"
                >
                  {deleting ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      <span>جارٍ الحذف...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>نعم، احذف الوجبة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {/* Save changes button */}
              <button
                id="save-edit-btn"
                type="button"
                onClick={handleSave}
                disabled={isBusy || (!isManualTotal && items.length === 0)}
                className={`w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none ${focusRing}`}
              >
                {saving ? (
                  <>
                    <span
                      className="w-5 h-5 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
                      aria-hidden
                    />
                    <span>جارٍ حفظ التعديلات...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span>حفظ التعديلات</span>
                  </>
                )}
              </button>

              {/* Copy to today's diary (no AI) - only shown for past days */}
              {showCopy && (
                <button
                  id="copy-to-today-btn"
                  type="button"
                  onClick={handleCopyToToday}
                  disabled={isBusy || items.length === 0}
                  className={`w-full h-12 rounded-xl bg-primary-fixed text-on-primary-fixed font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 ${focusRing}`}
                >
                  {copying ? (
                    <>
                      <span
                        className="w-5 h-5 rounded-full border-2 border-on-primary-fixed/30 border-t-on-primary-fixed animate-spin"
                        aria-hidden
                      />
                      <span>جارٍ النسخ...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]" aria-hidden>
                        content_copy
                      </span>
                      <span>نسخ وإضافة لليوم الحالي</span>
                    </>
                  )}
                </button>
              )}

              {/* Delete meal button */}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isBusy}
                className={`w-full h-10 rounded-xl text-error hover:bg-error-container/20 text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-colors disabled:opacity-50 ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>حذف هذه الوجبة بالكامل</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
