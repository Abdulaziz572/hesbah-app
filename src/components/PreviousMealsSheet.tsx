"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MEAL_TYPES,
  copyMealToDate,
  setMealExtras,
  type PreviousMeal,
} from "@/src/lib/meals";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const TYPE_META = Object.fromEntries(MEAL_TYPES.map((t) => [t.value, t]));

/** Title if the user gave one, otherwise the first foods of the meal. */
export function mealDisplayName(p: PreviousMeal): string {
  if (p.meal.title?.trim()) return p.meal.title.trim();
  const names = p.meal.items.slice(0, 3).map((i) => i.name);
  return names.join(" + ") + (p.meal.items.length > 3 ? " …" : "");
}

function MacroPills({ p, c, f }: { p: number; c: number; f: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] font-semibold tabular-nums">
        بروتين {fmt(p)}g
      </span>
      <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[11px] font-semibold tabular-nums">
        كارب {fmt(c)}g
      </span>
      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tabular-nums">
        دهون {fmt(f)}g
      </span>
    </div>
  );
}

interface Props {
  meals: PreviousMeal[] | null;
  loadError: string | null;
  /** Signature of the meal to open expanded (when launched from a quick chip). */
  initialOpen?: string | null;
  /** Past day chosen in the diary calendar; meals are logged there instead of today. */
  targetDate?: Date;
  onClose: () => void;
  onRetry: () => void;
  /** Replace one template after its note/bookmark changed. */
  onUpdate: (next: PreviousMeal) => void;
  /** Open the meal in the review screen to tweak items before logging. */
  onEdit?: (meal: PreviousMeal) => void;
}

