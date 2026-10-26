"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  MEAL_TYPES,
  fetchDaySummaries,
  fetchMealsForDay,
  type DiaryMeal,
} from "@/src/lib/meals";
import {
  getCachedUserProfile,
  getUserProfile,
  isProfileConfigured,
  resolveTargets,
  sumMacros,
} from "@/src/lib/nutrition";
import { useAuth } from "@/src/context/AuthContext";
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDayFull,
  isSameDay,
  localDateString,
  startOfMonth,
  startOfWeek,
} from "@/src/lib/dates";
import { queryKeys, invalidateUserMeals } from "@/src/lib/queryKeys";
import {
  CalorieRingSkeleton,
  MacroCardsSkeleton,
  MealsTimelineSkeleton,
} from "./Skeletons";
import CalendarPicker from "./CalendarPicker";
import WeeklySummaryCard from "./WeeklySummaryCard";
import EditMealSheet from "./EditMealSheet";
import ThemeToggle from "./ThemeToggle";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const MEAL_LABEL: Record<string, { label: string; icon: string }> = Object.fromEntries(
  MEAL_TYPES.map((t) => [t.value, { label: t.label, icon: t.icon }]),
);

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

function MacroCard({
  label,
  value,
  goal,
  color,
  bar,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  bar: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className="flex-1 bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col items-center gap-0.5 border border-outline-variant/20">
      <span className={`text-[18px] font-bold tabular-nums ${color}`}>{fmt(value)}g</span>
      <span className="text-[12px] text-on-surface-variant">{label}</span>
      <div
        className="w-full h-1 mt-1.5 rounded-full bg-surface-container overflow-hidden"
        role="progressbar"
        aria-label={`${label} من الهدف`}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.round(value)}
      >
        <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-outline tabular-nums">من {fmt(goal)}g</span>
    </div>
  );
}

