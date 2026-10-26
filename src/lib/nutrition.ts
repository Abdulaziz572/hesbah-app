import type {
  ParsedItem,
  MacroNutrients,
  MealItem,
  FoodState,
  MacroSource,
  FoodCategory,
} from "./ai/types";
import { findFood } from "./foodLookup";
import { supabase } from "./supabaseClient";

export type { MacroNutrients, MealItem, FoodState, MacroSource, FoodCategory };

export interface FoodNutrition {
  id: string;
  name_ar: string;
  name_en: string;
  /** "db" = Supabase foods table / curated reference; "ai" = Gemini per-100g estimate. */
  source: "db" | "ai";
  /** Values per 100g (or 100ml for drinks), read from the `per_100g` JSONB column. */
  per100g: MacroNutrients;
  category?: FoodCategory;
  default_portion_g?: number;
  reference_unit_g?: number;
  uncertainty_level?: "low" | "medium" | "high";
  verification_notes?: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface ReviewItem {
  key: string;
  parsed: ParsedItem;
  food: FoodNutrition | null;
  grams: number;
}

/**
 * Creates a valid, clean MacroNutrients object with sanitized positive numbers
 * rounded to standard precision (calories integer, macros 1 decimal place).
 */
export function createMacroNutrients(
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
): MacroNutrients {
  const p = Math.max(0, Number.isFinite(protein_g) ? protein_g : 0);
  const c = Math.max(0, Number.isFinite(carbs_g) ? carbs_g : 0);
  const f = Math.max(0, Number.isFinite(fat_g) ? fat_g : 0);
  const cal = Math.max(0, Number.isFinite(calories) ? calories : 0);
  const roundedProt = Math.round(p * 10) / 10;
  const roundedCarbs = Math.round(c * 10) / 10;
  const roundedFat = Math.round(f * 10) / 10;
  return {
    calories: Math.round(cal),
    protein_g: roundedProt,
    carbs_g: roundedCarbs,
    fat_g: roundedFat,
  };
}

/**
 * Normalizes any legacy or variant JSON/object into canonical MacroNutrients.
 * Handles: 'kcal' vs 'calories', 'protein_g' vs 'protein', stringified numbers, etc.
 */
export function normalizeMacroNutrients(raw: unknown): MacroNutrients {
  if (!raw || typeof raw !== "object") {
    return createMacroNutrients(0, 0, 0, 0);
  }
  const obj = raw as Record<string, unknown>;
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    lower[k.toLowerCase()] = obj[k];
  }