export default function PreviousMealsSheet({
  meals,
  loadError,
  initialOpen = null,
  targetDate,
  onClose,
  onRetry,
  onUpdate,
  onEdit,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "saved">("all");
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busySig, setBusySig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busySig) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busySig, onClose]);

  const visible = useMemo(
    () => (meals ?? []).filter((m) => tab === "all" || m.isSaved),
    [meals, tab],
  );
  const savedCount = (meals ?? []).filter((m) => m.isSaved).length;

  const draftOf = (p: PreviousMeal) => drafts[p.signature] ?? p.customNote ?? "";
  const sourceOf = (p: PreviousMeal) => ({
    id: p.meal.id,
    title: p.meal.title,
    items: p.meal.items,
  });

  async function toggleSaved(p: PreviousMeal) {
    setError(null);
    const next = !p.isSaved;
    onUpdate({ ...p, isSaved: next });
    try {
      await setMealExtras(sourceOf(p), { saved: next });
    } catch (e) {
      console.error(e);
      onUpdate(p);
      setError("تعذّر تحديث الحفظ. حاول مرة أخرى.");
    }
  }

  async function saveNote(p: PreviousMeal) {
    setError(null);
    setBusySig(p.signature);
    const note = draftOf(p).trim();
    try {
      await setMealExtras(sourceOf(p), { note });
      onUpdate({ ...p, customNote: note || null });
      setDrafts((d) => {
        const { [p.signature]: _drop, ...rest } = d;
        void _drop;
        return rest;
      });
    } catch (e) {
      console.error(e);
      setError("تعذّر حفظ الملاحظة. حاول مرة أخرى.");
    } finally {
      setBusySig(null);
    }
  }

  async function addMeal(p: PreviousMeal) {
    setError(null);
    setBusySig(p.signature);
    try {
      await copyMealToDate({ ...p.meal, customNote: draftOf(p).trim() || null }, targetDate);
      router.push("/");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "تعذّر إضافة الوجبة. حاول مرة أخرى.");
      setBusySig(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button
        type="button"
        aria-label="إغلاق"
        tabIndex={-1}
        onClick={() => !busySig && onClose()}
        className="anim-backdrop-in absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prev-meals-title"
        dir="rtl"
        className="anim-sheet-up relative z-10 w-full max-w-lg h-[88vh] flex flex-col bg-surface rounded-t-[28px] shadow-2xl"
      >
        <div className="flex flex-col gap-3 px-4 pt-3 pb-3 border-b border-outline-variant/20">
          <div className="mx-auto w-12 h-1 rounded-full bg-outline-variant/50" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]" aria-hidden>
                  history
                </span>
              </span>
              <div className="min-w-0">
                <h2 id="prev-meals-title" className="text-[18px] font-bold text-on-surface">
                  وجباتي السابقة
                </h2>
                <p className="text-[12px] text-on-surface-variant">
                  أضف وجبة سبق تسجيلها بدون تحليل جديد
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!!busySig}
              aria-label="إغلاق"
              className={`w-11 h-11 shrink-0 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden>
                close
              </span>
            </button>
          </div>

          <div
            role="tablist"
            aria-label="تصفية الوجبات"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-container"
          >
            {(
              [
                ["all", "الكل", meals?.length ?? 0],
                ["saved", "المحفوظة", savedCount],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                id={`prev-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`h-10 rounded-lg text-[13px] font-semibold transition-colors ${focusRing} ${
                  tab === key
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant"
                }`}
              >
                {label} <span className="tabular-nums opacity-70">({n})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-error-container text-on-error-container text-[13px]">
              {error}
            </div>
          )}

          {loadError && (
            <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-[13px] flex items-center justify-between gap-2">
              <span>{loadError}</span>
              <button type="button" onClick={onRetry} className="h-11 px-3 text-[13px] font-bold underline">
                إعادة المحاولة
              </button>
            </div>
          )}

          {!loadError && meals === null && (
            <div className="flex flex-col gap-2.5" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-surface-container animate-pulse" />
              ))}
            </div>
          )}

          {meals && visible.length === 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 text-center px-6">
              <span className="material-symbols-outlined text-[44px] text-outline" aria-hidden>
                {tab === "saved" ? "bookmark" : "restaurant"}
              </span>
              <span className="text-[15px] font-bold text-on-surface">
                {tab === "saved" ? "لا توجد وجبات محفوظة بعد" : "لا توجد وجبات سابقة بعد"}
              </span>
              <p className="text-[13px] text-on-surface-variant">
                {tab === "saved"
                  ? "اضغط على أيقونة العلامة بجانب أي وجبة لتثبيتها هنا."
                  : "بعد تسجيل أول وجبة ستظهر هنا لإعادة إضافتها بلمسة واحدة."}
              </p>
            </div>
          )}

          {visible.map((p) => {
            const isOpen = open === p.signature;
            const meta = TYPE_META[p.meal.mealType ?? ""];
            const busy = busySig === p.signature;
            const draft = draftOf(p);
            const dirty = draft.trim() !== (p.customNote ?? "");
            const panelId = `prev-panel-${p.meal.id}`;
            return (
              <article
                key={p.signature}
                className={`rounded-2xl border bg-surface-container-lowest transition-colors ${
                  isOpen ? "border-primary/40 shadow-md" : "border-outline-variant/20 shadow-sm"
                }`}
              >
                <div className="flex items-stretch">
                  <button
                    id={`prev-meal-${p.meal.id}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : p.signature)}
                    className={`flex-1 min-w-0 min-h-[44px] p-3.5 pe-2 text-start flex flex-col gap-2 rounded-s-2xl ${focusRing}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold text-on-surface truncate">
                        {mealDisplayName(p)}
                      </span>
                      <span className="shrink-0 text-[15px] font-bold text-on-surface tabular-nums">
                        {fmt(p.meal.totals.calories)}
                        <span className="text-[11px] font-medium text-on-surface-variant"> سعرة</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {meta && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed">
                          <span className="material-symbols-outlined text-[13px]" aria-hidden>
                            {meta.icon}
                          </span>
                          {meta.label}
                        </span>
                      )}
                      {p.count > 1 && (
                        <span className="text-[11px] text-on-surface-variant">سُجّلت {p.count} مرات</span>
                      )}
                      {p.customNote && !isOpen && (
                        <span className="material-symbols-outlined text-[15px] text-outline" aria-label="لها ملاحظة">
                          sticky_note_2
                        </span>
                      )}
                    </div>
                    <MacroPills p={p.meal.totals.protein} c={p.meal.totals.carbs} f={p.meal.totals.fat} />
                  </button>

                  <button
                    id={`prev-save-${p.meal.id}`}
                    type="button"
                    onClick={() => void toggleSaved(p)}
                    aria-pressed={p.isSaved}
                    aria-label={p.isSaved ? "إزالة من المحفوظة" : "حفظ الوجبة"}
                    className={`w-12 shrink-0 flex items-start justify-center pt-3 active:scale-90 transition-transform ${focusRing}`}
                  >
                    <span
                      className={`material-symbols-outlined text-[24px] ${p.isSaved ? "text-primary" : "text-outline"}`}
                      style={{ fontVariationSettings: `"FILL" ${p.isSaved ? 1 : 0}` }}
                      aria-hidden
                    >
                      bookmark
                    </span>
                  </button>
                </div>

                {isOpen && (
                  <div id={panelId} className="px-3.5 pb-3.5 flex flex-col gap-3 border-t border-outline-variant/20 pt-3">
                    <ul className="flex flex-col gap-1.5">
                      {p.meal.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-on-surface min-w-0 truncate">{it.name}</span>
                          <span className="shrink-0 text-on-surface-variant tabular-nums">
                            {fmt(it.grams)}g · {fmt(it.calories)} سعرة
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`prev-note-${p.meal.id}`} className="text-[13px] font-bold text-on-surface">
                        وصف خاص للوجبة
                      </label>
                      <textarea
                        id={`prev-note-${p.meal.id}`}
                        dir="rtl"
                        rows={2}
                        maxLength={500}
                        value={draft}
                        disabled={busy}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.signature]: e.target.value }))}
                        placeholder="مثال: وجبتي بعد النادي بعد يوم الأرجل…"
                        className={`w-full resize-none rounded-xl bg-surface-container-low p-3 text-[15px] leading-6 text-on-surface placeholder:text-outline border border-transparent focus:border-primary/40 outline-none disabled:opacity-60 ${focusRing}`}
                      />
                      {dirty && (
                        <button
                          id={`prev-note-save-${p.meal.id}`}
                          type="button"
                          onClick={() => void saveNote(p)}
                          disabled={busy}
                          className={`self-start h-11 px-4 rounded-xl bg-surface-container text-primary text-[13px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50 ${focusRing}`}
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden>
                            save
                          </span>
                          حفظ الملاحظة
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        id={`prev-add-${p.meal.id}`}
                        type="button"
                        onClick={() => void addMeal(p)}
                        disabled={busy}
                        className={`w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-60 ${focusRing}`}
                      >
                        {busy ? (
                          <>
                            <span
                              className="w-5 h-5 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
                              aria-hidden
                            />
                            <span>جارٍ الإضافة…</span>
                          </>
                        ) : (
                          <span>إضافة مباشرة +</span>
                        )}
                      </button>
                      {onEdit && (
                        <button
                          id={`prev-edit-${p.meal.id}`}
                          type="button"
                          onClick={() => onEdit({ ...p, customNote: draftOf(p).trim() || null })}
                          disabled={busy}
                          className={`w-full h-12 rounded-xl bg-surface-container text-primary font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 ${focusRing}`}
                        >
                          <span className="material-symbols-outlined text-[20px]" aria-hidden>
                            edit
                          </span>
                          <span>تعديل قبل الإضافة</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
