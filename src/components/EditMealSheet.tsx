"use client";

import { useEffect, useMemo, useState } from "react";
import { isMealType, updateMeal, type DiaryMeal, type MealType } from "@/src/lib/meals";
import { sumMacros } from "@/src/lib/nutrition";
import MealTypePicker from "./MealTypePicker";
import GramsStepper from "./GramsStepper";

interface Props {
  meal: DiaryMeal;
  onClose: () => void;
  /** Called after a successful save; the sheet stays in its saving state until it resolves. */
  onSaved: () => void | Promise<void>;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

interface EditItem {
  id: string;
  name: string;
  grams: number;
  per100g: DiaryMeal["items"][number]["per100g"];
}

/** Bottom-sheet editor for a saved meal: title, category, item grams, remove items. */
export default function EditMealSheet({ meal, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(meal.title ?? "");
  const [mealType, setMealType] = useState<MealType>(
    isMealType(meal.mealType) ? meal.mealType : "snack",
  );
  const [items, setItems] = useState<EditItem[]>(() =>
    meal.items.map((it) => ({ id: it.id, name: it.name, grams: it.grams, per100g: it.per100g })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the sheet (unless a save is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [saving, onClose]);

  const perItem = useMemo(
    () =>
      items.map((it) => {
        const f = it.grams / 100;
        return {
          calories: it.per100g.calories * f,
          protein: it.per100g.protein * f,
          carbs: it.per100g.carbs * f,
          fat: it.per100g.fat * f,
        };
      }),
    [items],
  );
  const total = useMemo(() => sumMacros(perItem), [perItem]);

  const setGrams = (id: string, grams: number) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, grams } : it)));
  const removeItem = (id: string) => setItems((list) => list.filter((it) => it.id !== id));

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMeal(meal.id, {
        title,
        meal_type: mealType,
        items: items.map((it) => ({ id: it.id, grams: it.grams })),
      });
      await onSaved();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "تعذّر حفظ التعديلات. حاول مرة أخرى.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button
        type="button"
        aria-label="إغلاق"
        tabIndex={-1}
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-meal-title"
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface rounded-t-[28px] shadow-2xl flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-meal-title" className="text-[18px] font-bold text-on-surface">
            تعديل الوجبة
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-3">
          <span className="text-[13px] font-bold text-on-surface">نوع الوجبة</span>
          <MealTypePicker value={mealType} onChange={setMealType} disabled={saving} />
          <label htmlFor="edit-meal-title-input" className="text-[13px] font-bold text-on-surface pt-1">
            عنوان الوجبة
          </label>
          <input
            id="edit-meal-title-input"
            type="text"
            dir="rtl"
            value={title}
            maxLength={120}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="اختياري"
            className="h-11 rounded-xl bg-surface-container-low px-3 text-[16px] text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-bold text-on-surface px-1">المكونات</span>
          {items.length === 0 && (
            <div className="p-4 rounded-2xl bg-surface-container-low text-[13px] text-on-surface-variant text-center">
              أزلت كل المكونات. أغلق النافذة واحذف الوجبة بالكامل إن أردت.
            </div>
          )}
          {items.map((it, i) => (
            <div
              key={it.id}
              className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold text-on-surface min-w-0 truncate">{it.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] text-on-surface-variant font-medium">
                    {fmt(perItem[i].calories)} سعرة
                  </span>
                  <button
                    type="button"
                    aria-label={`حذف ${it.name}`}
                    onClick={() => removeItem(it.id)}
                    disabled={saving}
                    className="w-8 h-8 rounded-full text-on-surface-variant hover:bg-error-container hover:text-on-error-container flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-secondary font-semibold">
                  بروتين {fmt(perItem[i].protein)}g • كربوهيدرات {fmt(perItem[i].carbs)}g • دهون{" "}
                  {fmt(perItem[i].fat)}g
                </span>
                <GramsStepper
                  id={`edit-grams-${i}`}
                  value={it.grams}
                  onChange={(g) => setGrams(it.id, g)}
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-variant">الإجمالي الجديد</span>
            <span className="text-[20px] leading-7 font-bold text-on-surface">
              {fmt(total.calories)} سعرة حرارية
            </span>
            <span className="text-[12px] text-on-surface-variant pt-0.5">
              بروتين {fmt(total.protein)}g • كربوهيدرات {fmt(total.carbs)}g • دهون {fmt(total.fat)}g
            </span>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-error-container text-on-error-container text-[13px]">
              {error}
            </div>
          )}

          <button
            id="save-edit-btn"
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? (
              <>
                <span
                  className="w-5 h-5 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
                  aria-hidden
                />
                <span>جارٍ الحفظ...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
