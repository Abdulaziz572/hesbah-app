import { supabase } from "./supabaseClient";
import { calcMacros, sumMacros, type Macros, type ReviewItem } from "./nutrition";
import { eachDay, endOfDay, isSameDay, localDateString, startOfDay } from "./dates";

export { localDateString };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** Display order + Arabic labels shared by the review screen, diary and edit sheet. */
export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "فطور", icon: "bakery_dining" },
  { value: "lunch", label: "غداء", icon: "lunch_dining" },
  { value: "dinner", label: "عشاء", icon: "dinner_dining" },
  { value: "snack", label: "سناك", icon: "cookie" },
];

export const isMealType = (v: unknown): v is MealType =>
  MEAL_TYPES.some((t) => t.value === v);

/** 5-11 breakfast, 11-16 lunch, 16-19 snack, 19-02 dinner, 02-05 snack (local time). */
export function guessMealType(d = new Date()): MealType {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 19 || h < 2) return "dinner";
  return "snack";
}

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("يجب تسجيل الدخول أولاً");
  }
  return user;
}

const cleanTitle = (t?: string | null) => {
  const v = (t ?? "").trim().slice(0, 120);
  return v || null;
};

export interface SaveMealOptions {
  mealType?: MealType;
  title?: string;
  /**
   * Log the meal on this (local) day instead of today, e.g. a missed meal picked in the
   * calendar. The time-of-day is the current time so ordering within the day stays sensible.
   */
  targetDate?: Date;
}

/** The moment a meal is stamped with: now for today, otherwise target day at the current clock time. */
function eatenAtFor(targetDate: Date | undefined, now: Date): Date {
  if (!targetDate || isSameDay(targetDate, now)) return now;
  const d = startOfDay(targetDate);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}