export default function Diary() {
  const { user, loading: authLoading, signOut } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selectedDate));
  const [editing, setEditing] = useState<DiaryMeal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedDateKey = localDateString(selectedDate);

  // 1. Authoritative User Profile & Targets Query
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getUserProfile(userId),
    enabled: !!userId,
    initialData: () => (userId ? getCachedUserProfile(userId) ?? undefined : undefined),
  });

  const targets = resolveTargets(profile ?? null);
  const calorieGoal = targets.target_calories;
  const configured = isProfileConfigured(userId, profile ?? null);
  const showSetupBanner = !authLoading && !isProfileLoading && !configured;

  // 2. Day Summaries Query (Month before to month after currently viewed calendar month)
  const summaryRange = useMemo(() => {
    const from = addMonths(startOfMonth(viewMonth), -1);
    const to = addMonths(endOfMonth(viewMonth), 1);
    return {
      from,
      to,
      fromKey: localDateString(from),
      toKey: localDateString(to),
    };
  }, [viewMonth]);

  const { data: daySummaries = {}, isFetching: isSummariesFetching } = useQuery({
    queryKey: queryKeys.summaries(userId, summaryRange.fromKey, summaryRange.toKey),
    queryFn: () => fetchDaySummaries(summaryRange.from, summaryRange.to, userId),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  // 3. Meals for Selected Day Query
  const {
    data: meals,
    isLoading: isMealsLoading,
    isFetching: isMealsFetching,
    error: mealsError,
    refetch: refetchMeals,
  } = useQuery({
    queryKey: queryKeys.meals(userId, selectedDateKey),
    queryFn: () => fetchMealsForDay(selectedDate, userId),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  const isColdLoading = !meals && isMealsLoading;
  const isRefreshing = isMealsFetching || isSummariesFetching;

  const today = useMemo(() => new Date(), []);
  const isSelectedToday = isSameDay(selectedDate, today);
  const isSelectedYesterday = isSameDay(selectedDate, addDays(today, -1));
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const totals = useMemo(() => sumMacros((meals ?? []).map((m) => m.totals)), [meals]);

  const handleMonthChange = useCallback((d: Date) => {
    setViewMonth(startOfMonth(d));
  }, []);

  /** Show today's diary after a meal was copied into it */
  async function showTodayAfterCopy() {
    setNotice("تمت إضافة الوجبة إلى اليوم الحالي");
    window.setTimeout(() => setNotice(null), 3500);
    await invalidateUserMeals(queryClient, userId);
    if (!isSelectedToday) {
      setSelectedDate(new Date());
    }
  }

  const dateLabel = isSelectedToday
    ? "اليوم"
    : isSelectedYesterday
    ? "أمس"
    : formatDayFull(selectedDate);

  const errorMessage = mealsError instanceof Error
    ? mealsError.message
    : mealsError
    ? "تعذّر تحميل وجبات هذا اليوم. حاول مرة أخرى."
    : null;

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
            <span className="text-[11px] text-on-surface-variant block">{formatDayFull(today)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRefreshing && (
            <span
              title="جاري التحديث في الخلفية"
              className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
            />
          )}

          <ThemeToggle />

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

      <main className="flex-1 px-4 pt-3 flex flex-col gap-4">
        <h1 className="sr-only">اليوميات</h1>

        {showSetupBanner && (
          <Link
            id="profile-setup-banner"
            href="/profile"
            prefetch={true}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary-fixed/40 dark:bg-primary-fixed/60 border border-primary/20 text-on-surface active:scale-[0.99] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span
              aria-hidden="true"
              className="w-9 h-9 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[20px]">calculate</span>
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[14px] font-semibold">اضبط بيانات جسمك وهدفك لحساب سعراتك بدقة ←</span>
              <span className="text-[12px] text-on-surface-variant">
                الهدف الحالي افتراضي ({fmt(calorieGoal)} سعرة)
              </span>
            </span>
          </Link>
        )}

        {/* 1. Calendar History: Interactive Week Strip & Month Modal */}
        <section aria-label="التاريخ والتقويم" className="bg-surface-container-lowest rounded-[24px] p-3 shadow-sm border border-outline-variant/20">
          <CalendarPicker
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            daySummaries={daySummaries}
            onMonthChange={handleMonthChange}
          />
        </section>

        {/* 2. Weekly Nutrition Summary & 7-Bar Chart */}
        <section aria-label="ملخص الأسبوع">
          <WeeklySummaryCard
            weekStart={weekStart}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
            daySummaries={daySummaries}
            targets={targets}
          />
        </section>

        {/* Date context header */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-on-surface">{dateLabel}</h2>
            <span className="text-[12px] text-on-surface-variant">
              ({formatDayFull(selectedDate)})
            </span>
          </div>
          <Link
            href={`/add?date=${selectedDateKey}`}
            prefetch={true}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-[12px] font-semibold active:scale-95 shadow-sm shadow-primary/20 transition-transform"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>إضافة وجبة</span>
          </Link>
        </div>

        {/* 3. Calorie Progress Ring Summary for Selected Date */}
        {isColdLoading ? (
          <CalorieRingSkeleton />
        ) : (
          <section
            aria-label="ملخص السعرات لليوم المحدد"
            className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-outline-variant/20 flex items-center gap-5"
          >
            <Ring value={totals.calories} goal={calorieGoal} />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-on-surface-variant">
                {totals.calories <= calorieGoal ? "المتبقي لهذا اليوم" : "تجاوزت الهدف اليومي بـ"}
              </span>
              <span className={`text-[24px] font-bold ${totals.calories > calorieGoal ? "text-error" : "text-primary"}`}>
                {fmt(Math.abs(calorieGoal - totals.calories))}
              </span>
              <span className="text-[12px] text-on-surface-variant">سعرة حرارية</span>
            </div>
          </section>
        )}

        {/* Macronutrients breakdown for Selected Date */}
        {isColdLoading ? (
          <MacroCardsSkeleton />
        ) : (
          <section aria-label="المغذيات" className="flex gap-3">
            <MacroCard label="بروتين" value={totals.protein} goal={targets.target_protein_g} color="text-secondary" bar="bg-secondary" />
            <MacroCard label="كربوهيدرات" value={totals.carbs} goal={targets.target_carbs_g} color="text-tertiary" bar="bg-tertiary" />
            <MacroCard label="دهون" value={totals.fat} goal={targets.target_fat_g} color="text-primary" bar="bg-primary" />
          </section>
        )}

        {/* Meals Timeline for Selected Date */}
        <section aria-label="وجبات اليوم المحدد" className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[16px] font-bold text-on-surface">
              وجبات {dateLabel}
            </h3>
            {meals && meals.length > 0 && (
              <span className="text-[12px] text-on-surface-variant">
                {meals.length} {meals.length === 1 ? "وجبة" : "وجبات"}
              </span>
            )}
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-[13px] flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => void refetchMeals()}
                className="text-[12px] font-bold underline ps-2"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-[13px] font-semibold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                check_circle
              </span>
              <span>{notice}</span>
            </div>
          )}

          {isColdLoading && <MealsTimelineSkeleton />}

          {!isColdLoading && meals?.length === 0 && (
            <div className="bg-surface-container-low rounded-2xl p-7 flex flex-col items-center gap-3 text-center border border-outline-variant/20">
              <span className="material-symbols-outlined text-[40px] text-outline">restaurant</span>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-on-surface">
                  لا توجد وجبات مسجلة في هذا اليوم
                </span>
                <p className="text-[13px] text-on-surface-variant">
                  {isSelectedToday
                    ? "ابدأ يومك بتسجيل وجبتك الأولى لتحليل سعراتها تلقائياً"
                    : "يمكنك تسجيل وجبة فاتتك في هذا اليوم بسهولة"}
                </p>
              </div>
              <Link
                href={`/add?date=${selectedDateKey}`}
                prefetch={true}
                className="mt-1 h-11 px-6 rounded-xl bg-primary text-on-primary text-[14px] font-semibold flex items-center gap-2 active:scale-95 shadow-md shadow-primary/20 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>تسجيل وجبة لهذا اليوم</span>
              </Link>
            </div>
          )}

          {!isColdLoading && meals && meals.length > 0 && (
            <ol className="relative flex flex-col gap-3 ps-6 before:content-[''] before:absolute before:top-2 before:bottom-2 before:start-[7px] before:w-0.5 before:bg-outline-variant/40">
              {meals.map((m) => {
                const meta = MEAL_LABEL[m.mealType ?? ""] ?? { label: "وجبة", icon: "restaurant" };
                const time = new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(
                  new Date(m.eatenAt),
                );
                return (
                  <li key={m.id} className="relative">
                    <span className="absolute -start-6 top-5 w-4 h-4 rounded-full bg-primary border-4 border-surface" />
                    <article
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("button") || target.closest("a")) return;
                        setEditing(m);
                      }}
                      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-2.5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-primary-fixed text-on-primary-fixed">
                              <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                              <span>{meta.label}</span>
                            </span>
                            <span className="text-[12px] text-on-surface-variant">{time}</span>
                          </div>
                          {m.title && (
                            <span className="text-[15px] font-bold text-on-surface truncate">{m.title}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[15px] font-bold text-on-surface tabular-nums">
                            {fmt(m.totals.calories)} سعرة
                          </span>
                          <button
                            id={`edit-meal-${m.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(m);
                            }}
                            aria-label={`تعديل أو خيارات ${m.title || meta.label}`}
                            className="w-11 h-11 -me-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low flex items-center justify-center active:scale-90 transition-all focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <span className="material-symbols-outlined text-[20px]" aria-hidden>
                              more_vert
                            </span>
                          </button>
                        </div>
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

      {editing && (
        <EditMealSheet
          key={editing.id}
          meal={editing}
          isPastDate={!isSelectedToday}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await invalidateUserMeals(queryClient, userId);
            setEditing(null);
          }}
          onCopied={async () => {
            setEditing(null);
            await showTodayAfterCopy();
          }}
        />
      )}
    </div>
  );
}
