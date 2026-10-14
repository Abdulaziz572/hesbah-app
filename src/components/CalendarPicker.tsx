"use client";

import { useMemo, useState } from "react";
import {
  AR_WEEKDAYS_SHORT,
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatMonthYear,
  isSameDay,
  localDateString,
  startOfMonth,
  startOfWeek,
} from "@/src/lib/dates";
import type { DaySummary } from "@/src/lib/meals";

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  daySummaries: Record<string, DaySummary>;
  /** Optional callback to fetch a wider date range if user navigates month */
  onMonthChange?: (d: Date) => void;
}

export default function CalendarPicker({
  selectedDate,
  onSelectDate,
  daySummaries,
  onMonthChange,
}: Props) {
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [modalMonth, setModalMonth] = useState<Date>(() => startOfMonth(selectedDate));

  const today = useMemo(() => new Date(), []);
  const isTodaySelected = isSameDay(selectedDate, today);

  // 7 days of the currently selected week (starting Saturday)
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => eachDay(weekStart, addDays(weekStart, 6)), [weekStart]);

  function handlePrevWeek() {
    onSelectDate(addDays(selectedDate, -7));
  }

  function handleNextWeek() {
    onSelectDate(addDays(selectedDate, 7));
  }

  function handleOpenModal() {
    setModalMonth(startOfMonth(selectedDate));
    setShowMonthModal(true);
  }

  function handlePrevMonth() {
    const next = addMonths(modalMonth, -1);
    setModalMonth(next);
    onMonthChange?.(next);
  }

  function handleNextMonth() {
    const next = addMonths(modalMonth, 1);
    setModalMonth(next);
    onMonthChange?.(next);
  }

  // Days for the monthly calendar grid
  const monthGrid = useMemo(() => {
    const mStart = startOfMonth(modalMonth);
    const mEnd = endOfMonth(modalMonth);
    const daysInMonth = eachDay(mStart, mEnd);

    // Weekday of the first day: 0 = Sunday, 6 = Saturday
    // Saudi week starts Saturday (index 0).
    // Saturday(6) -> 0, Sunday(0) -> 1, Monday(1) -> 2, Tuesday(2) -> 3, Wednesday(3) -> 4, Thursday(4) -> 5, Friday(5) -> 6
    const leadingBlanks = (mStart.getDay() - 6 + 7) % 7;
    return { leadingBlanks, daysInMonth };
  }, [modalMonth]);

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Top Header: Month title button & navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          id="calendar-month-btn"
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-1 px-2.5 py-1 -ms-1 rounded-xl hover:bg-surface-container-low text-on-surface text-[15px] font-bold active:scale-95 transition-all"
        >
          <span>{formatMonthYear(selectedDate)}</span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            expand_more
          </span>
        </button>

        <div className="flex items-center gap-1">
          {!isTodaySelected && (
            <button
              id="today-btn"
              type="button"
              onClick={() => onSelectDate(new Date())}
              className="px-2.5 py-1 rounded-full bg-secondary-container/15 text-secondary text-[12px] font-semibold active:scale-95 transition-transform"
            >
              اليوم
            </button>
          )}

          <div className="flex items-center gap-0.5 bg-surface-container-low rounded-xl p-0.5">
            <button
              id="prev-week-btn"
              type="button"
              aria-label="الأسبوع السابق"
              onClick={handlePrevWeek}
              className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface flex items-center justify-center active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px] rtl:rotate-0">
                chevron_right
              </span>
            </button>
            <button
              id="next-week-btn"
              type="button"
              aria-label="الأسبوع القادم"
              onClick={handleNextWeek}
              className="w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface flex items-center justify-center active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px] rtl:rotate-0">
                chevron_left
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Week Strip */}
      <div className="grid grid-cols-7 gap-1.5 w-full" role="tablist" aria-label="أيام الأسبوع">
        {weekDays.map((d, i) => {
          const isSelected = isSameDay(d, selectedDate);
          const isCurrentToday = isSameDay(d, today);
          const dateKey = localDateString(d);
          const hasMeals = (daySummaries[dateKey]?.count ?? 0) > 0;

          return (
            <button
              key={dateKey}
              id={`day-${dateKey}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectDate(d)}
              className={`flex flex-col items-center justify-between py-2 rounded-2xl transition-all active:scale-95 min-h-[64px] ${
                isSelected
                  ? "bg-primary text-on-primary shadow-md shadow-primary/25 font-bold"
                  : isCurrentToday
                  ? "bg-surface-container border-2 border-primary/40 text-on-surface font-semibold"
                  : "bg-surface-container-low hover:bg-surface-container text-on-surface font-medium"
              }`}
            >
              <span
                className={`text-[11px] leading-tight ${
                  isSelected ? "text-on-primary/85" : "text-on-surface-variant"
                }`}
              >
                {AR_WEEKDAYS_SHORT[i]}
              </span>
              <span className="text-[15px] leading-tight font-bold">{d.getDate()}</span>
              {/* Meals Indicator Dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-all ${
                  hasMeals
                    ? isSelected
                      ? "bg-primary-fixed"
                      : "bg-primary"
                    : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Monthly Calendar Modal */}
      {showMonthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-[2px]"
            onClick={() => setShowMonthModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="month-calendar-title"
            className="relative w-full max-w-sm bg-surface rounded-[28px] shadow-2xl p-5 flex flex-col gap-4 z-10"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 id="month-calendar-title" className="text-[17px] font-bold text-on-surface">
                {formatMonthYear(modalMonth)}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="الشهر السابق"
                  onClick={handlePrevMonth}
                  className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
                <button
                  type="button"
                  aria-label="الشهر القادم"
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center active:scale-90"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setShowMonthModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-90 ms-1"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {AR_WEEKDAYS_SHORT.map((wd) => (
                <span key={wd} className="text-[11px] font-semibold text-on-surface-variant py-1">
                  {wd}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Blank cells */}
              {Array.from({ length: monthGrid.leadingBlanks }).map((_, idx) => (
                <div key={`blank-${idx}`} className="h-10" />
              ))}

              {monthGrid.daysInMonth.map((d) => {
                const isSelected = isSameDay(d, selectedDate);
                const isCurrentToday = isSameDay(d, today);
                const dateKey = localDateString(d);
                const hasMeals = (daySummaries[dateKey]?.count ?? 0) > 0;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      onSelectDate(d);
                      setShowMonthModal(false);
                    }}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center relative active:scale-90 transition-all ${
                      isSelected
                        ? "bg-primary text-on-primary font-bold shadow-md shadow-primary/20"
                        : isCurrentToday
                        ? "bg-surface-container border border-primary/50 text-on-surface font-semibold"
                        : "hover:bg-surface-container-low text-on-surface"
                    }`}
                  >
                    <span className="text-[14px] leading-none">{d.getDate()}</span>
                    {hasMeals && (
                      <span
                        className={`w-1 h-1 rounded-full mt-1 ${
                          isSelected ? "bg-primary-fixed" : "bg-primary"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer quick jumps */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  onSelectDate(now);
                  setModalMonth(startOfMonth(now));
                  setShowMonthModal(false);
                }}
                className="text-[13px] font-semibold text-secondary hover:underline"
              >
                الانتقال إلى اليوم
              </button>
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="px-4 py-1.5 rounded-xl bg-surface-container-low text-on-surface text-[13px] font-semibold active:scale-95"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
