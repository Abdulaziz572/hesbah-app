"use client";

import { useEffect, useId, useState } from "react";
import type { Macros } from "@/src/lib/nutrition";
import type { ReparsedSingleItem } from "@/src/lib/ai/types";
import GramsStepper from "./GramsStepper";

export interface MealEditorItem {
  id: string;
  name: string;
  grams: number;
  per100g: Macros;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  badge?: {
    type: "verified" | "ai_estimate" | "unmatched" | "ai_edited" | "manual";
    label: string;
  };
  originalFoodId?: string | null;
}

interface Props {
  items: MealEditorItem[];
  onChange: (items: MealEditorItem[]) => void;
  disabled?: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDec = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function MealItemsEditor({ items, onChange, disabled }: Props) {
  const uid = useId();

  // State for AI single item fix popover
  const [aiFixItem, setAiFixItem] = useState<MealEditorItem | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // State for manual item edit dialog
  const [manualItem, setManualItem] = useState<MealEditorItem | null>(null);
  const [manualForm, setManualForm] = useState({
    name: "",
    grams: 100,
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 2,
  });

  // State for adding a new item dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<"ai" | "manual">("ai");
  const [addAiPrompt, setAddAiPrompt] = useState("");
  const [addAiLoading, setAddAiLoading] = useState(false);
  const [addAiError, setAddAiError] = useState<string | null>(null);
  const [addManualForm, setAddManualForm] = useState({
    name: "",
    grams: 100,
    calories: 150,
    protein: 5,
    carbs: 20,
    fat: 3,
  });

  // Highlight state for items updated by AI
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedId) return;
    const t = window.setTimeout(() => setHighlightedId(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlightedId]);

  // Grams update handler
  function updateGrams(id: string, newGrams: number) {
    const safeGrams = Math.max(0, Math.min(5000, newGrams));
    onChange(
      items.map((it) => {
        if (it.id !== id) return it;
        const f = safeGrams / 100;
        return {
          ...it,
          grams: safeGrams,
          calories: Math.round(it.per100g.calories * f),
          protein: Math.round(it.per100g.protein * f * 10) / 10,
          carbs: Math.round(it.per100g.carbs * f * 10) / 10,
          fat: Math.round(it.per100g.fat * f * 10) / 10,
        };
      }),
    );
  }

  // Delete item handler
  function removeItem(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }

  // Open AI fix popover
  function openAiFix(item: MealEditorItem) {
    setAiFixItem(item);
    setAiPrompt("");
    setAiError(null);
  }