  const pickNum = (keys: string[]): number => {
    for (const k of keys) {
      const v = lower[k.toLowerCase()];
      if (v !== undefined && v !== null) {
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  };

  const calories = pickNum(["calories", "kcal", "energy_kcal", "calories_kcal", "cal", "energy"]);
  const protein_g = pickNum(["protein_g", "protein", "proteins"]);
  const carbs_g = pickNum(["carbs_g", "carbs", "carbohydrates", "carbohydrates_g", "carb"]);
  const fat_g = pickNum(["fat_g", "fat", "fats", "total_fat"]);

  return createMacroNutrients(calories, protein_g, carbs_g, fat_g);
}

/**
 * Single source of truth calculation:
 * Deterministically derives item totals from its per_100g base.
 * Guaranteed never to double-scale.
 * macro = round((per_100g.macro * grams) / 100)
 */
export function calculateItemMacros(
  per_100g: MacroNutrients | Macros,
  grams: number,
): MacroNutrients {
  if (!Number.isFinite(grams) || grams <= 0) {
    return createMacroNutrients(0, 0, 0, 0);
  }
  const norm = normalizeMacroNutrients(per_100g);
  const factor = grams / 100;
  return createMacroNutrients(
    norm.calories * factor,
    norm.protein_g * factor,
    norm.carbs_g * factor,
    norm.fat_g * factor,
  );
}

/**
 * Sums an array of items or macro records deterministically.
 */
export function calculateMealTotals(
  items: Array<{ per_100g: MacroNutrients | Macros; grams: number } | MacroNutrients | Macros>,
): MacroNutrients {
  let cal = 0;
  let p = 0;
  let c = 0;
  let f = 0;

  for (const item of items) {
    if ("per_100g" in item && "grams" in item) {
      const m = calculateItemMacros(item.per_100g, item.grams);
      cal += m.calories;
      p += m.protein_g;
      c += m.carbs_g;
      f += m.fat_g;
    } else {
      const m = normalizeMacroNutrients(item);
      cal += m.calories;
      p += m.protein_g;
      c += m.carbs_g;
      f += m.fat_g;
    }
  }

  return createMacroNutrients(cal, p, c, f);
}

/** Legacy wrapper for calcMacros */
export function calcMacros(
  food: { per100g: MacroNutrients | Macros } | null,
  grams: number,
): Macros {
  if (!food || !Number.isFinite(grams) || grams <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  const res = calculateItemMacros(food.per100g, grams);
  return {
    calories: res.calories,
    protein: res.protein_g,
    carbs: res.carbs_g,
    fat: res.fat_g,
    protein_g: res.protein_g,
    carbs_g: res.carbs_g,
    fat_g: res.fat_g,
  };
}

/** Legacy wrapper for sumMacros */
export function sumMacros(list: (Macros | MacroNutrients)[]): Macros {
  const res = calculateMealTotals(list);
  return {
    calories: res.calories,
    protein: res.protein_g,
    carbs: res.carbs_g,
    fat: res.fat_g,
    protein_g: res.protein_g,
    carbs_g: res.carbs_g,
    fat_g: res.fat_g,
  };
}

/**
 * Infer item category from Arabic and English naming when category is not set.
 */
function inferFoodCategory(item: MealItem): FoodCategory | undefined {
  if (item.category) return item.category;
  const name = ((item.display_name_ar || "") + " " + (item.canonical_name || "")).toLowerCase();
  if (/تميس|صامولي|مفرود|خبز|مطبق|معصوب|عيش|pita|bread|pastry/.test(name)) return "bread_pastry";
  if (/رز|أرز|بشاور|مضغوط|بخاري|rice/.test(name)) return "rice_grain";
  if (/تمر|رطب|بلح|dates|fruit/.test(name)) return "fruit_dates";
  if (/دجاج|لحم|غنم|حاشي|شواية|chicken|meat|beef|lamb/.test(name)) return "meat_poultry";
  if (/جريش|قرصان|سليق|مرقوق/.test(name)) return "traditional_dish";
  if (/فول|عدس|حمص|دال|beans|lentil/.test(name)) return "legume";
  if (/سمبوسة|شاورما|فلافل|برجر|shawarma|burger/.test(name)) return "snack_fastfood";
  return undefined;
}

/**
 * Pure deterministic guardrail enforcing biological & physical limits:
 * 1. Impossible Macro Sum Check: P + C + F <= 100g per 100g.
 * 2. Category Protein Ceilings:
 *    - bread_pastry: clamp protein to max 14g/100g. If portion_assumed && grams > 150, clamp grams to default_portion_g.
 *    - rice_grain: clamp protein to max 5g/100g.
 *    - fruit_dates: clamp protein to max 4g/100g.
 * 3. Atwater Calorie Consistency Check:
 *    expectedCalories = (P * 4) + (C * 4) + (F * 9).
 *    If |calories - expectedCalories| / expectedCalories > 20% and diff > 25, reconcile calories = expectedCalories.
 */
export function applyPlausibilityChecks(item: MealItem): MealItem {
  const result: MealItem = {
    ...item,
    per_100g: { ...item.per_100g },
  };

  const warnings: string[] = [];
  if (result.plausibility_warning) {
    warnings.push(result.plausibility_warning);
  }

  const category = inferFoodCategory(result) || result.category;
  result.category = category;

  let { protein_g, carbs_g, fat_g, calories } = result.per_100g;

  // 1. Impossible Macro Sum Check (per 100g): protein + carbs + fat <= 100g
  const macroSum = protein_g + carbs_g + fat_g;
  if (macroSum > 100) {
    const scale = 100 / macroSum;
    protein_g = Math.round(protein_g * scale * 10) / 10;
    carbs_g = Math.round(carbs_g * scale * 10) / 10;
    fat_g = Math.round(fat_g * scale * 10) / 10;
    warnings.push("تم ضبط مجموع العناصر الغذائية ليتناسب مع الحد الفيزيائي الأقصى (100جم)");
  }

  // 2. Category Protein Ceilings (Anti-Hallucination)
  if (category === "bread_pastry") {
    if (protein_g > 14) {
      protein_g = 14;
      warnings.push("تم ضبط نسبة البروتين للحد الأقصى للمخبوزات (14جم/100جم)");
    }
    if (result.portion_assumed && result.grams > 150) {
      const defPortion = result.default_portion_g || 90;
      result.grams = defPortion;
      warnings.push(`تم اعتماد الحصة الافتراضية للمخبوزات (${defPortion}جم) بدلاً من الرغيف الكامل`);
    }
  } else if (category === "rice_grain") {
    if (protein_g > 5) {
      protein_g = 5;
      warnings.push("تم ضبط نسبة البروتين للأرز للحد المنطقي (5جم/100جم)");
    }
  } else if (category === "fruit_dates") {
    if (protein_g > 4) {
      protein_g = 4;
      warnings.push("تم ضبط نسبة البروتين للتمور والفواكه للحد المنطقي (4جم/100جم)");
    }
  }

  // 3. Atwater Calorie Consistency Check
  const expectedCalories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  if (expectedCalories > 0) {
    const diff = Math.abs(calories - expectedCalories);
    const pctDiff = diff / expectedCalories;
    if (pctDiff > 0.20 && diff > 25) {
      calories = expectedCalories;
      warnings.push("تمت مواءمة السعرات حتمياً وفق معادلة أتووتر (Atwater)");
    }
  }

  result.per_100g = createMacroNutrients(calories, protein_g, carbs_g, fat_g);
  result.plausibility_warning = warnings.length > 0 ? warnings.join(" • ") : null;

  return result;
}

/** Look up every AI item in Supabase / Curated dataset and seed realistic portions. */
export async function buildReviewItems(items: ParsedItem[]): Promise<ReviewItem[]> {
  return Promise.all(
    items.map(async (parsed, i) => {
      let food: FoodNutrition | null = null;
      try {
        food = await findFood(parsed);
      } catch (e) {
        console.error("[foods] lookup failed:", e);
      }

      let grams = 0;
      // 1. If fraction_of_reference is provided (e.g. 0.25, 0.5) and reference unit exists
      if (
        parsed.fraction_of_reference != null &&
        parsed.fraction_of_reference > 0 &&
        food?.reference_unit_g
      ) {
        grams = Math.round(food.reference_unit_g * parsed.fraction_of_reference);
      } else if (parsed.extracted_grams != null && parsed.extracted_grams > 0) {
        // 2. Exact user-extracted grams
        grams = parsed.extracted_grams;
      } else if (parsed.portion_assumed && food?.default_portion_g) {
        // 3. Portion was assumed: use default curated portion
        grams = food.default_portion_g;
      } else {
        // 4. Fallback to range midpoint or default portion
        const min = Number(parsed.quantity?.grams_min) || 0;
        const max = Number(parsed.quantity?.grams_max) || 0;
        grams = Math.round((min + max) / 2);
        if (grams <= 0 && food?.default_portion_g) {
          grams = food.default_portion_g;
        }
      }

      return {
        key: `${i}-${parsed.name_en}`,
        parsed,
        food,
        grams: Math.max(10, grams),
      };
    }),
  );
}

/* ============================================================
 * User profile, TDEE & daily macro targets
 * ============================================================ */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
export type GoalType = "lose" | "maintain" | "gain";

/** Body stats used by the Mifflin-St Jeor formula. */
export interface UserStats {
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal_type: GoalType;
}

export interface DailyTargets {
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
}

/** Mirrors a row of `public.user_profiles`. */
export interface UserProfile extends UserStats, DailyTargets {
  user_id: string;
  is_custom_targets: boolean;
  updated_at?: string;
}

/** Calculated targets plus the intermediate steps, so the UI can show the math. */
export interface TargetBreakdown extends DailyTargets {
  bmr: number;
  multiplier: number;
  tdee: number;
  adjustment: number;
  /** True when the goal adjustment was lifted to the safe minimum. */
  clampedToMinimum: boolean;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export const MIN_DAILY_CALORIES = 1200;

/** Matches the column defaults in `supabase_migration.sql`. */
export const DEFAULT_STATS: UserStats = {
  gender: "male",
  age: 25,
  height_cm: 170,
  weight_kg: 70,
  activity_level: "light",
  goal_type: "maintain",
};

export const DEFAULT_TARGETS: DailyTargets = {
  target_calories: 2000,
  target_protein_g: 140,
  target_carbs_g: 200,
  target_fat_g: 65,
};

/** Sane input bounds shared by the form and the normalizer. */
export const STAT_LIMITS = {
  age: { min: 13, max: 100 },
  height_cm: { min: 120, max: 230 },
  weight_kg: { min: 30, max: 300 },
} as const;

export function calculateDailyTargets(stats: UserStats): TargetBreakdown {
  const { gender, age, height_cm, weight_kg } = stats;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const bmr = gender === "female" ? base - 161 : base + 5;

  const multiplier = ACTIVITY_MULTIPLIERS[stats.activity_level] ?? ACTIVITY_MULTIPLIERS.light;
  const tdee = bmr * multiplier;
  const adjustment = GOAL_ADJUSTMENTS[stats.goal_type] ?? 0;

  const raw = Math.round(tdee + adjustment);
  const target_calories = Math.max(MIN_DAILY_CALORIES, raw);

  const target_protein_g = Math.round(weight_kg * 1.8);
  const target_fat_g = Math.round((target_calories * 0.25) / 9);
  const target_carbs_g = Math.max(
    0,
    Math.round((target_calories - target_protein_g * 4 - target_fat_g * 9) / 4),
  );

  return {
    bmr: Math.round(bmr),
    multiplier,
    tdee: Math.round(tdee),
    adjustment,
    clampedToMinimum: raw < MIN_DAILY_CALORIES,
    target_calories,
    target_protein_g,
    target_carbs_g,
    target_fat_g,
  };
}

/** Calories implied by a macro split (4/4/9 kcal per gram). */
export function caloriesFromMacros(t: Pick<DailyTargets, "target_protein_g" | "target_carbs_g" | "target_fat_g">) {
  return t.target_protein_g * 4 + t.target_carbs_g * 4 + t.target_fat_g * 9;
}

export function defaultProfile(userId: string): UserProfile {
  const calc = calculateDailyTargets(DEFAULT_STATS);
  return {
    user_id: userId,
    ...DEFAULT_STATS,
    target_calories: calc.target_calories,
    target_protein_g: calc.target_protein_g,
    target_carbs_g: calc.target_carbs_g,
    target_fat_g: calc.target_fat_g,
    is_custom_targets: false,
  };
}

/** Targets to use for a (possibly missing) profile. */
export function resolveTargets(profile: UserProfile | null): DailyTargets {
  if (!profile) return DEFAULT_TARGETS;
  return {
    target_calories: profile.target_calories,
    target_protein_g: profile.target_protein_g,
    target_carbs_g: profile.target_carbs_g,
    target_fat_g: profile.target_fat_g,
  };
}

export const getProfileCacheKey = (userId: string) => `hesbah_user_profile_${userId}`;
export const getProfileConfiguredKey = (userId: string) => `hesbah_profile_configured_${userId}`;
const LEGACY_PROFILE_CACHE_KEY = "hesbah_user_profile";

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const num = (v: unknown, fallback: number) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Coerce a DB row / cached JSON into a well-formed profile. */
function normalizeProfile(row: Record<string, unknown>, userId: string): UserProfile {
  return {
    user_id: userId,
    gender: pick(row.gender, ["male", "female"] as const, DEFAULT_STATS.gender),
    age: Math.round(num(row.age, DEFAULT_STATS.age)),
    height_cm: num(row.height_cm, DEFAULT_STATS.height_cm),
    weight_kg: num(row.weight_kg, DEFAULT_STATS.weight_kg),
    activity_level: pick(
      row.activity_level,
      ["sedentary", "light", "moderate", "active"] as const,
      DEFAULT_STATS.activity_level,
    ),
    goal_type: pick(row.goal_type, ["lose", "maintain", "gain"] as const, DEFAULT_STATS.goal_type),
    target_calories: Math.round(num(row.target_calories, DEFAULT_TARGETS.target_calories)),
    target_protein_g: Math.round(num(row.target_protein_g, DEFAULT_TARGETS.target_protein_g)),
    target_carbs_g: Math.round(num(row.target_carbs_g, DEFAULT_TARGETS.target_carbs_g)),
    target_fat_g: Math.round(num(row.target_fat_g, DEFAULT_TARGETS.target_fat_g)),
    is_custom_targets: Boolean(row.is_custom_targets),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

/** Check if the user has explicitly configured their profile. */
export function isProfileConfigured(userId: string, profile?: UserProfile | null): boolean {
  if (!userId) return false;
  if (typeof window !== "undefined") {
    if (window.localStorage.getItem(getProfileConfiguredKey(userId)) === "true") {
      return true;
    }
  }
  if (profile) {
    if (profile.is_custom_targets) return true;
    if (profile.updated_at) return true;
    const diff =
      profile.gender !== DEFAULT_STATS.gender ||
      profile.age !== DEFAULT_STATS.age ||
      profile.height_cm !== DEFAULT_STATS.height_cm ||
      profile.weight_kg !== DEFAULT_STATS.weight_kg ||
      profile.activity_level !== DEFAULT_STATS.activity_level ||
      profile.goal_type !== DEFAULT_STATS.goal_type ||
      profile.target_calories !== DEFAULT_TARGETS.target_calories;
    if (diff) return true;
  }
  const cached = getCachedUserProfile(userId);
  if (cached && (cached.updated_at || cached.is_custom_targets)) return true;
  return false;
}

/** Synchronous read of the locally cached profile (null if absent or for another account). */
export function getCachedUserProfile(userId: string): UserProfile | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    // 1. Try scoped key first
    const scopedRaw = window.localStorage.getItem(getProfileCacheKey(userId));
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw) as Record<string, unknown>;
      return normalizeProfile(parsed, userId);
    }
    // 2. Fallback to legacy un-scoped key and migrate if matched
    const legacyRaw = window.localStorage.getItem(LEGACY_PROFILE_CACHE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Record<string, unknown>;
      if (parsed?.user_id === userId || !parsed?.user_id) {
        const norm = normalizeProfile(parsed, userId);
        writeCache(norm);
        return norm;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(profile: UserProfile) {
  if (typeof window === "undefined" || !profile?.user_id) return;
  try {
    window.localStorage.setItem(getProfileCacheKey(profile.user_id), JSON.stringify(profile));
    window.localStorage.setItem(getProfileConfiguredKey(profile.user_id), "true");
    window.localStorage.setItem(LEGACY_PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    /* storage full or unavailable */
  }
}

function toRow(p: UserProfile) {
  return {
    user_id: p.user_id,
    gender: p.gender,
    age: Math.round(p.age),
    height_cm: p.height_cm,
    weight_kg: p.weight_kg,
    activity_level: p.activity_level,
    goal_type: p.goal_type,
    target_calories: Math.round(p.target_calories),
    target_protein_g: Math.round(p.target_protein_g),
    target_carbs_g: Math.round(p.target_carbs_g),
    target_fat_g: Math.round(p.target_fat_g),
    is_custom_targets: p.is_custom_targets,
    updated_at: p.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Load the user's profile. Supabase is the source of truth; localStorage is the
 * fallback (offline, or before the migration has been run).
 * Returns null when the user has never saved a profile.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  const cached = getCachedUserProfile(userId);
  try {
    // 1. Try public.user_profiles
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      const remote = normalizeProfile(data as Record<string, unknown>, userId);
      const localTime = cached?.updated_at ? Date.parse(cached.updated_at) : NaN;
      const remoteTime = remote.updated_at ? Date.parse(remote.updated_at) : NaN;
      if (cached && localTime > remoteTime) {
        void supabase.from("user_profiles").upsert(toRow(cached), { onConflict: "user_id" });
        return cached;
      }
      writeCache(remote);
      return remote;
    }

    // 2. Fallback to public.profiles.interim_targets if user_profiles table is not ready
    try {
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("interim_targets")
        .eq("id", userId)
        .maybeSingle();
      if (!pErr && pData?.interim_targets && typeof pData.interim_targets === "object") {
        const remote = normalizeProfile(pData.interim_targets as Record<string, unknown>, userId);
        writeCache(remote);
        return remote;
      }
    } catch {
      // ignore
    }

    // 3. No remote row yet: if cached exists, attempt to push up and return it
    if (cached) {
      void (async () => {
        try {
          await supabase.from("user_profiles").upsert(toRow(cached), { onConflict: "user_id" });
        } catch {
          // ignore
        }
        try {
          await supabase.from("profiles").upsert({ id: userId, interim_targets: toRow(cached) });
        } catch {
          // ignore
        }
      })();
    }
    return cached;
  } catch (e) {
    console.warn("[profile] Supabase unavailable, using local cache:", e);
    return cached;
  }
}

export interface SaveProfileResult {
  profile: UserProfile;
  /** False when the save only reached localStorage. */
  synced: boolean;
}

/** Save locally first (instant + offline-safe), then upsert to Supabase. */
export async function saveUserProfile(profile: UserProfile): Promise<SaveProfileResult> {
  const stamped: UserProfile = { ...profile, updated_at: new Date().toISOString() };
  writeCache(stamped);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getProfileConfiguredKey(profile.user_id), "true");
  }
  let synced = false;
  let resultProfile = stamped;

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(toRow(stamped), { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (!error && data) {
      synced = true;
      resultProfile = normalizeProfile(data as Record<string, unknown>, profile.user_id);
      writeCache(resultProfile);
      return { profile: resultProfile, synced: true };
    }
  } catch (e) {
    console.warn("[profile] user_profiles upsert failed:", e);
  }

  // Also persist to public.profiles.interim_targets as resilient cloud backup
  try {
    const { error: pErr } = await supabase.from("profiles").upsert({
      id: profile.user_id,
      interim_targets: toRow(stamped),
    });
    if (!pErr) {
      synced = true;
    }
  } catch {
    // fallback ignore
  }

  return { profile: resultProfile, synced };
}
