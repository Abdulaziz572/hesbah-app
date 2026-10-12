"use client";

import { useState } from "react";
import type { MealDraft } from "@/src/lib/ai/types";
import { buildReviewItems, type ReviewItem } from "@/src/lib/nutrition";
import DescribeScreen from "./DescribeScreen";
import ReviewScreen from "./ReviewScreen";

export default function MealFlow() {
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [rows, setRows] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(text: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.items)) {
        throw new Error(data?.error || "تعذّر تحليل الوجبة");
      }
      const resolved = await buildReviewItems((data as MealDraft).items);
      setRows(resolved);
      setDraft(data as MealDraft);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof TypeError
          ? "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً."
          : "حدث خطأ أثناء تحليل الوجبة. حاول مرة أخرى.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full mx-auto min-h-screen flex flex-col">
      <header className="h-16 px-4 flex items-center justify-between sticky top-0 z-10 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-fixed flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">nutrition</span>
          </div>
          <div>
            <span className="text-[18px] font-bold text-on-surface block leading-tight">حسبة</span>
            <span className="text-[11px] text-on-surface-variant block">تسجيل وجبة جديدة</span>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-2">
        {draft ? (
          <ReviewScreen key={draft.dish_name?.en + String(rows.length)} draft={draft} initialRows={rows} onBack={() => setDraft(null)} />
        ) : (
          <DescribeScreen onAnalyze={analyze} loading={loading} error={error} />
        )}
      </main>
    </div>
  );
}