export async function saveMeal(
  rows: ReviewItem[],
  grams: number[],
  options: SaveMealOptions = {},
): Promise<void> {
  let user;
  try {
    user = await requireUser();
  } catch {
    throw new Error("يجب تسجيل الدخول أولاً لحفظ الوجبة");
  }

  const now = new Date();
  const eatenAt = eatenAtFor(options.targetDate, now);
  const macros = rows.map((r, i) => calcMacros(r.food, grams[i]));
  const totals = sumMacros(macros);

  const { data: meal, error } = await supabase
    .from("meals")
    .insert({
      user_id: user.id,
      eaten_at: eatenAt.toISOString(),
      local_date: localDateString(eatenAt),
      meal_type: options.mealType && isMealType(options.mealType) ? options.mealType : guessMealType(now),
      meal_title_ar: cleanTitle(options.title),
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
  /** Per-100g values captured when the meal was saved; used to recompute on edit. */
  per100g: Macros;
}

export interface DiaryMeal {
  id: string;
  /** Local calendar day the meal belongs to (YYYY-MM-DD). */
  localDate: string;
  eatenAt: string;
  mealType: string | null;
  title: string | null;
  totals: Macros;
  items: DiaryItem[];
}

interface MealRow {
  id: string;
  eaten_at: string;
  local_date: string;
  meal_type: string | null;
  meal_title_ar: string | null;
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

const toDate = (d: Date | string): Date => {
  if (d instanceof Date) return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
};

/**
 * Meals (with items) whose local day falls in [start-of-day(startDate), end-of-day(endDate)].
 * Uses the `local_date` column, which is stamped with the device's local calendar day when the
 * meal is saved, so day boundaries stay correct regardless of UTC offsets.
 */
async function queryMeals(startDate: Date, endDate: Date): Promise<DiaryMeal[]> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("meals")
    .select(
      "id, eaten_at, local_date, meal_type, meal_title_ar, totals, meal_items(id, grams, per_100g_snapshot, nutrients, foods(name_ar, name_en))",
    )
    .eq("user_id", user.id)
    .gte("local_date", localDateString(startOfDay(startDate)))
    .lte("local_date", localDateString(endOfDay(endDate)))
    .order("eaten_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as MealRow[]).map((m) => {
    const items = (m.meal_items ?? []).map((it) => {
      const grams = num(it.grams);
      const snap = it.per_100g_snapshot;
      const kcal =
        it.nutrients?.calories != null
          ? num(it.nutrients.calories)
          : (num(snap?.calories) * grams) / 100;
      return {
        id: it.id,
        name: it.nutrients?.name_ar || it.foods?.name_ar || it.nutrients?.name_en || it.foods?.name_en || "عنصر",
        grams,
        calories: kcal,
        per100g: {
          calories: num(snap?.calories),
          protein: num(snap?.protein),
          carbs: num(snap?.carbs),
          fat: num(snap?.fat),
        },
      };
    });
    return {
      id: m.id,
      localDate: m.local_date,
      eatenAt: m.eaten_at,
      mealType: m.meal_type,
      title: m.meal_title_ar,
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

/** All meals of one local day (defaults to today). Accepts a Date or a YYYY-MM-DD key. */
export async function fetchMealsForDay(date: Date | string = new Date()): Promise<DiaryMeal[]> {
  const d = toDate(date);
  return queryMeals(d, d);
}

/** All meals (with items) of the signed-in user between two local days, inclusive. */
export async function fetchMealsForDateRange(startDate: Date, endDate: Date): Promise<DiaryMeal[]> {
  return queryMeals(startDate, endDate);
}

export interface DaySummary extends Macros {
  /** Number of meals logged that day. */
  count: number;
}

/**
 * Lightweight per-day totals for a range (no items): powers calendar dots and the weekly chart.
 * The result has an entry for EVERY day in the range (count 0 when nothing was logged).
 */
export async function fetchDaySummaries(
  startDate: Date,
  endDate: Date,
): Promise<Record<string, DaySummary>> {
  const result: Record<string, DaySummary> = {};
  for (const d of eachDay(startDate, endDate)) {
    result[localDateString(d)] = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return result;

  const { data, error } = await supabase
    .from("meals")
    .select("local_date, totals")
    .eq("user_id", user.id)
    .gte("local_date", localDateString(startOfDay(startDate)))
    .lte("local_date", localDateString(endOfDay(endDate)));
  if (error) throw error;

  for (const row of (data ?? []) as { local_date: string; totals: Partial<Macros> | null }[]) {
    const day = result[row.local_date];
    if (!day) continue;
    day.count += 1;
    day.calories += num(row.totals?.calories);
    day.protein += num(row.totals?.protein);
    day.carbs += num(row.totals?.carbs);
    day.fat += num(row.totals?.fat);
  }
  return result;
}

/**
 * Delete a meal owned by the signed-in user. `meal_items.meal_id` is ON DELETE CASCADE,
 * so its items are removed by the database.
 */
export async function deleteMeal(mealId: string): Promise<void> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("meals")
    .delete()
    .eq("id", mealId)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw error;
  // RLS silently filters rows you don't own; make "nothing deleted" a visible failure.
  if (!data || data.length === 0) throw new Error("تعذّر حذف الوجبة (لم تعد موجودة)");
}

export interface UpdateMealData {
  title?: string;
  meal_type?: MealType;
  /**
   * The items to KEEP, with their new grams. Existing items of the meal that are not
   * listed here are deleted. At least one item is required (delete the meal instead).
   */
  items: { id: string; grams: number }[];
}

interface StoredItem {
  id: string;
  grams: number | string;
  per_100g_snapshot: Partial<Macros> | null;
  nutrients: (Partial<Macros> & { name_ar?: string; name_en?: string }) | null;
}

/**
 * Update a saved meal's title/category and its items' grams (removing dropped items),
 * recomputing each item's nutrients and the meal totals from the stored per-100g snapshot.
 */
export async function updateMeal(mealId: string, updatedData: UpdateMealData): Promise<void> {
  const user = await requireUser();

  if (updatedData.meal_type !== undefined && !isMealType(updatedData.meal_type)) {
    throw new Error("نوع الوجبة غير صالح");
  }
  if (!updatedData.items.length) {
    throw new Error("يجب أن تحتوي الوجبة على مكوّن واحد على الأقل. احذف الوجبة بدلاً من ذلك.");
  }

  // Read current items (RLS limits this to the user's own meals; the meals filter double-checks).
  const { data: meal, error: mealErr } = await supabase
    .from("meals")
    .select("id, meal_items(id, grams, per_100g_snapshot, nutrients)")
    .eq("id", mealId)
    .eq("user_id", user.id)
    .single();
  if (mealErr || !meal) throw mealErr ?? new Error("الوجبة غير موجودة");

  const stored = new Map(
    ((meal as unknown as { meal_items: StoredItem[] }).meal_items ?? []).map((it) => [it.id, it]),
  );

  const keep = updatedData.items.map((u) => {
    const it = stored.get(u.id);
    if (!it) throw new Error("أحد المكونات غير موجود في هذه الوجبة");
    const grams = Math.max(0, Math.min(5000, num(u.grams)));
    const snap = it.per_100g_snapshot ?? {};
    const f = grams / 100;
    const macros: Macros = {
      calories: num(snap.calories) * f,
      protein: num(snap.protein) * f,
      carbs: num(snap.carbs) * f,
      fat: num(snap.fat) * f,
    };
    return { it, grams, macros, changed: grams !== num(it.grams) };
  });

  const keepIds = new Set(keep.map((k) => k.it.id));
  const removeIds = [...stored.keys()].filter((id) => !keepIds.has(id));
  const totals = sumMacros(keep.map((k) => k.macros));

  // 1) update changed items
  const updates = await Promise.all(
    keep
      .filter((k) => k.changed)
      .map((k) =>
        supabase
          .from("meal_items")
          .update({ grams: k.grams, nutrients: { ...(k.it.nutrients ?? {}), ...k.macros } })
          .eq("id", k.it.id)
          .eq("meal_id", mealId)
          .select("id"),
      ),
  );
  for (const r of updates) {
    if (r.error) throw r.error;
    if (!r.data?.length) throw new Error("تعذّر تحديث أحد المكونات");
  }

  // 2) delete removed items
  if (removeIds.length) {
    const { error } = await supabase
      .from("meal_items")
      .delete()
      .eq("meal_id", mealId)
      .in("id", removeIds);
    if (error) throw error;
  }

  // 3) update the meal row (title, category, totals)
  const patch: Record<string, unknown> = {
    totals,
    estimated_kcal: Math.round(totals.calories),
  };
  if (updatedData.title !== undefined) patch.meal_title_ar = cleanTitle(updatedData.title);
  if (updatedData.meal_type !== undefined) patch.meal_type = updatedData.meal_type;

  const { data: updated, error: updErr } = await supabase
    .from("meals")
    .update(patch)
    .eq("id", mealId)
    .eq("user_id", user.id)
    .select("id");
  if (updErr) throw updErr;
  if (!updated?.length) throw new Error("تعذّر تحديث الوجبة");
}
