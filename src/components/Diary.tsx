"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMealsForDay, type DiaryMeal } from "@/src/lib/meals";
import { sumMacros } from "@/src/lib/nutrition";
import { useAuth } from "@/src/context/AuthContext";

/** Daily target calories (can be configured per profile in future). */
const CALORIE_GOAL = 2000;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const MEAL_LABEL: Record<string, { label: string; icon: string }> = {
  breakfast: { label: "الفطور", icon: "bakery_dining" },
  lunch: { label: "الغداء", icon: "lunch_dining" },
  dinner: { label: "العشاء", icon: "dinner_dining" },
  snack: { label: "وجبة خفيفة", icon: "cookie" },
};

function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const over = value > goal;
  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-surface-container" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`${over ? "stroke-tertiary-container" : "stroke-primary"} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span id="daily-calories" className="text-[26px] leading-7 font-bold text-on-surface">
          {fmt(value)}
        </span>
        <span className="text-[11px] text-on-surface-variant">من {fmt(goal)} سعرة</span>
      </div>
    </div>
  );
}

function MacroCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col items-center gap-0.5 border border-outline-variant/20">
      <span className={`text-[18px] font-bold ${color}`}>{fmt(value)}g</span>
      <span className="text-[12px] text-on-surface-variant">{label}</span>
    </div>
  );
}

export default function Diary() {
  const { user, signOut } = useAuth();
  const [meals, setMeals] = useState<DiaryMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    setRefreshing(true);
    try {
      const data = await fetchMealsForDay();
      setMeals(data);
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "تعذّر تحميل وجبات اليوم. حاول مرة أخرى.";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totals = useMemo(() => sumMacros((meals ?? []).map((m) => m.totals)), [meals]);
  const today = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );

  return (
    <div className="max-w-md w-full mx-auto min-h-screen flex flex-col pb-28">
      {/* Top App Bar */}
      <header className="h-16 px-4 flex items-center justify-between sticky top-0 z-10 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-fixed flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">nutrition</span>
          </div>
          <div>
            <span className="text-[18px] font-bold text-on-surface block leading-tight">حسبة</span>
            <span className="text-[11px] text-on-surface-variant block">{today}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}

          {user && (
            <button
              type="button"
              onClick={() => signOut()}
              title="تسجيل الخروج"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/40 text-[12px] font-medium transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>خروج</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <h1 className="sr-only">اليوميات</h1>

        {/* Calorie Progress Ring Summary */}
        <section
          aria-label="ملخص اليوم"
          className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-outline-variant/20 flex items-center gap-5"
        >
          <Ring value={totals.calories} goal={CALORIE_GOAL} />
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-on-surface-variant">المتبقي اليوم</span>
            <span className="text-[24px] font-bold text-primary">
              {fmt(Math.max(0, CALORIE_GOAL - totals.calories))}
            </span>
            <span className="text-[12px] text-on-surface-variant">سعرة حرارية</span>
          </div>
        </section>

        {/* Macronutrients breakdown */}
        <section aria-label="المغذيات" className="flex gap-3">
          <MacroCard label="بروتين" value={totals.protein} color="text-secondary" />
          <MacroCard label="كربوهيدرات" value={totals.carbs} color="text-tertiary" />
          <MacroCard label="دهون" value={totals.fat} color="text-primary" />
        </section>

        {/* Today's Meals Timeline */}
        <section aria-label="وجبات اليوم" className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-on-surface">وجبات اليوم</h2>
            {meals && meals.length > 0 && (
              <span className="text-[12px] text-on-surface-variant">
                {meals.length} {meals.length === 1 ? "وجبة" : "وجبات"}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-[13px] flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadData}
                className="text-[12px] font-bold underline ps-2"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!error && meals === null && (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-surface-container animate-pulse" />
              ))}
            </div>
          )}

          {meals?.length === 0 && (
            <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col items-center gap-3 text-center border border-outline-variant/20">
              <span className="material-symbols-outlined text-[42px] text-outline">restaurant</span>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-on-surface">لم تسجّل أي وجبة اليوم بعد</span>
                <p className="text-[13px] text-on-surface-variant">ابدأ يومك بتسجيل وجبتك الأولى لتحليل سعراتها تلقائياً</p>
              </div>
              <Link
                href="/add"
                className="mt-2 h-11 px-6 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center gap-2 active:scale-95 shadow-md shadow-primary/20 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>إضافة وجبة الآن</span>
              </Link>
            </div>
          )}

          {meals && meals.length > 0 && (
            <ol className="relative flex flex-col gap-3 ps-6 before:content-[''] before:absolute before:top-2 before:bottom-2 before:start-[7px] before:w-0.5 before:bg-outline-variant/40">
              {meals.map((m) => {
                const meta = MEAL_LABEL[m.mealType ?? ""] ?? { label: "وجبة", icon: "restaurant" };
                const time = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(
                  new Date(m.eatenAt),
                );
                return (
                  <li key={m.id} className="relative">
                    <span className="absolute -start-6 top-5 w-4 h-4 rounded-full bg-primary border-4 border-surface" />
                    <article className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[20px]">{meta.icon}</span>
                          <span className="text-[15px] font-bold text-on-surface">{meta.label}</span>
                          <span className="text-[12px] text-on-surface-variant">{time}</span>
                        </div>
                        <span className="text-[15px] font-bold text-on-surface">{fmt(m.totals.calories)} سعرة</span>
                      </div>
                      <ul className="flex flex-col gap-1">
                        {m.items.map((it) => (
                          <li key={it.id} className="flex justify-between text-[13px] text-on-surface-variant">
                            <span>
                              {it.name} <span className="text-outline">• {fmt(it.grams)}g</span>
                            </span>
                            <span>{fmt(it.calories)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-[12px] font-semibold text-secondary pt-1 border-t border-outline-variant/20">
                        بروتين {fmt(m.totals.protein)}g • كربوهيدرات {fmt(m.totals.carbs)}g • دهون{" "}
                        {fmt(m.totals.fat)}g
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
