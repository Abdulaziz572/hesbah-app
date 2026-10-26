"use client";

import React from "react";

/**
 * Lightweight RTL Skeleton for Calorie Ring Summary Card.
 * Matches exact height (184px) and layout of the real Calorie Ring.
 */
export function CalorieRingSkeleton() {
  return (
    <section
      aria-label="جارٍ تحميل ملخص السعرات"
      className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-outline-variant/20 flex items-center gap-5 animate-pulse"
    >
      <div className="w-36 h-36 rounded-full bg-surface-container shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-28 rounded-md bg-surface-container" />
        <div className="h-8 w-20 rounded-md bg-surface-container" />
        <div className="h-3 w-16 rounded-md bg-surface-container" />
      </div>
    </section>
  );
}

/**
 * Lightweight RTL Skeleton for the 3 Macronutrient Cards (Protein, Carbs, Fat).
 * Matches exact height and 3-column flex layout.
 */
export function MacroCardsSkeleton() {
  return (
    <section aria-label="جارٍ تحميل المغذيات" className="flex gap-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex-1 bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col items-center gap-1.5 border border-outline-variant/20"
        >
          <div className="h-5 w-14 rounded-md bg-surface-container" />
          <div className="h-3 w-10 rounded-md bg-surface-container" />
          <div className="w-full h-1 mt-1 rounded-full bg-surface-container" />
          <div className="h-3 w-12 rounded-md bg-surface-container" />
        </div>
      ))}
    </section>
  );
}

/**
 * Lightweight RTL Skeleton for Meals Timeline.
 */
export function MealsTimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" aria-busy="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-28 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-16 h-6 rounded-full bg-surface-container" />
              <div className="w-12 h-4 rounded-md bg-surface-container" />
            </div>
            <div className="w-16 h-5 rounded-md bg-surface-container" />
          </div>
          <div className="h-4 w-3/4 rounded-md bg-surface-container" />
          <div className="h-3 w-1/2 rounded-md bg-surface-container" />
        </div>
      ))}
    </div>
  );
}

/**
 * Lightweight RTL Skeleton for WeeklySummaryCard.
 */
export function WeeklySummarySkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-[24px] p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-surface-container" />
          <div className="flex flex-col gap-1">
            <div className="h-4 w-24 rounded-md bg-surface-container" />
            <div className="h-3 w-32 rounded-md bg-surface-container" />
          </div>
        </div>
        <div className="h-5 w-20 rounded-md bg-surface-container" />
      </div>
      <div className="h-28 rounded-xl bg-surface-container-low flex items-end justify-between p-2 gap-1">
        {[40, 65, 30, 85, 50, 70, 45].map((h, idx) => (
          <div
            key={idx}
            className="flex-1 bg-surface-container rounded-t-lg"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Lightweight RTL Skeleton for Profile Settings view.
 */
export function ProfileSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
      <div className="h-32 rounded-[20px] bg-surface-container-lowest border border-outline-variant/20 p-4 flex flex-col justify-between" />
      <div className="h-28 rounded-[20px] bg-surface-container-lowest border border-outline-variant/20 p-4" />
      <div className="h-40 rounded-[20px] bg-surface-container-lowest border border-outline-variant/20 p-4" />
    </div>
  );
}