  // Submit AI fix
  async function handleAiFixSubmit() {
    if (!aiFixItem || !aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reparse_item",
          prompt: aiPrompt.trim(),
          item: {
            name: aiFixItem.name,
            grams: aiFixItem.grams,
            calories: aiFixItem.calories,
            protein: aiFixItem.protein,
            carbs: aiFixItem.carbs,
            fat: aiFixItem.fat,
            per100g: aiFixItem.per100g,
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as ReparsedSingleItem | { error?: string };
      if (!res.ok || !data || "error" in data) {
        throw new Error((data as { error?: string })?.error || "تعذّر تعديل الصنف بالذكاء الاصطناعي");
      }

      const updated = data as ReparsedSingleItem;
      onChange(
        items.map((it) => {
          if (it.id !== aiFixItem.id) return it;
          return {
            ...it,
            name: updated.name_ar || updated.name_en || it.name,
            grams: updated.grams,
            per100g: updated.per100g,
            calories: updated.calories,
            protein: updated.protein,
            carbs: updated.carbs,
            fat: updated.fat,
            badge: { type: "ai_edited", label: "معدّل بالـ AI ✨" },
          };
        }),
      );

      setHighlightedId(aiFixItem.id);
      setAiFixItem(null);
    } catch (e: unknown) {
      console.error(e);
      setAiError(e instanceof Error ? e.message : "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي");
    } finally {
      setAiLoading(false);
    }
  }

  // Open manual edit
  function openManualEdit(item: MealEditorItem) {
    setManualItem(item);
    setManualForm({
      name: item.name,
      grams: item.grams,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    });
  }

  // Submit manual edit
  function handleManualSubmit() {
    if (!manualItem || !manualForm.name.trim()) return;
    const grams = Math.max(1, manualForm.grams);
    const calories = Math.max(0, manualForm.calories);
    const protein = Math.max(0, manualForm.protein);
    const carbs = Math.max(0, manualForm.carbs);
    const fat = Math.max(0, manualForm.fat);

    const factor = grams / 100;
    const per100g: Macros = {
      calories: Math.round(calories / factor),
      protein: Math.round((protein / factor) * 10) / 10,
      carbs: Math.round((carbs / factor) * 10) / 10,
      fat: Math.round((fat / factor) * 10) / 10,
    };

    onChange(
      items.map((it) => {
        if (it.id !== manualItem.id) return it;
        return {
          ...it,
          name: manualForm.name.trim(),
          grams,
          calories,
          protein,
          carbs,
          fat,
          per100g,
          badge: { type: "manual", label: "تعديل يدوي ✏️" },
        };
      }),
    );

    setManualItem(null);
  }

  // Add new item via AI
  async function handleAddAiSubmit() {
    if (!addAiPrompt.trim()) return;
    setAddAiLoading(true);
    setAddAiError(null);

    try {
      const res = await fetch("/api/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reparse_item",
          prompt: addAiPrompt.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as ReparsedSingleItem | { error?: string };
      if (!res.ok || !data || "error" in data) {
        throw new Error((data as { error?: string })?.error || "تعذّر تحليل الصنف الجديد بالذكاء الاصطناعي");
      }

      const newItem = data as ReparsedSingleItem;
      const createdItem: MealEditorItem = {
        id: `added-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newItem.name_ar || newItem.name_en || "صنف جديد",
        grams: newItem.grams,
        per100g: newItem.per100g,
        calories: newItem.calories,
        protein: newItem.protein,
        carbs: newItem.carbs,
        fat: newItem.fat,
        badge: { type: "ai_edited", label: "مضاف بالـ AI ✨" },
      };

      onChange([...items, createdItem]);
      setHighlightedId(createdItem.id);
      setShowAddDialog(false);
      setAddAiPrompt("");
    } catch (e: unknown) {
      console.error(e);
      setAddAiError(e instanceof Error ? e.message : "حدث خطأ أثناء إضافة الصنف");
    } finally {
      setAddAiLoading(false);
    }
  }

  // Add new item manually
  function handleAddManualSubmit() {
    if (!addManualForm.name.trim()) return;
    const grams = Math.max(1, addManualForm.grams);
    const calories = Math.max(0, addManualForm.calories);
    const protein = Math.max(0, addManualForm.protein);
    const carbs = Math.max(0, addManualForm.carbs);
    const fat = Math.max(0, addManualForm.fat);

    const factor = grams / 100;
    const per100g: Macros = {
      calories: Math.round(calories / factor),
      protein: Math.round((protein / factor) * 10) / 10,
      carbs: Math.round((carbs / factor) * 10) / 10,
      fat: Math.round((fat / factor) * 10) / 10,
    };

    const createdItem: MealEditorItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: addManualForm.name.trim(),
      grams,
      calories,
      protein,
      carbs,
      fat,
      per100g,
      badge: { type: "manual", label: "إدخال يدوي ✏️" },
    };

    onChange([...items, createdItem]);
    setHighlightedId(createdItem.id);
    setShowAddDialog(false);
    setAddManualForm({ name: "", grams: 100, calories: 150, protein: 5, carbs: 20, fat: 3 });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Items list */}
      {items.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-6 text-center border border-dashed border-outline-variant/40 flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-[36px] text-outline">playlist_remove</span>
          <span className="text-[14px] font-semibold text-on-surface">لا توجد مكونات في هذه الوجبة</span>
          <span className="text-[12px] text-on-surface-variant">
            يمكنك إضافة أصناف جديدة بالذكاء الاصطناعي أو إدخالها يدوياً
          </span>
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            disabled={disabled}
            className={`mt-2 h-10 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      ) : (
        items.map((it, idx) => {
          const isHighlighted = highlightedId === it.id;
          return (
            <div
              key={it.id}
              className={`bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm border transition-all duration-300 flex flex-col gap-2.5 ${
                isHighlighted
                  ? "border-primary ring-2 ring-primary/20 bg-primary-fixed/10"
                  : "border-outline-variant/25"
              }`}
            >
              {/* Top row: name, badge, and calories */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-bold text-on-surface truncate">{it.name}</span>
                    {it.badge && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          it.badge.type === "verified"
                            ? "bg-primary-fixed text-on-primary-fixed"
                            : it.badge.type === "ai_edited"
                            ? "bg-secondary-container/20 text-secondary"
                            : it.badge.type === "manual"
                            ? "bg-surface-container-high text-on-surface-variant"
                            : it.badge.type === "unmatched"
                            ? "bg-error-container text-on-error-container"
                            : "bg-tertiary-fixed text-on-tertiary-fixed"
                        }`}
                      >
                        {it.badge.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-secondary font-semibold">
                    بروتين {fmtDec(it.protein)}g • كربوهيدرات {fmtDec(it.carbs)}g • دهون {fmtDec(it.fat)}g
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[14px] font-bold text-on-surface tabular-nums">
                    {fmt(it.calories)} <span className="text-[11px] font-normal text-on-surface-variant">سعرة</span>
                  </span>
                </div>
              </div>

              {/* Bottom row: Stepper and Action buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/20">
                <div className="flex items-center gap-1">
                  {/* AI Fix button */}
                  <button
                    type="button"
                    onClick={() => openAiFix(it)}
                    disabled={disabled}
                    title="تعديل هذا المكون بالذكاء الاصطناعي"
                    className={`h-8 px-2.5 rounded-lg bg-secondary-container/15 hover:bg-secondary-container/25 text-secondary text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-transform ${focusRing}`}
                  >
                    <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                    <span>عدّل بالـ AI</span>
                  </button>

                  {/* Manual Edit button */}
                  <button
                    type="button"
                    onClick={() => openManualEdit(it)}
                    disabled={disabled}
                    title="تعديل هذا الصنف يدوياً"
                    className={`h-8 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-transform ${focusRing}`}
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span>
                    <span>تعديل يدوي</span>
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={disabled}
                    aria-label={`حذف ${it.name}`}
                    title="حذف هذا الصنف"
                    className={`w-8 h-8 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/40 flex items-center justify-center active:scale-90 transition-all ${focusRing}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>

                {/* Grams stepper */}
                <GramsStepper
                  id={`item-grams-${idx}`}
                  value={it.grams}
                  onChange={(g) => updateGrams(it.id, g)}
                  disabled={disabled}
                />
              </div>
            </div>
          );
        })
      )}

      {/* Add new item button */}
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          disabled={disabled}
          className={`h-11 rounded-2xl border-2 border-dashed border-outline-variant/40 hover:border-primary/50 text-primary hover:bg-primary-fixed/10 text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>إضافة صنف جديد للوجبة</span>
        </button>
      )}

      {/* ============================================================== */}
      {/* 1. Modal: AI Single-Item Fix                                   */}
      {/* ============================================================== */}
      {aiFixItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
          <div
            className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
            onClick={() => !aiLoading && setAiFixItem(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-ai-title`}
            className="relative w-full max-w-md bg-surface rounded-t-[28px] sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 z-10 animate-[toast-in_200ms_ease-out]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </span>
                <h3 id={`${uid}-ai-title`} className="text-[16px] font-bold text-on-surface">
                  تعديل المكون بالذكاء الاصطناعي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAiFixItem(null)}
                disabled={aiLoading}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant">المكون الحالي:</span>
              <span className="text-[14px] font-bold text-on-surface">
                {aiFixItem.name} • {fmt(aiFixItem.grams)}g ({fmt(aiFixItem.calories)} سعرة)
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-ai-input`} className="text-[13px] font-semibold text-on-surface">
                إيش التعديل المطلوب على هذا المكون؟
              </label>
              <textarea
                id={`${uid}-ai-input`}
                rows={3}
                value={aiPrompt}
                disabled={aiLoading}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="مثال: مشوي مو مقلي، أو مع ملعقة سمن، أو ٣ حبات سمبوسة لحم بالفرن..."
                className={`w-full rounded-xl bg-surface-container-lowest p-3 text-[14px] text-on-surface placeholder:text-outline border border-outline-variant/30 outline-none resize-none ${focusRing}`}
              />
            </div>

            {aiError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[12px]">
                {aiError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAiFixItem(null)}
                disabled={aiLoading}
                className="flex-1 h-11 rounded-xl bg-surface-container-low text-on-surface-variant text-[14px] font-semibold active:scale-95 transition-transform"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAiFixSubmit}
                disabled={aiLoading || !aiPrompt.trim()}
                className={`flex-1 h-11 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 ${focusRing}`}
              >
                {aiLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin" />
                    <span>جارٍ التحديث...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    <span>تحديث بالـ AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. Modal: Manual Item Override                                 */}
      {/* ============================================================== */}
      {manualItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
          <div
            className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
            onClick={() => setManualItem(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-manual-title`}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-t-[28px] sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 z-10 animate-[toast-in_200ms_ease-out]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </span>
                <h3 id={`${uid}-manual-title`} className="text-[16px] font-bold text-on-surface">
                  تعديل الصنف يدوياً
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualItem(null)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${uid}-m-name`} className="text-[12px] font-semibold text-on-surface-variant">
                  اسم الصنف
                </label>
                <input
                  id={`${uid}-m-name`}
                  type="text"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none ${focusRing}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-m-grams`} className="text-[12px] font-semibold text-on-surface-variant">
                    الوزن (جرام)
                  </label>
                  <input
                    id={`${uid}-m-grams`}
                    type="number"
                    min={1}
                    max={5000}
                    value={manualForm.grams}
                    onChange={(e) => setManualForm({ ...manualForm, grams: Number(e.target.value) || 0 })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-m-cal`} className="text-[12px] font-semibold text-on-surface-variant">
                    السعرات (kcal)
                  </label>
                  <input
                    id={`${uid}-m-cal`}
                    type="number"
                    min={0}
                    max={5000}
                    value={manualForm.calories}
                    onChange={(e) => setManualForm({ ...manualForm, calories: Number(e.target.value) || 0 })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-m-p`} className="text-[12px] font-semibold text-secondary">
                    بروتين (g)
                  </label>
                  <input
                    id={`${uid}-m-p`}
                    type="number"
                    step="0.1"
                    min={0}
                    max={500}
                    value={manualForm.protein}
                    onChange={(e) => setManualForm({ ...manualForm, protein: Number(e.target.value) || 0 })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-m-c`} className="text-[12px] font-semibold text-tertiary">
                    كارب (g)
                  </label>
                  <input
                    id={`${uid}-m-c`}
                    type="number"
                    step="0.1"
                    min={0}
                    max={500}
                    value={manualForm.carbs}
                    onChange={(e) => setManualForm({ ...manualForm, carbs: Number(e.target.value) || 0 })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-m-f`} className="text-[12px] font-semibold text-primary">
                    دهون (g)
                  </label>
                  <input
                    id={`${uid}-m-f`}
                    type="number"
                    step="0.1"
                    min={0}
                    max={500}
                    value={manualForm.fat}
                    onChange={(e) => setManualForm({ ...manualForm, fat: Number(e.target.value) || 0 })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setManualItem(null)}
                className="flex-1 h-11 rounded-xl bg-surface-container-low text-on-surface-variant text-[14px] font-semibold active:scale-95 transition-transform"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualForm.name.trim()}
                className={`flex-1 h-11 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>تأكيد التعديل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. Modal: Add New Item (AI or Manual)                          */}
      {/* ============================================================== */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
          <div
            className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
            onClick={() => !addAiLoading && setShowAddDialog(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-add-title`}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-t-[28px] sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 z-10 animate-[toast-in_200ms_ease-out]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </span>
                <h3 id={`${uid}-add-title`} className="text-[16px] font-bold text-on-surface">
                  إضافة صنف جديد للوجبة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                disabled={addAiLoading}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Segmented control: AI vs Manual */}
            <div className="grid grid-cols-2 p-0.5 rounded-xl bg-surface-container-high">
              <button
                type="button"
                onClick={() => setAddMode("ai")}
                className={`h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  addMode === "ai"
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>بالذكاء الاصطناعي</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  addMode === "manual"
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>إدخال يدوي</span>
              </button>
            </div>

            {addMode === "ai" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${uid}-add-ai-input`} className="text-[13px] font-semibold text-on-surface">
                    صف الصنف الجديد أو كميته
                  </label>
                  <textarea
                    id={`${uid}-add-ai-input`}
                    rows={3}
                    value={addAiPrompt}
                    disabled={addAiLoading}
                    onChange={(e) => setAddAiPrompt(e.target.value)}
                    placeholder="مثال: حبة تفاحة خضراء متوسطة، أو صحن تبولة صغير، أو كاسة عصير برتقال..."
                    className={`w-full rounded-xl bg-surface-container-lowest p-3 text-[14px] text-on-surface placeholder:text-outline border border-outline-variant/30 outline-none resize-none ${focusRing}`}
                  />
                </div>

                {addAiError && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-[12px]">
                    {addAiError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddDialog(false)}
                    disabled={addAiLoading}
                    className="flex-1 h-11 rounded-xl bg-surface-container-low text-on-surface-variant text-[14px] font-semibold active:scale-95 transition-transform"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAiSubmit}
                    disabled={addAiLoading || !addAiPrompt.trim()}
                    className={`flex-1 h-11 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 ${focusRing}`}
                  >
                    {addAiLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin" />
                        <span>جارٍ التحليل...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        <span>تحليل وإضافة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-add-m-name`} className="text-[12px] font-semibold text-on-surface-variant">
                    اسم الصنف
                  </label>
                  <input
                    id={`${uid}-add-m-name`}
                    type="text"
                    placeholder="مثال: خبز بر"
                    value={addManualForm.name}
                    onChange={(e) => setAddManualForm({ ...addManualForm, name: e.target.value })}
                    className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none ${focusRing}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${uid}-add-m-grams`} className="text-[12px] font-semibold text-on-surface-variant">
                      الوزن (جرام)
                    </label>
                    <input
                      id={`${uid}-add-m-grams`}
                      type="number"
                      min={1}
                      max={5000}
                      value={addManualForm.grams}
                      onChange={(e) => setAddManualForm({ ...addManualForm, grams: Number(e.target.value) || 0 })}
                      className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${uid}-add-m-cal`} className="text-[12px] font-semibold text-on-surface-variant">
                      السعرات (kcal)
                    </label>
                    <input
                      id={`${uid}-add-m-cal`}
                      type="number"
                      min={0}
                      max={5000}
                      value={addManualForm.calories}
                      onChange={(e) => setAddManualForm({ ...addManualForm, calories: Number(e.target.value) || 0 })}
                      className={`h-11 rounded-xl bg-surface-container-lowest px-3 text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${uid}-add-m-p`} className="text-[12px] font-semibold text-secondary">
                      بروتين (g)
                    </label>
                    <input
                      id={`${uid}-add-m-p`}
                      type="number"
                      step="0.1"
                      min={0}
                      max={500}
                      value={addManualForm.protein}
                      onChange={(e) => setAddManualForm({ ...addManualForm, protein: Number(e.target.value) || 0 })}
                      className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${uid}-add-m-c`} className="text-[12px] font-semibold text-tertiary">
                      كارب (g)
                    </label>
                    <input
                      id={`${uid}-add-m-c`}
                      type="number"
                      step="0.1"
                      min={0}
                      max={500}
                      value={addManualForm.carbs}
                      onChange={(e) => setAddManualForm({ ...addManualForm, carbs: Number(e.target.value) || 0 })}
                      className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${uid}-add-m-f`} className="text-[12px] font-semibold text-primary">
                      دهون (g)
                    </label>
                    <input
                      id={`${uid}-add-m-f`}
                      type="number"
                      step="0.1"
                      min={0}
                      max={500}
                      value={addManualForm.fat}
                      onChange={(e) => setAddManualForm({ ...addManualForm, fat: Number(e.target.value) || 0 })}
                      className={`h-11 rounded-xl bg-surface-container-lowest px-2.5 text-center text-[14px] text-on-surface border border-outline-variant/30 outline-none tabular-nums ${focusRing}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddDialog(false)}
                    className="flex-1 h-11 rounded-xl bg-surface-container-low text-on-surface-variant text-[14px] font-semibold active:scale-95 transition-transform"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualSubmit}
                    disabled={!addManualForm.name.trim()}
                    className={`flex-1 h-11 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 ${focusRing}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>إضافة الصنف</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
