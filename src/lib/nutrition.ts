import type {
  ParsedItem,
  MacroNutrients,
  MealItem,
  FoodState,
  MacroSource,
  FoodCategory,
} from "./ai/types";
import { findFood } from "./foodLookup";
import { localDateString } from "./dates";
import { supabase } from "./supabaseClient";

export type { MacroNutrients, MealItem, FoodState, MacroSource, FoodCategory };

export interface FoodNutrition {
  id: string;
  name_ar: string;
  name_en: string;
  /** "db" = Supabase foods table / curated reference; "ai" = Gemini per-100g estimate. */
  source: "db" | "ai";
  /** Values per 100g (or 100ml for drinks), read from the `per_100g` JSONB column. */
  per_100g: MacroNutrients;
  category?: FoodCategory;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
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
 * rounded to standard precision (calories integer, macros 1 decimal place, micros properly rounded).
 */
export function createMacroNutrients(
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
  micros?: Partial<Omit<MacroNutrients, "calories" | "protein_g" | "carbs_g" | "fat_g">>,
): MacroNutrients {
  const p = Math.max(0, Number.isFinite(protein_g) ? protein_g : 0);
  const c = Math.max(0, Number.isFinite(carbs_g) ? carbs_g : 0);
  const f = Math.max(0, Number.isFinite(fat_g) ? fat_g : 0);
  const cal = Math.max(0, Number.isFinite(calories) ? calories : 0);
  const roundedProt = Math.round(p * 10) / 10;
  const roundedCarbs = Math.round(c * 10) / 10;
  const roundedFat = Math.round(f * 10) / 10;

  const result: MacroNutrients = {
    calories: Math.round(cal),
    protein_g: roundedProt,
    carbs_g: roundedCarbs,
    fat_g: roundedFat,
  };

  if (micros) {
    if (micros.fiber_g !== undefined && Number.isFinite(micros.fiber_g)) {
      result.fiber_g = Math.max(0, Math.round(micros.fiber_g * 10) / 10);
    }
    if (micros.sugar_g !== undefined && Number.isFinite(micros.sugar_g)) {
      result.sugar_g = Math.max(0, Math.round(micros.sugar_g * 10) / 10);
    }
    if (micros.added_sugar_g !== undefined && Number.isFinite(micros.added_sugar_g)) {
      result.added_sugar_g = Math.max(0, Math.round(micros.added_sugar_g * 10) / 10);
    }
    if (micros.saturated_fat_g !== undefined && Number.isFinite(micros.saturated_fat_g)) {
      result.saturated_fat_g = Math.max(0, Math.round(micros.saturated_fat_g * 10) / 10);
    }
    if (micros.cholesterol_mg !== undefined && Number.isFinite(micros.cholesterol_mg)) {
      result.cholesterol_mg = Math.max(0, Math.round(micros.cholesterol_mg * 10) / 10);
    }
    if (micros.sodium_mg !== undefined && Number.isFinite(micros.sodium_mg)) {
      result.sodium_mg = Math.max(0, Math.round(micros.sodium_mg));
    }
    if (micros.potassium_mg !== undefined && Number.isFinite(micros.potassium_mg)) {
      result.potassium_mg = Math.max(0, Math.round(micros.potassium_mg));
    }
    if (micros.magnesium_mg !== undefined && Number.isFinite(micros.magnesium_mg)) {
      result.magnesium_mg = Math.max(0, Math.round(micros.magnesium_mg));
    }
    if (micros.calcium_mg !== undefined && Number.isFinite(micros.calcium_mg)) {
      result.calcium_mg = Math.max(0, Math.round(micros.calcium_mg));
    }
    if (micros.iron_mg !== undefined && Number.isFinite(micros.iron_mg)) {
      result.iron_mg = Math.max(0, Math.round(micros.iron_mg * 100) / 100);
    }
    if (micros.zinc_mg !== undefined && Number.isFinite(micros.zinc_mg)) {
      result.zinc_mg = Math.max(0, Math.round(micros.zinc_mg * 100) / 100);
    }
  }

  return result;
}

/**
 * Normalizes any legacy or variant JSON/object into canonical MacroNutrients
 * including Athlete Micronutrients & Electrolytes.
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

  const pickNum = (keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = lower[k.toLowerCase()];
      if (v !== undefined && v !== null && v !== "" && v !== "-") {
        const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
    return undefined;
  };

  const calories = pickNum(["calories", "kcal", "energy_kcal", "calories_kcal", "cal", "energy"]) ?? 0;
  const protein_g = pickNum(["protein_g", "protein", "proteins"]) ?? 0;
  // Available carbs fallback to total carbs if "-" or missing
  const carbs_g = pickNum([
    "carbs_g",
    "carbs",
    "carbohydrates_available",
    "available_carbohydrates",
    "carbohydrates",
    "carbohydrates_g",
    "carb",
  ]) ?? 0;
  const fat_g = pickNum(["fat_g", "fat", "fats", "total_fat"]) ?? 0;

  const micros: Partial<Omit<MacroNutrients, "calories" | "protein_g" | "carbs_g" | "fat_g">> = {};

  const fiber = pickNum(["fiber_g", "fiber", "dietary_fiber", "total_fiber", "fibers"]);
  if (fiber !== undefined) micros.fiber_g = fiber;

  const sugar = pickNum(["sugar_g", "sugar", "sugars", "total_sugars", "total_sugar"]);
  if (sugar !== undefined) micros.sugar_g = sugar;

  const addedSugar = pickNum(["added_sugar_g", "added_sugar", "added_sugars", "addedsugars"]);
  if (addedSugar !== undefined) micros.added_sugar_g = addedSugar;

  const satFat = pickNum([
    "saturated_fat_g",
    "saturated_fat",
    "sat_fat",
    "saturated_fatty_acids",
    "satfat_g",
    "satfat",
  ]);
  if (satFat !== undefined) micros.saturated_fat_g = satFat;

  const chol = pickNum(["cholesterol_mg", "cholesterol", "chol"]);
  if (chol !== undefined) micros.cholesterol_mg = chol;

  const na = pickNum(["sodium_mg", "sodium", "na_mg", "na"]);
  if (na !== undefined) micros.sodium_mg = na;

  const kVal = pickNum(["potassium_mg", "potassium", "k_mg", "k"]);
  if (kVal !== undefined) micros.potassium_mg = kVal;

  const mg = pickNum(["magnesium_mg", "magnesium", "mg_mg", "mag"]);
  if (mg !== undefined) micros.magnesium_mg = mg;

  const ca = pickNum(["calcium_mg", "calcium", "ca_mg", "ca"]);
  if (ca !== undefined) micros.calcium_mg = ca;

  const fe = pickNum(["iron_mg", "iron", "fe_mg", "fe"]);
  if (fe !== undefined) micros.iron_mg = fe;

  const zn = pickNum(["zinc_mg", "zinc", "zn_mg", "zn"]);
  if (zn !== undefined) micros.zinc_mg = zn;

  return createMacroNutrients(calories, protein_g, carbs_g, fat_g, micros);
}

/**
 * Single source of truth calculation:
 * Deterministically derives item totals from its per_100g base.
 * Guaranteed never to double-scale.
 * Scales core macros and all athlete micronutrients.
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

  const scaledMicros: Partial<Omit<MacroNutrients, "calories" | "protein_g" | "carbs_g" | "fat_g">> = {};
  if (norm.fiber_g !== undefined) scaledMicros.fiber_g = Math.round(norm.fiber_g * factor * 10) / 10;
  if (norm.sugar_g !== undefined) scaledMicros.sugar_g = Math.round(norm.sugar_g * factor * 10) / 10;
  if (norm.added_sugar_g !== undefined) scaledMicros.added_sugar_g = Math.round(norm.added_sugar_g * factor * 10) / 10;
  if (norm.saturated_fat_g !== undefined) scaledMicros.saturated_fat_g = Math.round(norm.saturated_fat_g * factor * 10) / 10;
  if (norm.cholesterol_mg !== undefined) scaledMicros.cholesterol_mg = Math.round(norm.cholesterol_mg * factor * 10) / 10;
  if (norm.sodium_mg !== undefined) scaledMicros.sodium_mg = Math.round(norm.sodium_mg * factor);
  if (norm.potassium_mg !== undefined) scaledMicros.potassium_mg = Math.round(norm.potassium_mg * factor);
  if (norm.magnesium_mg !== undefined) scaledMicros.magnesium_mg = Math.round(norm.magnesium_mg * factor);
  if (norm.calcium_mg !== undefined) scaledMicros.calcium_mg = Math.round(norm.calcium_mg * factor);
  if (norm.iron_mg !== undefined) scaledMicros.iron_mg = Math.round(norm.iron_mg * factor * 100) / 100;
  if (norm.zinc_mg !== undefined) scaledMicros.zinc_mg = Math.round(norm.zinc_mg * factor * 100) / 100;

  return createMacroNutrients(
    norm.calories * factor,
    norm.protein_g * factor,
    norm.carbs_g * factor,
    norm.fat_g * factor,
    scaledMicros,
  );
}

/**
 * Sums an array of items or macro records deterministically,
 * summing core macros and accumulating athlete micronutrients if present.
 */
export function calculateMealTotals(
  items: Array<{ per_100g: MacroNutrients | Macros; grams: number } | MacroNutrients | Macros>,
): MacroNutrients {
  let cal = 0;
  let p = 0;
  let c = 0;
  let f = 0;

  let hasFiber = false, fiber = 0;
  let hasSugar = false, sugar = 0;
  let hasAddedSugar = false, addedSugar = 0;
  let hasSatFat = false, satFat = 0;
  let hasChol = false, chol = 0;
  let hasNa = false, na = 0;
  let hasK = false, k = 0;
  let hasMg = false, mg = 0;
  let hasCa = false, ca = 0;
  let hasFe = false, fe = 0;
  let hasZn = false, zn = 0;

  for (const item of items) {
    const m =
      "per_100g" in item && "grams" in item
        ? calculateItemMacros(item.per_100g, item.grams)
        : normalizeMacroNutrients(item);

    cal += m.calories;
    p += m.protein_g;
    c += m.carbs_g;
    f += m.fat_g;

    if (m.fiber_g !== undefined) { hasFiber = true; fiber += m.fiber_g; }
    if (m.sugar_g !== undefined) { hasSugar = true; sugar += m.sugar_g; }
    if (m.added_sugar_g !== undefined) { hasAddedSugar = true; addedSugar += m.added_sugar_g; }
    if (m.saturated_fat_g !== undefined) { hasSatFat = true; satFat += m.saturated_fat_g; }
    if (m.cholesterol_mg !== undefined) { hasChol = true; chol += m.cholesterol_mg; }
    if (m.sodium_mg !== undefined) { hasNa = true; na += m.sodium_mg; }
    if (m.potassium_mg !== undefined) { hasK = true; k += m.potassium_mg; }
    if (m.magnesium_mg !== undefined) { hasMg = true; mg += m.magnesium_mg; }
    if (m.calcium_mg !== undefined) { hasCa = true; ca += m.calcium_mg; }
    if (m.iron_mg !== undefined) { hasFe = true; fe += m.iron_mg; }
    if (m.zinc_mg !== undefined) { hasZn = true; zn += m.zinc_mg; }
  }

  const micros: Partial<Omit<MacroNutrients, "calories" | "protein_g" | "carbs_g" | "fat_g">> = {};
  if (hasFiber) micros.fiber_g = Math.round(fiber * 10) / 10;
  if (hasSugar) micros.sugar_g = Math.round(sugar * 10) / 10;
  if (hasAddedSugar) micros.added_sugar_g = Math.round(addedSugar * 10) / 10;
  if (hasSatFat) micros.saturated_fat_g = Math.round(satFat * 10) / 10;
  if (hasChol) micros.cholesterol_mg = Math.round(chol * 10) / 10;
  if (hasNa) micros.sodium_mg = Math.round(na);
  if (hasK) micros.potassium_mg = Math.round(k);
  if (hasMg) micros.magnesium_mg = Math.round(mg);
  if (hasCa) micros.calcium_mg = Math.round(ca);
  if (hasFe) micros.iron_mg = Math.round(fe * 100) / 100;
  if (hasZn) micros.zinc_mg = Math.round(zn * 100) / 100;

  return createMacroNutrients(cal, p, c, f, micros);
}

/** Legacy wrapper for calcMacros */
export function calcMacros(
  food: { per_100g: MacroNutrients | Macros } | null,
  grams: number,
): Macros {
  if (!food || !Number.isFinite(grams) || grams <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  const res = calculateItemMacros(food.per_100g, grams);
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
 * Converts a nutrient value from an arbitrary serving basis (`basisGrams`) to per-100g ONCE at the boundary.
 */
export const toPer100 = (val: number, basisGrams: number): number =>
  basisGrams > 0 && Number.isFinite(val) ? (val * 100) / basisGrams : 0;

export interface NormalizeItemInput {
  id?: string;
  name_ar?: string;
  name_en?: string;
  name?: string;
  grams: number;
  /** Canonical per_100g base if already normalized to 100g. */
  per_100g?: Partial<MacroNutrients | Macros> | null;
  /** Serving or total macros if input is from an OCR nutrition label (e.g. 30g scoop = 27g P) or manual entry. */
  serving_macros?: (Partial<MacroNutrients | Macros> & { basis_grams?: number }) | null;
  /** Basis grams for serving_macros (e.g. 30g per scoop, or `grams` for manual entry). */
  basis_grams?: number;
  category?: FoodCategory;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  source?: MacroSource;
  food_id?: string | null;
  reference_unit_g?: number | null;
  default_portion_g?: number | null;
  portion_assumed?: boolean;
}

export interface NormalizedItemResult {
  id: string;
  name: string;
  name_ar: string;
  name_en: string;
  grams: number;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  per_100g: MacroNutrients;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  category?: FoodCategory;
  source: MacroSource;
  food_id?: string | null;
  reference_unit_g?: number | null;
  default_portion_g?: number | null;
  portion_assumed: boolean;
}

/**
 * Unified boundary normalizer for all incoming food items (AI, DB lookup, OCR label, manual edit).
 * Enforces `per_100g` and `grams` as the single source of truth:
 * - Converts `serving_macros` (at `basis_grams`) to `per_100g` ONCE via `toPer100()`.
 * - Never double-scales when `per_100g` is already provided.
 * - Deterministically derives item calories and macros via `calculateItemMacros(per_100g, grams)`.
 */
export function normalizeItem(input: NormalizeItemInput): NormalizedItemResult {
  const safeGrams = Math.max(0, Math.min(5000, Number.isFinite(Number(input.grams)) ? Number(input.grams) : 0));
  const rawPer100 = input.per_100g;
  const basisOverride = input.basis_grams ?? input.serving_macros?.basis_grams;

  let per_100g: MacroNutrients;

  if (rawPer100) {
    const norm = normalizeMacroNutrients(rawPer100);
    if (norm.calories > 0 || norm.protein_g > 0 || norm.carbs_g > 0 || norm.fat_g > 0) {
      per_100g = norm;
    } else if (input.serving_macros) {
      const serv = normalizeMacroNutrients(input.serving_macros);
      const basis = basisOverride && basisOverride > 0 ? basisOverride : safeGrams || 100;
      per_100g = createMacroNutrients(
        toPer100(serv.calories, basis),
        toPer100(serv.protein_g, basis),
        toPer100(serv.carbs_g, basis),
        toPer100(serv.fat_g, basis),
      );
    } else {
      per_100g = norm;
    }
  } else if (input.serving_macros) {
    const serv = normalizeMacroNutrients(input.serving_macros);
    const basis = basisOverride && basisOverride > 0 ? basisOverride : safeGrams || 100;
    per_100g = createMacroNutrients(
      toPer100(serv.calories, basis),
      toPer100(serv.protein_g, basis),
      toPer100(serv.carbs_g, basis),
      toPer100(serv.fat_g, basis),
    );
  } else {
    per_100g = createMacroNutrients(0, 0, 0, 0);
  }

  const derived = calculateItemMacros(per_100g, safeGrams);
  const name_ar = input.name_ar || input.name || input.name_en || "صنف";
  const name_en = input.name_en || input.name || input.name_ar || "item";

  return {
    id: input.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name || name_ar,
    name_ar,
    name_en,
    grams: safeGrams,
    unit_type: input.unit_type || (input.category === "beverage" ? "ml" : "g"),
    item_type: input.item_type,
    size_modifier: input.size_modifier,
    per_100g,
    calories: derived.calories,
    protein: derived.protein_g,
    carbs: derived.carbs_g,
    fat: derived.fat_g,
    protein_g: derived.protein_g,
    carbs_g: derived.carbs_g,
    fat_g: derived.fat_g,
    category: input.category,
    source: input.source || "db_match",
    food_id: input.food_id ?? null,
    reference_unit_g: input.reference_unit_g ?? null,
    default_portion_g: input.default_portion_g ?? null,
    portion_assumed: input.portion_assumed ?? false,
  };
}

/**
 * Normalize Arabic text and strip leading/trailing quantity phrases (e.g. "4 حبات", "رغيف")
 * so category & keyword sanity guards inspect the core food name.
 */
export function cleanFoodNameForMatching(raw: string): string {
  return (raw ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(
      /\b(\d+(\.\d+)?\s*)?(حبه|حبات|حبتين|رغيف|رغيفين|صحن|كوب|ملعقه|ملاعق|سكوب|سكوبين|قطعه|قطع|شريحه|شرائح|جرام|غم|غ|g|gram|grams|pieces|piece|eggs|egg|loaf|scoop|scoops)\b/gi,
      " ",
    )
    .replace(/\b(واحد|واحده|اثنين|ثلاث|ثلاثه|اربع|اربعه|خمس|خمسه|ست|سته|سبع|سبعه)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Hard Macro Sanity Guard:
 * Rejects any DB or curated candidate whose per-100g macros violate biological reality
 * for the requested food item or fail the Atwater consistency check (±15% or max 15 kcal).
 */
export function passesMacroSanityGuard(
  queryName: string,
  per_100g: MacroNutrients | Macros,
  category?: FoodCategory,
): boolean {
  const norm = normalizeMacroNutrients(per_100g);
  const { calories, protein_g, carbs_g, fat_g } = norm;
  const cleaned = cleanFoodNameForMatching(queryName);

  // 1. Impossible physical sum
  if (protein_g + carbs_g + fat_g > 102) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[MacroSanityGuard] Rejected "${queryName}": sum of macros (${(protein_g + carbs_g + fat_g).toFixed(1)}g) exceeds 102g`,
        { per_100g: norm, category },
      );
    }
    return false;
  }

  // 2. Pure Protein / Egg Guard:
  // Name starts with or is a pure egg/meat/poultry/fish item without composite carb words
  const hasCarbDishWord =
    /(?<![\u0600-\u06FF])(?:بال|وال|ال|ب|و)?(?:خبز|صامولي|تميس|مفرود|برجر|شاورما|ساندوتش|فطير|مطبق|سمبوس|كبسه|مندي|مضغوط|بلاليط|شعيريه|رز|ارز|مكرونه|باستا|معصوب|عريكه|جريش|قرصان|مرقوق|سليق|حنيني|بسكوت|كيك|حلا)|bread|rice|pasta|noodle|sandwich|burger|shawarma|pastry|pie|balaleet/.test(
      cleaned,
    );
  const isPureProteinOrEgg =
    !hasCarbDishWord &&
    (/^(بيض|بيضه|صدور دجاج|صدر دجاج|دجاج شوايه|دجاج مشوي|دجاج مسلوق|دجاج مقلي|لحم|سمك|تونه|تونة|فيليه|ستيك|جمبري|روبيان)/.test(
      cleaned,
    ) ||
      /\b(boiled egg|fried egg|scrambled egg|chicken breast|grilled chicken|tuna|salmon|steak)\b/.test(
        cleaned,
      ));

  if (isPureProteinOrEgg) {
    if (carbs_g > 4 || protein_g < 10) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[MacroSanityGuard] Rejected pure protein/egg "${queryName}": carbs_g (${carbs_g}) > 4 or protein_g (${protein_g}) < 10`,
          { per_100g: norm, category },
        );
      }
      return false;
    }
  }

  // 3. Pure Rice / Bread Guard:
  // Name starts with plain rice or plain bread without meat/cheese/protein-fortified words
  const hasProteinDishWord =
    /(?<![\u0600-\u06FF])(?:بال|وال|ال|ب|و)?(?:دجاج|لحم|حاشي|غنم|تونه|بيض|جبن|جبنه|لبنه|فول|عدس|بروتين)|chicken|meat|lamb|beef|egg|cheese|protein/.test(
      cleaned,
    );
  const isPureRiceOrBread =
    !hasProteinDishWord &&
    (/^(ارز ابيض|رز ابيض|رز بشاور|ارز بشاور|رز مسلوق|ارز مسلوق|خبز|رغيف خبز|عيش|تميس عادي|خبز تميس|خبز بر|خبز اسمر|خبز مفرود|خبز عربي|صامولي|خبز صامولي)/.test(
      cleaned,
    ) ||
      /\b(white rice|plain rice|brown bread|whole wheat bread|pita bread|tamees|samoli)\b/.test(
        cleaned,
      ) ||
      category === "bread_pastry");

  if (isPureRiceOrBread && !hasProteinDishWord) {
    if (protein_g > 15 || carbs_g < 15) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[MacroSanityGuard] Rejected pure rice/bread "${queryName}": protein_g (${protein_g}) > 15 or carbs_g (${carbs_g}) < 15`,
          { per_100g: norm, category },
        );
      }
      return false;
    }
  }

  // 4. Atwater Consistency Check:
  // Math.abs(4*p + 4*c + 9*f - kcal) <= Math.max(kcal * 0.15, 15)
  // Prevents false positive rejections on low-calorie foods while strictly guarding high-energy foods.
  const atwaterKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  const atwaterDiff = Math.abs(atwaterKcal - calories);
  const atwaterTolerance = Math.max(calories * 0.15, 15);

  if (calories > 0 && atwaterDiff > atwaterTolerance) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[MacroSanityGuard] Rejected "${queryName}": Atwater diff ${atwaterDiff.toFixed(1)} exceeds tolerance ${atwaterTolerance.toFixed(1)} (stated kcal=${calories}, calculated atwater=${atwaterKcal.toFixed(1)})`,
        { per_100g: norm, category },
      );
    }
    return false;
  }

