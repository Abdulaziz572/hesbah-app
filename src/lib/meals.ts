import { supabase } from "./supabaseClient";
import {
  calcMacros,
  sumMacros,
  calculateItemMacros,
  calculateMealTotals,
  normalizeMacroNutrients,
  createMacroNutrients,
  type Macros,
  type MacroNutrients,
  type ReviewItem,
} from "./nutrition";
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
  /** Personal context for the meal (e.g. "post-gym meal"). */
  customNote?: string | null;
  /** Bookmark the meal as a reusable template. */
  isSaved?: boolean;
}

// ---------- Custom note / saved flag: DB columns with localStorage fallback ----------

/** null = unknown yet, false = columns missing in the DB (run supabase_migration.sql). */
let extrasSupported: boolean | null = null;

interface LocalExtra {
  note?: string;
  saved?: boolean;
}

const extrasKey = (uid: string) => `hesbah:meal-extras:v1:${uid}`;

function readLocalExtras(uid: string): Record<string, LocalExtra> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(extrasKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalExtras(uid: string, map: Record<string, LocalExtra>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(extrasKey(uid), JSON.stringify(map));
  } catch {
    /* storage full / blocked: the feature degrades to DB-only */
  }
}

/** True when a Supabase error means custom_note / is_saved do not exist yet. */
function isMissingExtrasColumn(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string; details?: string };
  const str = `${e.code ?? ""} ${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    e.code === "42703" ||
    e.code === "PGRST204" ||
    e.code === "PGRST200" ||
    str.includes("custom_note") ||
    str.includes("is_saved") ||
    str.includes("42703")
  );
}

/** Identity of a meal "template": same title and same foods/grams are the same meal. */
export function mealSignature(
  title: string | null | undefined,
  items: { name: string; grams: number }[],
): string {
  const parts = items.map((it) => `${it.name.trim()}:${Math.round(Number(it.grams) || 0)}`).sort();
  return `${(title ?? "").trim()}|${parts.join(",")}`;
}

const cleanNote = (n?: string | null) => {
  const v = (n ?? "").trim().slice(0, 500);
  return v || null;
};

export interface MealExtrasSource {
  /** Row to update in the DB (the representative meal). Optional for local-only writes. */
  id?: string;
  title?: string | null;
  items: { name: string; grams: number }[];
}

/**
 * Save the personal note and/or bookmark flag of a meal. Always written locally (so it works
 * before the SQL migration); also written to the DB when the columns exist.
 */
export async function setMealExtras(
  source: MealExtrasSource,
  patch: { note?: string | null; saved?: boolean },
): Promise<void> {
  const user = await requireUser();
  const sig = mealSignature(source.title, source.items);
  const map = readLocalExtras(user.id);
  const cur: LocalExtra = { ...map[sig] };
  if (patch.note !== undefined) cur.note = cleanNote(patch.note) ?? undefined;
  if (patch.saved !== undefined) cur.saved = patch.saved || undefined;
  if (!cur.note && !cur.saved) delete map[sig];
  else map[sig] = cur;
  writeLocalExtras(user.id, map);

  if (source.id && UUID_RE.test(source.id) && extrasSupported !== false) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.note !== undefined) dbPatch.custom_note = cleanNote(patch.note);
    if (patch.saved !== undefined) dbPatch.is_saved = patch.saved;
    const { error } = await supabase
      .from("meals")
      .update(dbPatch)
      .eq("id", source.id)
      .eq("user_id", user.id);
    if (error) {
      if (isMissingExtrasColumn(error)) extrasSupported = false;
      else console.warn("[meals] extras DB update failed; kept locally", error);
    } else {
      extrasSupported = true;
    }
  }
}

/** The moment a meal is stamped with: now for today, otherwise target day at the current clock time. */
function eatenAtFor(targetDate: Date | undefined, now: Date): Date {
  if (!targetDate || isSameDay(targetDate, now)) return now;
  const d = startOfDay(targetDate);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}

export interface MealItemToSave {
  name: string;
  grams: number;
  per100g: Macros | MacroNutrients;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  food_id?: string | null;
  quality?: string;
}

export async function saveMealItems(
  itemsToSave: MealItemToSave[],
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
  const macros = itemsToSave.map((it) => ({
    calories: it.calories,
    protein: it.protein,
    carbs: it.carbs,
    fat: it.fat,
  }));
  const totals = sumMacros(macros);

  const baseRow = {
    user_id: user.id,
    eaten_at: eatenAt.toISOString(),
    local_date: localDateString(eatenAt),
    meal_type: options.mealType && isMealType(options.mealType) ? options.mealType : guessMealType(now),
    meal_title_ar: cleanTitle(options.title),
    origin: "ai_text",
    totals,
    estimated_kcal: Math.round(totals.calories),
  };
  const note = cleanNote(options.customNote);
  const wantsExtras = !!note || !!options.isSaved;

  let inserted = null as { id: string } | null;
  let insertErr: unknown = null;
  if (wantsExtras && extrasSupported !== false) {
    const r = await supabase
      .from("meals")
      .insert({ ...baseRow, custom_note: note, is_saved: !!options.isSaved })
      .select("id")
      .single();
    if (r.error && isMissingExtrasColumn(r.error)) extrasSupported = false;
    else {
      inserted = r.data;
      insertErr = r.error;
      if (!r.error) extrasSupported = true;
    }
  }
  if (!inserted && !insertErr) {
    const r = await supabase.from("meals").insert(baseRow).select("id").single();
    inserted = r.data;
    insertErr = r.error;
  }
  const meal = inserted;
  const error = insertErr;
  if (error || !meal) throw error ?? new Error("Failed to save meal");

  if (wantsExtras) {
    // Local copy keeps the note/bookmark alive before the migration is applied.
    const sig = mealSignature(baseRow.meal_title_ar, itemsToSave);
    const map = readLocalExtras(user.id);
    const cur: LocalExtra = { ...map[sig] };
    if (note) cur.note = note;
    if (options.isSaved) cur.saved = true;
    map[sig] = cur;
    writeLocalExtras(user.id, map);
  }

  const items = itemsToSave.map((it) => {
    const normPer100g = normalizeMacroNutrients(it.per100g);
    const derived = calculateItemMacros(normPer100g, it.grams);
    const cal = it.calories != null && Number.isFinite(it.calories) ? Math.round(it.calories) : derived.calories;
    const prot = it.protein != null && Number.isFinite(it.protein) ? Math.round(it.protein * 10) / 10 : derived.protein_g;
    const carbs = it.carbs != null && Number.isFinite(it.carbs) ? Math.round(it.carbs * 10) / 10 : derived.carbs_g;
    const fat = it.fat != null && Number.isFinite(it.fat) ? Math.round(it.fat * 10) / 10 : derived.fat_g;

    return {
      meal_id: meal.id,
      food_id: it.food_id && UUID_RE.test(it.food_id) ? it.food_id : null,
      grams: it.grams,
      quality: it.quality || "user_edit",
      per_100g_snapshot: normPer100g,
      nutrients: {
        calories: cal,
        protein: prot,
        carbs,
        fat,
        name_ar: it.name,
      },
    };
  });

  if (items.length) {
    const { error: itemsErr } = await supabase.from("meal_items").insert(items);
    if (itemsErr) {
      await supabase.from("meals").delete().eq("id", meal.id);
      throw itemsErr;
    }
  }
}

export async function saveMeal(
  rows: ReviewItem[],
  grams: number[],
  options: SaveMealOptions = {},
): Promise<void> {
  const itemsToSave: MealItemToSave[] = rows.map((r, i) => {
    const m = calcMacros(r.food, grams[i]);
    return {
      name: r.parsed.name_ar || r.parsed.name_en || r.food?.name_ar || r.food?.name_en || "صنف",
      grams: grams[i],
      per100g: r.food?.per100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
      calories: Math.round(m.calories),
      protein: Math.round(m.protein * 10) / 10,
      carbs: Math.round(m.carbs * 10) / 10,
      fat: Math.round(m.fat * 10) / 10,
      food_id: r.food && r.food.source === "db" && UUID_RE.test(r.food.id) ? r.food.id : null,
      quality: !r.food ? "unmatched" : r.food.source === "ai" ? "ai_estimate" : "db",
    };
  });
  return saveMealItems(itemsToSave, options);
}

export interface DiaryItem {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  /** Personal context written by the user (custom_note). */
  customNote?: string | null;
  /** Bookmarked as a reusable template (is_saved). */
  isSaved?: boolean;
}

interface MealRow {
  id: string;
  eaten_at: string;
  local_date: string;
  meal_type: string | null;
  meal_title_ar: string | null;
  totals: Partial<Macros> | null;
  custom_note?: string | null;
  is_saved?: boolean | null;
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
async function queryMeals(startDate: Date, endDate: Date, explicitUserId?: string): Promise<DiaryMeal[]> {
  let userId = explicitUserId;
  if (!userId) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return [];
    }
    userId = user.id;
  }

  const baseCols =
    "id, eaten_at, local_date, meal_type, meal_title_ar, totals, meal_items(id, grams, per_100g_snapshot, nutrients, foods(name_ar, name_en))";
  const run = (cols: string) =>
    supabase
      .from("meals")
      .select(cols)
      .eq("user_id", userId)
      .gte("local_date", localDateString(startOfDay(startDate)))
      .lte("local_date", localDateString(endOfDay(endDate)))
      .order("eaten_at", { ascending: true });

  let res =
    extrasSupported === false ? await run(baseCols) : await run(`${baseCols}, custom_note, is_saved`);
  if (res.error && extrasSupported !== false && isMissingExtrasColumn(res.error)) {
    extrasSupported = false;
    res = await run(baseCols);
  } else if (!res.error && extrasSupported === null) {
    extrasSupported = true;
  }
  const { data, error } = res;
  if (error) throw error;

  const localExtras = readLocalExtras(userId);

  return ((data ?? []) as unknown as MealRow[]).map((m) => {
    const items = (m.meal_items ?? []).map((it) => {
      const grams = num(it.grams);
      const snapNorm = normalizeMacroNutrients(it.per_100g_snapshot);
      const nutNorm = normalizeMacroNutrients(it.nutrients);

      // Backward compatibility recovery:
      // If per_100g_snapshot was empty or zero in legacy DB rows, but nutrients has positive calories:
      if (snapNorm.calories === 0 && nutNorm.calories > 0 && grams > 0) {
        const factor = 100 / grams;
        snapNorm.calories = Math.round(nutNorm.calories * factor);
        snapNorm.protein_g = Math.round(nutNorm.protein_g * factor * 10) / 10;
        snapNorm.carbs_g = Math.round(nutNorm.carbs_g * factor * 10) / 10;
        snapNorm.fat_g = Math.round(nutNorm.fat_g * factor * 10) / 10;
      }

      // If nutrients was explicitly stored with positive calories, preserve it; otherwise derive deterministically
      const itemMacros = nutNorm.calories > 0 ? nutNorm : calculateItemMacros(snapNorm, grams);

      return {
        id: it.id,
        name: it.nutrients?.name_ar || it.foods?.name_ar || it.nutrients?.name_en || it.foods?.name_en || "عنصر",
        grams,
        calories: itemMacros.calories,
        protein: itemMacros.protein_g,
        carbs: itemMacros.carbs_g,
        fat: itemMacros.fat_g,
        per100g: {
          calories: snapNorm.calories,
          protein: snapNorm.protein_g,
          carbs: snapNorm.carbs_g,
          fat: snapNorm.fat_g,
          protein_g: snapNorm.protein_g,
          carbs_g: snapNorm.carbs_g,
          fat_g: snapNorm.fat_g,
        },
      };
    });
    const local = localExtras[mealSignature(m.meal_title_ar, items)];
    const totalsNorm = normalizeMacroNutrients(m.totals);
    const finalTotals =
      totalsNorm.calories > 0
        ? totalsNorm
        : calculateMealTotals(items.map((it) => ({ per_100g: it.per100g, grams: it.grams })));

    return {
      id: m.id,
      localDate: m.local_date,
      eatenAt: m.eaten_at,
      mealType: m.meal_type,
      title: m.meal_title_ar,
      totals: {
        calories: finalTotals.calories,
        protein: finalTotals.protein_g,
        carbs: finalTotals.carbs_g,
        fat: finalTotals.fat_g,
      },
      items,
      customNote: cleanNote(m.custom_note) ?? local?.note ?? null,
      isSaved: !!m.is_saved || !!local?.saved,
    };
  });
}

/** A deduplicated meal template built from the user's history. */
export interface PreviousMeal {
  signature: string;
  /** Most recent occurrence; its items/totals are what gets copied. */
  meal: DiaryMeal;
  /** How many times the user logged this exact meal. */
  count: number;
  isSaved: boolean;
  customNote: string | null;
}

/**
 * Previous meals without any AI call: the last ~6 months of history, deduplicated by
 * title + foods + grams. Bookmarked meals come first, then the most recent.
 */
export async function fetchPreviousMeals(days = 180, limit = 60, userId?: string): Promise<PreviousMeal[]> {
  const end = new Date();
  const start = addDaysLocal(end, -days);
  const all = await queryMeals(start, end, userId);
  const groups = new Map<string, PreviousMeal>();
  for (const m of all) {
    if (m.items.length === 0) continue;
    const sig = mealSignature(m.title, m.items);
    const g = groups.get(sig);
    if (!g) {
      groups.set(sig, {
        signature: sig,
        meal: m,
        count: 1,
        isSaved: !!m.isSaved,
        customNote: m.customNote ?? null,
      });
    } else {
      g.count += 1;
      g.isSaved = g.isSaved || !!m.isSaved;
      if (m.eatenAt > g.meal.eatenAt) {
        g.meal = m;
        g.customNote = m.customNote ?? null;
      }
    }
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        Number(b.isSaved) - Number(a.isSaved) || (a.meal.eatenAt < b.meal.eatenAt ? 1 : -1),
    )
    .slice(0, limit);
}

function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Log a copy of an existing meal (default: today) without calling the AI. The copy keeps the
 * foods, grams, title, type and personal note.
 */
export async function copyMealToDate(meal: DiaryMeal, targetDate: Date = new Date()): Promise<void> {
  await saveMealItems(
    meal.items.map((it) => ({
      name: it.name,
      grams: it.grams,
      per100g: it.per100g,
      calories: it.calories,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      quality: "user_edit",
    })),
    {
      mealType: isMealType(meal.mealType) ? meal.mealType : undefined,
      title: meal.title ?? undefined,
      targetDate,
      customNote: meal.customNote,
    },
  );
}

/** All meals of one local day (defaults to today). Accepts a Date or a YYYY-MM-DD key. */
export async function fetchMealsForDay(date: Date | string = new Date(), userId?: string): Promise<DiaryMeal[]> {
  const d = toDate(date);
  return queryMeals(d, d, userId);
}

/** All meals (with items) of the signed-in user between two local days, inclusive. */
export async function fetchMealsForDateRange(startDate: Date, endDate: Date, userId?: string): Promise<DiaryMeal[]> {
  return queryMeals(startDate, endDate, userId);
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
  explicitUserId?: string,
): Promise<Record<string, DaySummary>> {
  const result: Record<string, DaySummary> = {};
  for (const d of eachDay(startDate, endDate)) {
    result[localDateString(d)] = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  }

  let userId = explicitUserId;
  if (!userId) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return result;
    userId = user.id;
  }

  const { data, error } = await supabase
    .from("meals")
    .select("local_date, totals")
    .eq("user_id", userId)
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

export interface UpdateMealItemInput {
  id?: string;
  name: string;
  grams: number;
  per100g: Macros | MacroNutrients;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface UpdateMealData {
  title?: string;
  meal_type?: MealType;
  /**
   * The items to preserve or add. Items with an existing ID are updated; items without
   * an ID are inserted as new meal items. Items in DB not present here are removed.
   */
  items?: UpdateMealItemInput[];
  /** Optional manual override for total calories/macros. */
  totals?: Macros;
  /** Personal note (custom_note); empty string clears it. */
  customNote?: string;
  /** Bookmark flag (is_saved). */
  isSaved?: boolean;
}

interface StoredItem {
  id: string;
  grams: number | string;
  per_100g_snapshot: Partial<Macros> | null;
  nutrients: (Partial<Macros> & { name_ar?: string; name_en?: string }) | null;
}

/**
 * Update a saved meal's title, category, individual items (updating, adding, removing),
 * and totals. Fully supports manual macro overrides and empty items.
 */
export async function updateMeal(mealId: string, updatedData: UpdateMealData): Promise<void> {
  const user = await requireUser();

  if (updatedData.meal_type !== undefined && !isMealType(updatedData.meal_type)) {
    throw new Error("نوع الوجبة غير صالح");
  }

  // Read current meal and items
  const { data: meal, error: mealErr } = await supabase
    .from("meals")
    .select("id, totals, meal_items(id, grams, per_100g_snapshot, nutrients)")
    .eq("id", mealId)
    .eq("user_id", user.id)
    .single();
  if (mealErr || !meal) throw mealErr ?? new Error("الوجبة غير موجودة");

  const stored = new Map(
    ((meal as unknown as { meal_items: StoredItem[] }).meal_items ?? []).map((it) => [it.id, it]),
  );

  let finalTotals: Macros;

  if (updatedData.items !== undefined && updatedData.items.length > 0) {
    const keepIds = new Set<string>();
    const newItemsToInsert: {
      meal_id: string;
      grams: number;
      quality: string;
      per_100g_snapshot: Macros | MacroNutrients;
      nutrients: Macros & { name_ar: string };
    }[] = [];
    const itemMacrosList: Macros[] = [];

    for (const itemInput of updatedData.items) {
      const grams = Math.max(0, Math.min(5000, num(itemInput.grams)));
      const snap = normalizeMacroNutrients(itemInput.per100g);
      const derived = calculateItemMacros(snap, grams);
      const cal = itemInput.calories != null && Number.isFinite(itemInput.calories) ? Math.round(num(itemInput.calories)) : derived.calories;
      const prot = itemInput.protein != null && Number.isFinite(itemInput.protein) ? Math.round(num(itemInput.protein) * 10) / 10 : derived.protein_g;
      const carbs = itemInput.carbs != null && Number.isFinite(itemInput.carbs) ? Math.round(num(itemInput.carbs) * 10) / 10 : derived.carbs_g;
      const fat = itemInput.fat != null && Number.isFinite(itemInput.fat) ? Math.round(num(itemInput.fat) * 10) / 10 : derived.fat_g;

      const macroItem: Macros = { calories: cal, protein: prot, carbs, fat, protein_g: prot, carbs_g: carbs, fat_g: fat };
      itemMacrosList.push(macroItem);

      if (itemInput.id && stored.has(itemInput.id)) {
        keepIds.add(itemInput.id);
        const { error: updErr } = await supabase
          .from("meal_items")
          .update({
            grams,
            per_100g_snapshot: snap,
            nutrients: {
              calories: cal,
              protein: prot,
              carbs,
              fat,
              name_ar: itemInput.name,
            },
          })
          .eq("id", itemInput.id)
          .eq("meal_id", mealId);
        if (updErr) throw updErr;
      } else {
        newItemsToInsert.push({
          meal_id: mealId,
          grams,
          quality: "user_edit",
          per_100g_snapshot: snap,
          nutrients: {
            calories: cal,
            protein: prot,
            carbs,
            fat,
            name_ar: itemInput.name,
          },
        });
      }
    }

    // Delete removed items
    const toDeleteIds = [...stored.keys()].filter((id) => !keepIds.has(id));
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabase
        .from("meal_items")
        .delete()
        .eq("meal_id", mealId)
        .in("id", toDeleteIds);
      if (delErr) throw delErr;
    }

    // Insert new items
    if (newItemsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("meal_items").insert(newItemsToInsert);
      if (insErr) throw insErr;
    }

    finalTotals = updatedData.totals ?? sumMacros(itemMacrosList);
  } else if (updatedData.items !== undefined && updatedData.items.length === 0) {
    // Items explicitly cleared
    if (stored.size > 0) {
      const { error: delAllErr } = await supabase
        .from("meal_items")
        .delete()
        .eq("meal_id", mealId);
      if (delAllErr) throw delAllErr;
    }
    finalTotals = updatedData.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  } else {
    // Items not passed
    finalTotals = updatedData.totals ?? {
      calories: num((meal as unknown as { totals?: Partial<Macros> }).totals?.calories),
      protein: num((meal as unknown as { totals?: Partial<Macros> }).totals?.protein),
      carbs: num((meal as unknown as { totals?: Partial<Macros> }).totals?.carbs),
      fat: num((meal as unknown as { totals?: Partial<Macros> }).totals?.fat),
    };
  }

  // Update meal row
  const patch: Record<string, unknown> = {
    totals: finalTotals,
    estimated_kcal: Math.round(finalTotals.calories),
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

  // Note / bookmark go through setMealExtras so they also survive a missing migration.
  if (updatedData.customNote !== undefined || updatedData.isSaved !== undefined) {
    const { data: fresh } = await supabase
      .from("meals")
      .select("meal_title_ar, meal_items(grams, nutrients, foods(name_ar, name_en))")
      .eq("id", mealId)
      .single();
    const row = fresh as unknown as {
      meal_title_ar: string | null;
      meal_items: {
        grams: number | string;
        nutrients: { name_ar?: string; name_en?: string } | null;
        foods: { name_ar?: string; name_en?: string } | null;
      }[];
    } | null;
    if (row) {
      await setMealExtras(
        {
          id: mealId,
          title: row.meal_title_ar,
          items: (row.meal_items ?? []).map((it) => ({
            name:
              it.nutrients?.name_ar || it.foods?.name_ar || it.nutrients?.name_en || it.foods?.name_en || "عنصر",
            grams: num(it.grams),
          })),
        },
        { note: updatedData.customNote, saved: updatedData.isSaved },
      );
    }
  }
}
