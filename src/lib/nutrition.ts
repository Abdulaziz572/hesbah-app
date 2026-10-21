import type { ParsedItem } from "./ai/types";
import { findFood } from "./foodLookup";
import { supabase } from "./supabaseClient";

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

const PROFILE_CACHE_KEY = "hesbah_user_profile";

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

/** Synchronous read of the locally cached profile (null if absent or for another account). */
export function getCachedUserProfile(userId: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.user_id !== userId) return null;
    return normalizeProfile(parsed, userId);
  } catch {
    return null;
  }
}

function writeCache(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
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
  const cached = getCachedUserProfile(userId);
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const remote = normalizeProfile(data as Record<string, unknown>, userId);
      // Keep a locally newer save (made while offline) instead of overwriting it.
      const localTime = cached?.updated_at ? Date.parse(cached.updated_at) : NaN;
      const remoteTime = remote.updated_at ? Date.parse(remote.updated_at) : NaN;
      if (cached && localTime > remoteTime) {
        void supabase.from("user_profiles").upsert(toRow(cached), { onConflict: "user_id" });
        return cached;
      }
      writeCache(remote);
      return remote;
    }

    // No row yet: push a locally saved profile up so it syncs once the table exists.
    if (cached) {
      void supabase.from("user_profiles").upsert(toRow(cached), { onConflict: "user_id" });
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
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(toRow(stamped), { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    // Cache the server's copy so local and remote timestamps agree.
    const saved = data ? normalizeProfile(data as Record<string, unknown>, profile.user_id) : stamped;
    writeCache(saved);
    return { profile: saved, synced: true };
  } catch (e) {
    console.warn("[profile] saved locally only:", e);
    return { profile: stamped, synced: false };
  }
}