  return true;
}

/**
 * Deterministic Size Modifiers:
 * Handled in code (never left to prompt interpretation).
 * small / صغير = 0.6, medium / وسط = 1.0, large / كبير = 1.4
 */
export const SIZE_MODIFIERS: Record<string, number> = {
  small: 0.6,
  medium: 1.0,
  large: 1.4,
};

/**
 * JS `\b` is ASCII-only and never matches between Arabic letters, so Arabic word
 * boundaries are expressed with explicit lookarounds.
 */
const WORD_CHARS = "A-Za-z0-9\\u0600-\\u06FF";
function wordRe(alternatives: string): RegExp {
  return new RegExp(`(?<![${WORD_CHARS}])(?:${alternatives})(?![${WORD_CHARS}])`, "i");
}

/** Detects an explicit count (dual forms, digits, or Arabic number words) in normalized text. */
function detectCount(rawText: string): number | null {
  if (wordRe("حبتين|بيضتين|رغيفين|سكوبين|تمرتين|قطعتين|صاموليين|علبتين|two").test(rawText)) {
    return 2;
  }
  const num = /(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])/.exec(rawText);
  if (num) {
    const c = parseFloat(num[1]);
    if (c > 0 && c <= 30) return c;
  }
  const words: [RegExp, number][] = [
    [wordRe("ثلاث|ثلاثه|three"), 3],
    [wordRe("اربع|اربعه|four"), 4],
    [wordRe("خمس|خمسه|five"), 5],
    [wordRe("ست|سته|six"), 6],
    [wordRe("سبع|سبعه|seven"), 7],
    [wordRe("واحد|واحده|رغيف|سكوب|بيضه|تمره|one"), 1],
  ];
  for (const [re, cnt] of words) {
    if (re.test(rawText)) return cnt;
  }
  return null;
}

