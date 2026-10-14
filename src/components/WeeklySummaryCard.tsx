"use client";

import { useMemo, useState } from "react";
import { AR_WEEKDAYS_SHORT, addDays, eachDay, isSameDay, localDateString } from "@/src/lib/dates";
import type { DaySummary } from "@/src/lib/meals";

interface Props {
  weekStart: Date;
  selectedDate: Date;
  onSelectDay: (d: Date) => void;
  daySummaries: Record<string, DaySummary>;
  dailyGoal: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function WeeklySummaryCard({
  weekStart,
  selectedDate,
  onSelectDay,
  daySummaries,
  dailyGoal,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const weekDays = useMemo(() => eachDay(weekStart, addDays(weekStart, 6)), [weekStart]);

  const stats = useMemo(() => {
    const dayData = weekDays.map((d) => {
      const key = localDateString(d);
      const summary = daySummaries[key] ?? { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
      return { date: d, key, summary };
    });

    const totals = dayData.reduce(
      (acc, item) => ({
        calories: acc.calories + item.summary.calories,
        protein: acc.protein + item.summary.protein,
        carbs: acc.carbs + item.summary.carbs,
        fat: acc.fat + item.summary.fat,
        loggedDays: acc.loggedDays + (item.summary.count > 0 ? 1 : 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, loggedDays: 0 },
    );

    const totalCal = totals.calories;
    const weeklyGoal = dailyGoal * 7;
    const avgCal = Math.round(totalCal / 7);
    const avgProt = Math.round(totals.protein / 7);
    const avgCarbs = Math.round(totals.carbs / 7);
    const avgFat = Math.round(totals.fat / 7);
    const loggedDays = totals.loggedDays;

    // Max scale for the 7 bars
    const maxCalInWeek = Math.max(...dayData.map((d) => d.summary.calories), dailyGoal);
    const chartMax = Math.max(maxCalInWeek * 1.1, dailyGoal * 1.2, 2000);

    return {
      totalCal,
      weeklyGoal,
      loggedDays,
      avgCal,
      avgProt,
      avgCarbs,
      avgFat,
      dayData,
      chartMax,
    };
  }, [weekDays, daySummaries, dailyGoal]);

  return (
    <div className="bg-surface-container-lowest rounded-[24px] p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-3">
      {/* Header with collapse toggle */}
      <button
        id="weekly-summary-toggle"
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-between w-full text-start group"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary-container/15 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">bar_chart</span>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-on-surface">ملخص الأسبوع</h3>
            <span className="text-[11px] text-on-surface-variant">
              {stats.loggedDays > 0
                ? `${stats.loggedDays} من 7 أيام مسجّلة`
                : "لم تُسجّل وجبات هذا الأسبوع"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-on-surface">
            {fmt(stats.totalCal)} <span className="text-[11px] font-normal text-on-surface-variant">سعرة</span>
          </span>
          <span
            className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            expand_less
          </span>
        </div>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-4 pt-1 border-t border-outline-variant/15">
          {/* 7-Bar Chart */}
          <div className="flex flex-col gap-2">
            <div className="h-28 flex items-end justify-between gap-1 pt-4 pb-1 px-1">
              {stats.dayData.map((item, idx) => {
                const cal = item.summary.calories;
                const pct = Math.min(100, Math.max(cal > 0 ? 8 : 4, Math.round((cal / stats.chartMax) * 100)));
                const isSelected = isSameDay(item.date, selectedDate);
                const isOverGoal = cal > dailyGoal * 1.15;
                const isWarningGoal = cal > dailyGoal && !isOverGoal;

                let barColor = "bg-primary";
                if (cal === 0) {
                  barColor = "bg-surface-container-high";
                } else if (isOverGoal) {
                  barColor = "bg-error";
                } else if (isWarningGoal) {
                  barColor = "bg-tertiary-container";
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectDay(item.date)}
                    title={`${AR_WEEKDAYS_SHORT[idx]}: ${fmt(cal)} سعرة`}
                    className="flex-1 flex flex-col items-center h-full justify-end group active:scale-95 transition-all"
                  >
                    {/* Calorie tooltip/label when selected or hovered */}
                    <span
                      className={`text-[10px] font-bold tabular-nums mb-1 transition-opacity ${
                        isSelected ? "text-primary opacity-100" : "text-outline opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {cal > 0 ? fmt(cal) : "0"}
                    </span>

                    {/* The bar track */}
                    <div className="w-full max-w-[28px] h-20 bg-surface-container-low rounded-t-lg relative flex items-end overflow-hidden">
                      {/* Daily goal reference line if inside scale */}
                      <div
                        className="absolute w-full border-t border-dashed border-outline-variant/50 z-10 pointer-events-none"
                        style={{ bottom: `${Math.round((dailyGoal / stats.chartMax) * 100)}%` }}
                      />

                      {/* Bar fill */}
                      <div
                        style={{ height: `${pct}%` }}
                        className={`w-full rounded-t-lg transition-all duration-500 ${barColor} ${
                          isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""
                        }`}
                      />
                    </div>

                    {/* Day label */}
                    <span
                      className={`text-[11px] mt-1.5 font-medium transition-colors ${
                        isSelected ? "text-primary font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {AR_WEEKDAYS_SHORT[idx]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-outline px-1">
              <span>الخط المنقّط: الهدف اليومي ({fmt(dailyGoal)} سعرة)</span>
              <span>اضغط على أي يوم للتنقل إليه</span>
            </div>
          </div>

          {/* Weekly Metrics Cards */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant">المجموع الأسبوعي</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-bold text-on-surface">{fmt(stats.totalCal)}</span>
                <span className="text-[11px] text-on-surface-variant">من {fmt(stats.weeklyGoal)}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((stats.totalCal / stats.weeklyGoal) * 100))}%` }}
                />
              </div>
            </div>

            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant">المعدل اليومي</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-bold text-primary">{fmt(stats.avgCal)}</span>
                <span className="text-[11px] text-on-surface-variant">سعرة / يوم</span>
              </div>
              <span className="text-[11px] text-on-surface-variant mt-1">
                {stats.avgCal <= dailyGoal
                  ? `ضمن الهدف (${fmt(dailyGoal - stats.avgCal)} متبقي)`
                  : `فوق الهدف بـ ${fmt(stats.avgCal - dailyGoal)}`}
              </span>
            </div>
          </div>

          {/* Average Macronutrients */}
          <div className="flex items-center justify-around py-2.5 px-3 rounded-2xl bg-surface-container-low text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-on-surface-variant">بروتين:</span>
              <span className="font-bold text-secondary">{fmt(stats.avgProt)}g</span>
            </div>
            <span className="text-outline-variant">•</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span className="text-on-surface-variant">كارب:</span>
              <span className="font-bold text-tertiary">{fmt(stats.avgCarbs)}g</span>
            </div>
            <span className="text-outline-variant">•</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-on-surface-variant">دهون:</span>
              <span className="font-bold text-primary">{fmt(stats.avgFat)}g</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
