import { supabase } from "./supabaseClient";
import { calcMacros, sumMacros, type Macros, type ReviewItem } from "./nutrition";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** YYYY-MM-DD in the device's local timezone. */
export function localDateString(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function guessMealType(d = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 18 && h < 23) return "dinner";
  return "snack";
}

export async function saveMeal(rows: ReviewItem[], grams: number[]): Promise<void> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new Error("يجب تسجيل الدخول أولاً لحفظ الوجبة");
  }

  const now = new Date();
  const macros = rows.map((r, i) => calcMacros(r.food, grams[i]));
  const totals = sumMacros(macros);

  const { data: meal, error } = await supabase
    .from("meals")
    .insert({
      user_id: user.id,
      eaten_at: now.toISOString(),
      local_date: localDateString(now),
      meal_type: guessMealType(now),
      origin: "ai_text",
      totals,
      estimated_kcal: Math.round(totals.calories),
    })
    .select("id")
    .single();
  if (error || !meal) throw error ?? new Error("Failed to save meal");

  const items = rows.map((r, i) => ({
    meal_id: meal.id,
    food_id: r.food && r.food.source === "db" && UUID_RE.test(r.food.id) ? r.food.id : null,
    grams: grams[i],
    quality: !r.food ? "unmatched" : r.food.source === "ai" ? "ai_estimate" : "db",
    per_100g_snapshot: r.food?.per100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
    nutrients: {
      ...macros[i],
      name_ar: r.parsed.name_ar,
      name_en: r.parsed.name_en,
    },
  }));

  if (items.length) {
    const { error: itemsErr } = await supabase.from("meal_items").insert(items);
    if (itemsErr) {
      await supabase.from("meals").delete().eq("id", meal.id);
      throw itemsErr;
    }
  }
}

export interface DiaryItem {
  id: string;
  name: string;
  grams: number;
  calories: number;
}

export interface DiaryMeal {
  id: string;
  eatenAt: string;
  mealType: string | null;
  totals: Macros;
  items: DiaryItem[];
}

interface MealRow {
  id: string;
  eaten_at: string;
  meal_type: string | null;
  totals: Partial<Macros> | null;
  meal_items: {
    id: string;
    grams: number | string;
    per_100g_snapshot: Partial<Macros> | null;
    nutrients: (Partial<Macros> & { name_ar?: string; name_en?: string }) | null;
    foods: { name_ar?: string; name_en?: string } | null;
  }[];
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function fetchMealsForDay(date = localDateString()): Promise<DiaryMeal[]> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("meals")
    .select(
      "id, eaten_at, meal_type, totals, meal_items(id, grams, per_100g_snapshot, nutrients, foods(name_ar, name_en))",
    )
    .eq("user_id", user.id)
    .eq("local_date", date)
    .order("eaten_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as MealRow[]).map((m) => {
    const items = (m.meal_items ?? []).map((it) => {
      const grams = num(it.grams);
      const kcal =
        it.nutrients?.calories != null
          ? num(it.nutrients.calories)
          : (num(it.per_100g_snapshot?.calories) * grams) / 100;
      return {
        id: it.id,
        name: it.nutrients?.name_ar || it.foods?.name_ar || it.nutrients?.name_en || it.foods?.name_en || "عنصر",
        grams,
        calories: kcal,
      };
    });
    return {
      id: m.id,
      eatenAt: m.eaten_at,
      mealType: m.meal_type,
      totals: {
        calories: num(m.totals?.calories),
        protein: num(m.totals?.protein),
        carbs: num(m.totals?.carbs),
        fat: num(m.totals?.fat),
      },
      items,
    };
  });
}