export function extractSizeModifier(text: string): "small" | "medium" | "large" | null {
  const t = (text ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
  if (wordRe("صغير|صغيره|small").test(t)) return "small";
  if (wordRe("كبير|كبيره|large|big").test(t)) return "large";
  if (wordRe("وسط|متوسط|متوسطه|medium").test(t)) return "medium";
  return null;
}

/**
 * Deterministic Portion Lookup Table (PORTION_TABLE) for standard Saudi/Gulf units & counts.
 */
export interface PortionRule {
  id: string;
  pattern: RegExp;
  unitGrams: number;
  referenceLoafOrWholeGrams: number;
  defaultPortionGrams: number;
  itemType: "countable" | "plated";
}

export const PORTION_TABLE: PortionRule[] = [
  {
    id: "boiled_or_fried_egg",
    pattern: /(?<![\u0600-\u06FF])بيض|egg/i,
    unitGrams: 50, // 1 egg = 50g
    referenceLoafOrWholeGrams: 50,
    defaultPortionGrams: 50,
    itemType: "countable",
  },
  {
    id: "canned_tuna",
    pattern: /تونه|تونة|tuna/i,
    unitGrams: 100, // Regular/medium can drained = 100g
    referenceLoafOrWholeGrams: 100,
    defaultPortionGrams: 100,
    itemType: "countable",
  },
  {
    id: "chicken_cooked",
    pattern: /دجاج\s*(شواية|شوايه|مشوي|مندي|مضغوط|كبسة|كبسه)|نص\s*دجاج|ربع\s*دجاج|حبة\s*دجاج|حبه\s*دجاج|chicken/i,
    unitGrams: 115, // Quarter chicken edible boneless meat = 115g
    referenceLoafOrWholeGrams: 460, // Whole chicken edible boneless meat = 460g
    defaultPortionGrams: 115,
    itemType: "plated",
  },
  {
    id: "chicken_breast",
    pattern: /صدور\s*دجاج|صدر\s*دجاج|chicken\s*breast/i,
    unitGrams: 150,
    referenceLoafOrWholeGrams: 150,
    defaultPortionGrams: 150,
    itemType: "countable",
  },
  {
    id: "whey_protein_scoop",
    pattern: /سكوب\s*بروتين|سكوبين\s*بروتين|واي\s*بروتين|بودره\s*بروتين|whey\s*protein|protein\s*scoop/i,
    unitGrams: 30, // 1 scoop = 30g
    referenceLoafOrWholeGrams: 30,
    defaultPortionGrams: 30,
    itemType: "countable",
  },
  {
    id: "brown_bread_loaf",
    pattern: /خبز\s*بر|خبز\s*اسمر|عيش\s*بر|رغيف\s*بر|brown\s*bread|whole\s*wheat\s*bread/i,
    unitGrams: 90, // 1 loaf = 90g
    referenceLoafOrWholeGrams: 90,
    defaultPortionGrams: 90,
    itemType: "countable",
  },
  {
    id: "tamees_bread",
    pattern: /تميس|tamees|tameez/i,
    unitGrams: 360, // 1 whole tamees loaf = 360g (quarter = 90g)
    referenceLoafOrWholeGrams: 360,
    defaultPortionGrams: 90,
    itemType: "plated",
  },
  {
    id: "samoli_roll",
    pattern: /صامولي|صمولي|samoli/i,
    unitGrams: 60,
    referenceLoafOrWholeGrams: 60,
    defaultPortionGrams: 60,
    itemType: "countable",
  },
  {
    id: "mafrood_pita",
    pattern: /مفرود|خبز\s*عربي|خبز\s*ابيض|pita/i,
    unitGrams: 60,
    referenceLoafOrWholeGrams: 60,
    defaultPortionGrams: 60,
    itemType: "countable",
  },
  {
    id: "sambusa",
    pattern: /سمبوسه|سمبوسك|sambusa|samboosa/i,
    unitGrams: 40,
    referenceLoafOrWholeGrams: 40,
    defaultPortionGrams: 80,
    itemType: "countable",
  },
  {
    id: "dates",
    pattern: /(?<![\u0600-\u06FFA-Za-z])(?:تمر|تمره|تمرات|رطب|خلاص|سكري|صقعي|dates)(?![\u0600-\u06FFA-Za-z])/i,
    unitGrams: 10,
    referenceLoafOrWholeGrams: 30,
    defaultPortionGrams: 30,
    itemType: "countable",
  },
  {
    id: "diet_pepsi",
    pattern: /بيبسي|كولا|pepsi|cola/i,
    unitGrams: 330,
    referenceLoafOrWholeGrams: 330,
    defaultPortionGrams: 330,
    itemType: "countable",
  },
  {
    id: "rice_dish",
    pattern: /أرز|ارز|رز|rice/i,
    unitGrams: 250,
    referenceLoafOrWholeGrams: 250,
    defaultPortionGrams: 250,
    itemType: "plated",
  },
];

/**
 * Determine whether an item is countable (pieces/units: 1, 2, 3) or plated (fractions: ربع, نص, كامل).
 */
type ItemTypeInput = {
  item_type?: "countable" | "plated";
  name?: string;
  name_ar?: string;
  name_en?: string;
  category?: FoodCategory | string;
};

export function getItemType(
  itemOrName: ItemTypeInput | string,
  name_en?: string,
  category?: FoodCategory | string,
): "countable" | "plated" {
  const item: ItemTypeInput =
    typeof itemOrName === "string" ? { name_ar: itemOrName, name_en, category } : itemOrName;
  if (item.item_type === "countable" || item.item_type === "plated") {
    return item.item_type;
  }
  const rawText = `${item.name ?? ""} ${item.name_ar ?? ""} ${item.name_en ?? ""}`
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

  for (const rule of PORTION_TABLE) {
    if (rule.pattern.test(rawText)) {
      return rule.itemType;
    }
  }

  if (
    item.category === "beverage" ||
    item.category === "fruit_dates" ||
    item.category === "snack_fastfood"
  ) {
    return "countable";
  }

  return "plated";
}

/**
 * Extracts explicit count or fraction from Arabic/English item text and maps through PORTION_TABLE.
 * Guarantees:
 * 1. Count uses default_portion_g only; reference_unit_g is never multiplied by count.
 * 2. Size modifier (صغير x0.6, وسط x1.0, كبير x1.4) is applied to default portion when grams not specified.
 */
export function resolvePortionGrams(
  parsed: Partial<ParsedItem> & {
    name_ar?: string;
    name_en?: string;
    size_modifier?: "small" | "medium" | "large" | null;
  },
  food?: FoodNutrition | null,
): number {
  const rawText = `${parsed.name_ar ?? ""} ${parsed.name_en ?? ""}`
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase();

  // 1. Explicit grams written in text (e.g. "200 جرام", "150g")
  const explicitGramMatch = /(\d+(?:\.\d+)?)\s*(?:جرام|غرام|grams|gram|جم|غ|g)(?![A-Za-z\u0600-\u06FF])/i.exec(rawText);
  if (explicitGramMatch) {
    const g = Math.round(parseFloat(explicitGramMatch[1]));
    if (g > 0 && g <= 5000) return g;
  }

  // Determine size modifier (small x0.6, medium x1.0, large x1.4)
  const sizeKey = parsed.size_modifier || extractSizeModifier(rawText);
  const sizeFactor = sizeKey ? (SIZE_MODIFIERS[sizeKey] ?? 1.0) : 1.0;

  // 2. Match against deterministic PORTION_TABLE
  for (const rule of PORTION_TABLE) {
    if (!rule.pattern.test(rawText)) continue;

    // Special Tuna can sizes
    if (rule.id === "canned_tuna") {
      if (wordRe("كبير|كبيره|large").test(rawText)) {
        return 130; // Drained net weight of large tuna can (~120-140g)
      }
      if (wordRe("صغير|صغيره|small").test(rawText)) {
        return 60; // Drained net weight of small tuna can
      }
      if (wordRe("علبتين|علبتان|2\\s*علبه|2\\s*علب").test(rawText)) {
        return 200;
      }
    }

    // Special Whole / Half Chicken handling
    if (rule.id === "chicken_cooked") {
      if (wordRe("حبه\\s*دجاج|دجاجه\\s*كامله|whole\\s*chicken").test(rawText) &&
        !wordRe("نص|نصف|ربع|half|quarter").test(rawText)) {
        return 460; // Whole chicken edible boneless meat
      }
      if (wordRe("نص\\s*دجاجه|نصف\\s*دجاجه|نص\\s*حبه|نصف\\s*حبه|half\\s*chicken").test(rawText)) {
        return 230; // Half chicken edible boneless meat
      }
      if (wordRe("ربع\\s*دجاجه|ربع\\s*حبه|quarter\\s*chicken").test(rawText)) {
        return 115; // Quarter chicken edible boneless meat
      }
    }

    // Check fraction words (ربع = 0.25, نص/نصف = 0.5, ثلث = 0.33, كامل = 1.0)
    // ONLY for plated dishes or whole bread (e.g. تميس)
    if (rule.itemType === "plated") {
      if (wordRe("ربع|quarter").test(rawText)) {
        return Math.round(rule.referenceLoafOrWholeGrams * 0.25);
      }
      if (wordRe("نص|نصف|half").test(rawText)) {
        return Math.round(rule.referenceLoafOrWholeGrams * 0.5);
      }
    }

    // Unit piece size for counting: ALWAYS default_portion_g, NEVER reference_unit_g!
    const unitPieceGrams = food?.default_portion_g ?? rule.unitGrams;

    // Explicit count (dual forms, digits, Arabic number words) always multiplies the single-unit weight
    const detectedCount = detectCount(rawText);
    if (detectedCount != null) {
      return Math.round(detectedCount * unitPieceGrams);
    }

    // Check dual Arabic forms (حبتين / بيضتين / رغيفين / سكوبين / تمرتين / قطعتين)
    if (/\b(حبتين|بيضتين|رغيفين|سكوبين|تمرتين|قطعتين|صاموليين|علبتين|two)\b/i.test(rawText)) {
      return Math.round(unitPieceGrams * 2);
    }

    // Check explicit numeric count (e.g. "4 حبات", "3 بيضات", "5 تمرات", "4 boiled eggs")
    const numMatch = /\b(\d+(?:\.\d+)?)\s*(?:حبه|حبات|بيضه|بيضات|رغيف|ارغفه|سكوب|سكوبات|تمره|تمرات|قطعه|قطع|صامولي|علبه|علب|علبات|eggs?|scoops?|pieces?|loaves?|dates?|cans?)?\b/i.exec(
      rawText,
    );
    if (numMatch) {
      const count = parseFloat(numMatch[1]);
      if (count > 0 && count <= 30) {
        return Math.round(count * unitPieceGrams);
      }
    }

    // Check Arabic number words
    const wordCounts: [RegExp, number][] = [
      [/\b(ثلاث|ثلاثه|three)\b/i, 3],
      [/\b(اربع|اربعه|four)\b/i, 4],
      [/\b(خمس|خمسه|five)\b/i, 5],
      [/\b(ست|سته|six)\b/i, 6],
      [/\b(سبع|سبعه|seven)\b/i, 7],
      [/\b(واحد|واحده|حبه واحده|رغيف|سكوب|بيصه|بيضه|تمره)\b/i, 1],
    ];
    for (const [re, cnt] of wordCounts) {
      if (re.test(rawText)) {
        return Math.round(cnt * unitPieceGrams);
      }
    }

    // If fraction_of_reference was supplied by AI for plated items
    if (
      rule.itemType === "plated" &&
      parsed.fraction_of_reference != null &&
      parsed.fraction_of_reference > 0
    ) {
      return Math.round(rule.referenceLoafOrWholeGrams * parsed.fraction_of_reference);
    }

    // If size modifier was explicitly stated (صغير / كبير), apply it to the default portion
    if (sizeKey && sizeKey !== "medium") {
      return Math.round((food?.default_portion_g ?? rule.defaultPortionGrams) * sizeFactor);
    }

    // If user stated a specific extracted_grams that is already known
    if (parsed.extracted_grams != null && parsed.extracted_grams > 0 && !parsed.portion_assumed) {
      return Math.round(parsed.extracted_grams);
    }

    // Apply size modifier to default portion grams
    return Math.round((food?.default_portion_g ?? rule.defaultPortionGrams) * sizeFactor);
  }

  // 2b. Countable foods without a PORTION_TABLE rule still scale by count x default_portion_g
  if (food?.item_type === "countable" && food.default_portion_g) {
    const c = detectCount(rawText);
    if (c != null) return Math.round(c * food.default_portion_g);
  }

  // 3. Non-PORTION_TABLE items: use fraction_of_reference, extracted_grams, or food defaults
  if (
    parsed.fraction_of_reference != null &&
    parsed.fraction_of_reference > 0 &&
    food?.reference_unit_g
  ) {
    return Math.round(food.reference_unit_g * parsed.fraction_of_reference);
  }
  if (sizeKey && sizeKey !== "medium" && food?.default_portion_g) {
    return Math.round(food.default_portion_g * sizeFactor);
  }
  if (parsed.extracted_grams != null && parsed.extracted_grams > 0) {
    return Math.round(parsed.extracted_grams);
  }
  if (parsed.portion_assumed && food?.default_portion_g) {
    return Math.round(food.default_portion_g * sizeFactor);
  }
  const min = Number(parsed.quantity?.grams_min) || 0;
  const max = Number(parsed.quantity?.grams_max) || 0;
  const mid = Math.round((min + max) / 2);
  if (mid > 0) return Math.round(mid * sizeFactor);
  return Math.round((food?.default_portion_g || 100) * sizeFactor);
}

/**
 * Infer item category from Arabic and English naming when category is not set.
 */
function inferFoodCategory(item: MealItem): FoodCategory | undefined {
  if (item.category) return item.category;
  const name = ((item.display_name_ar || "") + " " + (item.canonical_name || "")).toLowerCase();
  if (/تميس|صامولي|مفرود|خبز|مطبق|معصوب|عيش|pita|bread|pastry/.test(name)) return "bread_pastry";
  if (/رز|أرز|بشاور|مضغوط|بخاري|شوفان|rice|oats/.test(name)) return "rice_grain";
  if (/تمر|رطب|بلح|dates|fruit/.test(name)) return "fruit_dates";
  if (/بيض|حليب|لبن|جبن|زبادي|واي بروتين|egg|milk|cheese|yogurt|whey/.test(name)) return "dairy_egg";
  if (/دجاج|لحم|غنم|حاشي|شواية|سمك|تونة|chicken|meat|beef|lamb|fish|tuna/.test(name)) return "meat_poultry";
  if (/جريش|قرصان|سليق|مرقوق/.test(name)) return "traditional_dish";
  if (/فول|عدس|حمص|دال|beans|lentil/.test(name)) return "legume";
  if (/سمبوسة|شاورما|فلافل|برجر|shawarma|burger/.test(name)) return "snack_fastfood";
  return undefined;
}

/**
 * Pure deterministic guardrail enforcing biological & physical limits:
 * 1. Impossible Macro Sum Check: P + C + F <= 100g per 100g.
 * 2. Pure Protein / Egg Guard: prevents swapped carbs/protein on boiled eggs, chicken, meat, tuna.
 * 3. Category Protein Ceilings:
 *    - bread_pastry: clamp protein to max 14g/100g. If portion_assumed && grams > 150, clamp grams to default_portion_g.
 *    - rice_grain: clamp protein to max 5g/100g (except oats ~13.5g).
 *    - fruit_dates: clamp protein to max 4g/100g.
 * 4. Atwater Calorie Consistency Check:
 *    expectedCalories = (P * 4) + (C * 4) + (F * 9).
 *    If |calories - expectedCalories| / expectedCalories > 15% and diff > 20, reconcile calories = expectedCalories.
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

  // Preserve existing athlete micronutrients
  const existingMicros: Partial<Omit<MacroNutrients, "calories" | "protein_g" | "carbs_g" | "fat_g">> = {
    fiber_g: result.per_100g.fiber_g,
    sugar_g: result.per_100g.sugar_g,
    added_sugar_g: result.per_100g.added_sugar_g,
    saturated_fat_g: result.per_100g.saturated_fat_g,
    cholesterol_mg: result.per_100g.cholesterol_mg,
    sodium_mg: result.per_100g.sodium_mg,
    potassium_mg: result.per_100g.potassium_mg,
    magnesium_mg: result.per_100g.magnesium_mg,
    calcium_mg: result.per_100g.calcium_mg,
    iron_mg: result.per_100g.iron_mg,
    zinc_mg: result.per_100g.zinc_mg,
  };

  const category = inferFoodCategory(result) || result.category;
  result.category = category;

  const combinedName = `${result.display_name_ar || ""} ${result.canonical_name || ""}`;

  // Quantity Plausibility Check (warning when grams > 5 * default_portion_g)
  if (
    result.default_portion_g &&
    result.default_portion_g > 0 &&
    result.grams > 5 * result.default_portion_g
  ) {
    warnings.push(
      `الوزن المسجل (${result.grams}جم) يتجاوز 5 أضعاف الحصة المعتادة (${result.default_portion_g}جم)`,
    );
  }

  // Lab-analyzed SFCT dishes and trusted curated entries that ALSO pass the macro sanity guard are preserved
  const isLabVerified =
    (item.food_id?.startsWith("sfct-") ||
      item.food_id?.startsWith("curated-") ||
      (item.source === "db_match" && item.food_id != null)) &&
    passesMacroSanityGuard(combinedName, result.per_100g, category);

  if (isLabVerified) {
    result.per_100g = createMacroNutrients(
      result.per_100g.calories,
      result.per_100g.protein_g,
      result.per_100g.carbs_g,
      result.per_100g.fat_g,
      existingMicros,
    );
    result.plausibility_warning = warnings.length > 0 ? warnings.join(" • ") : null;
    return result;
  }

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

  // 2. Pure Egg / Protein Guard (fixes swapped protein/carbs on eggs or meats)
  const cleanedName = cleanFoodNameForMatching(combinedName);
  const isPureBoiledEgg =
    /^(بيض|بيضه)(\s+مسلوق|\s+مسلوقه)?$/.test(cleanedName) ||
    /\bboiled\s+eggs?\b/.test(cleanedName);
  if (isPureBoiledEgg && (carbs_g > 4 || protein_g < 10)) {
    protein_g = 12.6;
    carbs_g = 1.1;
    fat_g = 10.6;
    calories = 155;
    warnings.push("تم تصحيح القيم الغذائية للبيض المسلوق وفق المرجع المعتمد");
  }

  // 3. Category Protein Ceilings (Anti-Hallucination)
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
  } else if (category === "rice_grain" && !/شوفان|oat/i.test(cleanedName)) {
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

  // 4. Atwater Calorie Consistency Check (±15%)
  const expectedCalories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  if (expectedCalories > 0) {
    const diff = Math.abs(calories - expectedCalories);
    const pctDiff = diff / expectedCalories;
    if (pctDiff > 0.15 && diff > 20) {
      calories = expectedCalories;
      warnings.push("تمت مواءمة السعرات حتمياً وفق معادلة أتووتر (Atwater)");
    }
  }

  result.per_100g = createMacroNutrients(calories, protein_g, carbs_g, fat_g, existingMicros);
  result.plausibility_warning = warnings.length > 0 ? warnings.join(" • ") : null;

  return result;
}

/** Look up every AI item in Supabase / Curated dataset and seed realistic portions via PORTION_TABLE. */
export async function buildReviewItems(items: ParsedItem[]): Promise<ReviewItem[]> {
  return Promise.all(
    items.map(async (parsed, i) => {
      let food: FoodNutrition | null = null;
      try {
        food = await findFood(parsed);
      } catch (e) {
        console.error("[foods] lookup failed:", e);
      }

      const grams = resolvePortionGrams(parsed, food);
      const rawText = `${parsed.name_ar ?? ""} ${parsed.name_en ?? ""}`.toLowerCase();
      const isUnspecifiedTuna =
        food?.id === "curated-tuna-water" && !/ماء|زيت|water|oil/.test(rawText);

      return {
        key: `${i}-${parsed.name_en}`,
        parsed: isUnspecifiedTuna ? { ...parsed, portion_assumed: true } : parsed,
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
export type DietStyle = "balanced" | "high_protein" | "low_carb";

export const KCAL_PER_KG = 7700;

export const DIET_PRESETS: Record<DietStyle, { proteinPerKg: number; fatPct: number }> = {
  balanced: { proteinPerKg: 1.6, fatPct: 0.30 },
  high_protein: { proteinPerKg: 2.0, fatPct: 0.25 },
  low_carb: { proteinPerKg: 2.0, fatPct: 0.40 },
};

/** Body stats used by the Mifflin-St Jeor formula. */
export interface UserStats {
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal_type: GoalType;
  target_weight_kg?: number | null;
  weekly_pace_kg?: number;
  diet_style?: DietStyle;
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
  target_weight_kg?: number | null;
  weekly_pace_kg: number;
  diet_style: DietStyle;
  is_custom_targets: boolean;
  updated_at?: string;
}

/** Calculated targets plus the intermediate steps, so the UI can show the math. */
export interface TargetBreakdown extends DailyTargets {
  bmr: number;
  multiplier: number;
  tdee: number;
  adjustment: number;
  minCalories: number;
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

export const MIN_CALORIES_BY_GENDER: Record<Gender, number> = {
  male: 1500,
  female: 1200,
};

/** Matches the column defaults in `supabase_migration.sql` & `supabase_weight_tracker.sql`. */
export const DEFAULT_STATS: UserStats = {
  gender: "male",
  age: 25,
  height_cm: 170,
  weight_kg: 70,
  activity_level: "light",
  goal_type: "maintain",
  target_weight_kg: null,
  weekly_pace_kg: 0.5,
  diet_style: "balanced",
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

/** Daily kcal deficit/surplus implied by a weekly pace in kg/week (1 kg ≈ 7700 kcal => 1100 kcal/day per kg). */
export function dailyDeficitFromPace(paceKgPerWeek: number): number {
  const safePace = Number.isFinite(paceKgPerWeek) && paceKgPerWeek > 0 ? paceKgPerWeek : 0.5;
  return Math.round((safePace * KCAL_PER_KG) / 7);
}

/** Caps safe weekly weight loss at ~1% of current body weight, rounded down to nearest 0.25 kg. */
export function maxSafeWeeklyPace(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0.5;
  return Math.max(0.25, Math.floor(weightKg * 0.01 * 4) / 4);
}

export function calculateDailyTargets(stats: UserStats): TargetBreakdown {
  const { gender, age, height_cm, weight_kg } = stats;
  const weeklyPaceKg = stats.weekly_pace_kg ?? 0.5;
  const dietStyle: DietStyle = stats.diet_style ?? "balanced";
  const preset = DIET_PRESETS[dietStyle] ?? DIET_PRESETS.balanced;

  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const bmr = gender === "female" ? base - 161 : base + 5;

  const multiplier = ACTIVITY_MULTIPLIERS[stats.activity_level] ?? ACTIVITY_MULTIPLIERS.light;
  const tdee = bmr * multiplier;

  let adjustment = 0;
  if (stats.goal_type === "lose") {
    adjustment = -dailyDeficitFromPace(weeklyPaceKg);
  } else if (stats.goal_type === "gain") {
    adjustment = Math.round(dailyDeficitFromPace(weeklyPaceKg) * 0.6);
  }

  const minCalories = gender === "male" ? 1500 : 1200;
  const raw = Math.round(tdee + adjustment);
  const target_calories = Math.max(minCalories, raw);

  const target_protein_g = Math.round(weight_kg * preset.proteinPerKg);
  const target_fat_g = Math.round((target_calories * preset.fatPct) / 9);
  const target_carbs_g = Math.max(
    0,
    Math.round((target_calories - target_protein_g * 4 - target_fat_g * 9) / 4),
  );

  return {
    bmr: Math.round(bmr),
    multiplier,
    tdee: Math.round(tdee),
    adjustment,
    minCalories,
    clampedToMinimum: raw < minCalories,
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

/* ============================================================
 * EMA Weight Trend & Daily Projection Functions
 * ============================================================ */

export interface WeightLog {
  id?: string;
  user_id?: string;
  logged_date: string;
  weight_kg: number;
  source?: string;
  created_at?: string;
}

export interface WeightEMAPoint {
  logged_date: string;
  weight_kg: number;
  ema_kg: number;
}

export interface WeightEMAResult {
  points: WeightEMAPoint[];
  ema_kg: number | null;
  latest_ema_kg: number | null;
  latest_weight_kg: number | null;
  trend_7d_kg: number;
}

/**
 * Computes Exponential Moving Average (EMA) over chronological weight logs
 * to filter out daily water and sodium fluctuations.
 * Formula: ema_0 = weight_0, ema_t = alpha * weight_t + (1 - alpha) * ema_{t-1}.
 */
export function calculateWeightEMA(
  logs: { logged_date: string; weight_kg: number }[],
  alpha = 0.2,
): WeightEMAResult {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      points: [],
      ema_kg: null,
      latest_ema_kg: null,
      latest_weight_kg: null,
      trend_7d_kg: 0,
    };
  }

  // Deduplicate by logged_date and sort chronologically ascending
  const byDate = new Map<string, number>();
  for (const entry of logs) {
    if (entry && typeof entry.logged_date === "string" && Number.isFinite(Number(entry.weight_kg))) {
      byDate.set(entry.logged_date, Number(entry.weight_kg));
    }
  }

  const sorted = Array.from(byDate.entries())
    .map(([logged_date, weight_kg]) => ({ logged_date, weight_kg }))
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date));

  if (sorted.length === 0) {
    return {
      points: [],
      ema_kg: null,
      latest_ema_kg: null,
      latest_weight_kg: null,
      trend_7d_kg: 0,
    };
  }

  let runningEma = sorted[0].weight_kg;
  const points: WeightEMAPoint[] = sorted.map((item, idx) => {
    if (idx === 0) {
      runningEma = item.weight_kg;
    } else {
      runningEma = alpha * item.weight_kg + (1 - alpha) * runningEma;
    }
    return {
      logged_date: item.logged_date,
      weight_kg: Number(item.weight_kg.toFixed(2)),
      ema_kg: Number(runningEma.toFixed(2)),
    };
  });

  const last = points[points.length - 1];
  let baseline = points[0];

  if (points.length > 1) {
    const lastDate = new Date(`${last.logged_date}T00:00:00`);
    if (!Number.isNaN(lastDate.getTime())) {
      const sevenDaysAgo = new Date(
        lastDate.getFullYear(),
        lastDate.getMonth(),
        lastDate.getDate() - 7,
      );
      const sevenDaysAgoKey = localDateString(sevenDaysAgo);
      for (const pt of points) {
        if (pt.logged_date <= sevenDaysAgoKey) {
          baseline = pt;
        }
      }
    }
  }

  const trend_7d_kg = Number((last.ema_kg - baseline.ema_kg).toFixed(2));

  return {
    points,
    ema_kg: last.ema_kg,
    latest_ema_kg: last.ema_kg,
    latest_weight_kg: last.weight_kg,
    trend_7d_kg,
  };
}

/**
 * Expected weight change in kg from today's calorie deficit:
 * deficit = tdee - consumedKcal
 * Returns Number((deficit / 7700).toFixed(3))
 */
export function estimateDailyWeightChangeKg(tdee: number, consumedKcal: number): number {
  const deficit = tdee - consumedKcal;
  return Number((deficit / KCAL_PER_KG).toFixed(3));
}

/**
 * Estimates number of weeks to reach targetWeightKg at weeklyPaceKg.
 */
export function estimateWeeksToGoal(
  currentWeightKg: number,
  targetWeightKg: number,
  weeklyPaceKg: number,
): number {
  return Math.ceil(Math.abs(currentWeightKg - targetWeightKg) / Math.max(0.1, weeklyPaceKg));
}

/**
 * Returns the projected Date when the user will reach targetWeightKg.
 */
export function estimateGoalDate(
  currentWeightKg: number,
  targetWeightKg: number,
  weeklyPaceKg: number,
  fromDate = new Date(),
): Date {
  const weeks = estimateWeeksToGoal(currentWeightKg, targetWeightKg, weeklyPaceKg);
  return new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + weeks * 7);
}

export function defaultProfile(userId: string): UserProfile {
  const calc = calculateDailyTargets(DEFAULT_STATS);
  return {
    user_id: userId,
    ...DEFAULT_STATS,
    target_weight_kg: null,
    weekly_pace_kg: 0.5,
    diet_style: "balanced",
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
export const getWeightLogsCacheKey = (userId: string) => `hesbah_weight_logs_${userId}`;
const LEGACY_PROFILE_CACHE_KEY = "hesbah_user_profile";

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const num = (v: unknown, fallback: number) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Coerce a DB row / cached JSON into a well-formed profile. */
function normalizeProfile(row: Record<string, unknown>, userId: string): UserProfile {
  const rawTargetWeight = row.target_weight_kg;
  let target_weight_kg: number | null = null;
  if (rawTargetWeight !== undefined && rawTargetWeight !== null && rawTargetWeight !== "") {
    const parsedTw = typeof rawTargetWeight === "string" ? parseFloat(rawTargetWeight) : Number(rawTargetWeight);
    if (
      Number.isFinite(parsedTw) &&
      parsedTw >= STAT_LIMITS.weight_kg.min &&
      parsedTw <= STAT_LIMITS.weight_kg.max
    ) {
      target_weight_kg = Math.round(parsedTw * 10) / 10;
    }
  }

  const rawPace = num(row.weekly_pace_kg, 0.5);
  const weekly_pace_kg = Math.min(1.5, Math.max(0.1, Math.round(rawPace * 100) / 100));

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
    target_weight_kg,
    weekly_pace_kg,
    diet_style: pick(row.diet_style, ["balanced", "high_protein", "low_carb"] as const, "balanced"),
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
      profile.target_weight_kg != null ||
      profile.weekly_pace_kg !== 0.5 ||
      profile.diet_style !== "balanced" ||
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
    target_weight_kg: p.target_weight_kg ?? null,
    weekly_pace_kg: p.weekly_pace_kg ?? 0.5,
    diet_style: p.diet_style ?? "balanced",
    target_calories: Math.round(p.target_calories),
    target_protein_g: Math.round(p.target_protein_g),
    target_carbs_g: Math.round(p.target_carbs_g),
    target_fat_g: Math.round(p.target_fat_g),
    is_custom_targets: p.is_custom_targets,
    updated_at: p.updated_at ?? new Date().toISOString(),
  };
}

function toLegacyRow(p: UserProfile) {
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
      const remoteRow = data as Record<string, unknown>;
      // Preserve local target_weight_kg / weekly_pace_kg / diet_style if remote schema lacks them
      const mergedRow: Record<string, unknown> = {
        ...(cached ?? {}),
        ...remoteRow,
        target_weight_kg:
          remoteRow.target_weight_kg !== undefined ? remoteRow.target_weight_kg : cached?.target_weight_kg,
        weekly_pace_kg:
          remoteRow.weekly_pace_kg !== undefined ? remoteRow.weekly_pace_kg : cached?.weekly_pace_kg,
        diet_style: remoteRow.diet_style !== undefined ? remoteRow.diet_style : cached?.diet_style,
      };
      const remote = normalizeProfile(mergedRow, userId);
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
    // Fallback if new columns haven't been migrated yet
    if (error) {
      const { error: legacyErr } = await supabase
        .from("user_profiles")
        .upsert(toLegacyRow(stamped), { onConflict: "user_id" });
      if (!legacyErr) {
        synced = true;
      }
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

/* ============================================================
 * Weight Log Persistence (Supabase + localStorage Fallback)
 * ============================================================ */

function normalizeWeightLogList(raw: unknown, userId: string): WeightLog[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, WeightLog>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const logged_date = typeof obj.logged_date === "string" ? obj.logged_date.slice(0, 10) : "";
    const w = num(obj.weight_kg, NaN);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logged_date) || !Number.isFinite(w) || w <= 0) continue;
    byDate.set(logged_date, {
      id: typeof obj.id === "string" ? obj.id : undefined,
      user_id: userId,
      logged_date,
      weight_kg: Math.round(w * 10) / 10,
      source: typeof obj.source === "string" ? obj.source : "manual",
      created_at: typeof obj.created_at === "string" ? obj.created_at : undefined,
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.logged_date.localeCompare(b.logged_date));
}

export function getCachedWeightLogs(userId: string): WeightLog[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(getWeightLogsCacheKey(userId));
    if (!raw) return [];
    return normalizeWeightLogList(JSON.parse(raw), userId);
  } catch {
    return [];
  }
}

function writeWeightLogsCache(userId: string, logs: WeightLog[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const normalized = normalizeWeightLogList(logs, userId);
    window.localStorage.setItem(getWeightLogsCacheKey(userId), JSON.stringify(normalized));
  } catch {
    /* storage full or unavailable */
  }
}

/**
 * Loads chronological weight logs for the user from Supabase `public.weight_logs`
 * with automatic fallback/merge to `localStorage` (`hesbah_weight_logs_${userId}`).
 */
export async function getWeightLogs(userId: string): Promise<WeightLog[]> {
  if (!userId) return [];
  const cached = getCachedWeightLogs(userId);
  try {
    const { data, error } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_date", { ascending: true });

    if (!error && Array.isArray(data)) {
      const remote = normalizeWeightLogList(data, userId);
      const mergedMap = new Map<string, WeightLog>();
      for (const c of cached) mergedMap.set(c.logged_date, c);
      for (const r of remote) mergedMap.set(r.logged_date, r);
      const merged = Array.from(mergedMap.values()).sort((a, b) =>
        a.logged_date.localeCompare(b.logged_date),
      );
      writeWeightLogsCache(userId, merged);
      return merged;
    }
    return cached;
  } catch (e) {
    console.warn("[weight_logs] Supabase unavailable, using local cache:", e);
    return cached;
  }
}

/**
 * Logs or updates the user's daily weight for `date` (defaults to today YYYY-MM-DD).
 * Upserts into `weight_logs`, updates `weight_kg` in `user_profiles`, and persists
 * to `localStorage` fallback (`hesbah_weight_logs_${userId}`).
 */
export async function logDailyWeight(
  userId: string,
  weightKg: number,
  date?: string,
): Promise<{ log: WeightLog; logs: WeightLog[]; synced: boolean }> {
  const logged_date = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateString(new Date());
  const sanitizedWeight =
    Math.round(
      Math.min(STAT_LIMITS.weight_kg.max, Math.max(STAT_LIMITS.weight_kg.min, weightKg)) * 10,
    ) / 10;

  const entry: WeightLog = {
    user_id: userId,
    logged_date,
    weight_kg: sanitizedWeight,
    source: "manual",
    created_at: new Date().toISOString(),
  };

  // 1. Update local weight logs cache immediately
  const existingLogs = getCachedWeightLogs(userId);
  const byDate = new Map<string, WeightLog>();
  for (const item of existingLogs) byDate.set(item.logged_date, item);
  byDate.set(logged_date, entry);
  const updatedLogs = Array.from(byDate.values()).sort((a, b) =>
    a.logged_date.localeCompare(b.logged_date),
  );
  writeWeightLogsCache(userId, updatedLogs);

  // 2. Also update weight_kg in user_profiles (and recalculate targets if not custom)
  const cachedProfile = getCachedUserProfile(userId) ?? defaultProfile(userId);
  const nextProfileBase: UserProfile = {
    ...cachedProfile,
    user_id: userId,
    weight_kg: sanitizedWeight,
  };
  if (!nextProfileBase.is_custom_targets) {
    const calc = calculateDailyTargets(nextProfileBase);
    nextProfileBase.target_calories = calc.target_calories;
    nextProfileBase.target_protein_g = calc.target_protein_g;
    nextProfileBase.target_carbs_g = calc.target_carbs_g;
    nextProfileBase.target_fat_g = calc.target_fat_g;
  }

  let synced = false;

  // 3. Upsert into Supabase weight_logs + save updated profile
  try {
    const { data, error } = await supabase
      .from("weight_logs")
      .upsert(
        {
          user_id: userId,
          logged_date,
          weight_kg: sanitizedWeight,
          source: "manual",
        },
        { onConflict: "user_id,logged_date" },
      )
      .select()
      .maybeSingle();

    if (!error && data) {
      synced = true;
      const remoteEntry = normalizeWeightLogList([data], userId)[0];
      if (remoteEntry) {
        byDate.set(logged_date, remoteEntry);
        writeWeightLogsCache(
          userId,
          Array.from(byDate.values()).sort((a, b) => a.logged_date.localeCompare(b.logged_date)),
        );
      }
    }
  } catch (e) {
    console.warn("[weight_logs] upsert failed, saved locally:", e);
  }

  try {
    const profileRes = await saveUserProfile(nextProfileBase);
    if (profileRes.synced) synced = true;
  } catch {
    // local cache already updated
  }

  return {
    log: byDate.get(logged_date) ?? entry,
    logs: getCachedWeightLogs(userId),
    synced,
  };
}
