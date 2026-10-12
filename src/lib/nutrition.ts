import type { ParsedItem } from "./ai/types";
import { findFood } from "./foodLookup";

export interface FoodNutrition {
  id: string;
  name_ar: string;
  name_en: string;
  /** "db" = Supabase foods table (high confidence); "ai" = Gemini per-100g estimate. */
  source: "db" | "ai";
  /** Values per 100g (or 100ml for drinks), read from the `per_100g` JSONB column. */
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ReviewItem {
  key: string;
  parsed: ParsedItem;
  food: FoodNutrition | null;
  grams: number;
}

export function calcMacros(food: FoodNutrition | null, grams: number): Macros {
  if (!food || !Number.isFinite(grams) || grams <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const f = grams / 100;
  const p = food.per100g;
  return {
    calories: p.calories * f,
    protein: p.protein * f,
    carbs: p.carbs * f,
    fat: p.fat * f,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Look up every AI item in Supabase (in parallel) and seed grams from the AI range midpoint. */
export async function buildReviewItems(items: ParsedItem[]): Promise<ReviewItem[]> {
  return Promise.all(
    items.map(async (parsed, i) => {
      const min = Number(parsed.quantity?.grams_min) || 0;
      const max = Number(parsed.quantity?.grams_max) || 0;
      let food: FoodNutrition | null = null;
      try {
        food = await findFood(parsed);
      } catch (e) {
        console.error("[foods] lookup failed:", e);
      }
      return {
        key: `${i}-${parsed.name_en}`,
        parsed,
        food,
        grams: Math.round((min + max) / 2),
      };
    }),
  );
}
