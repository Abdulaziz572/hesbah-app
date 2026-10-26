import { supabase } from "./supabaseClient";
import {
  normalizeMacroNutrients,
  createMacroNutrients,
  applyPlausibilityChecks,
  type FoodNutrition,
} from "./nutrition";
import type {
  ParsedItem,
  MealItem,
  FoodState,
  MacroSource,
  FoodCategory,
} from "./ai/types";

type Row = Record<string, unknown>;

export interface CuratedFoodEntry {
  id: string;
  name_ar: string;
  name_en: string;
  category: FoodCategory;
  state: FoodState;
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  default_portion_g: number;
  reference_unit_g: number;
  cal_range: [number, number];
  protein_range: [number, number];
  uncertainty_level: "low" | "medium" | "high";
  verification_notes: string;
  aliases: string[];
}

/**
 * Curated Saudi Traditional & Everyday Foods in-memory database.
 * Serves as instantaneous local fallback when offline or when DB lookup misses.
 */
export const CURATED_SAUDI_FOODS: CuratedFoodEntry[] = [
  // Breads & Pastries
  {
    id: "curated-tamees-plain",
    name_ar: "خبز تميس عادي",
    name_en: "Plain Tamees Bread",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 275, protein_g: 8.5, carbs_g: 54, fat_g: 2.5 },
    default_portion_g: 90,
    reference_unit_g: 360,
    cal_range: [250, 300],
    protein_range: [7.5, 9.5],
    uncertainty_level: "low",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["تميس", "تميس عادي", "خبز تميس", "tamees", "tameez"],
  },
  {
    id: "curated-tamees-cheese",
    name_ar: "تميس بالجبن",
    name_en: "Cheese Tamees Bread",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 310, protein_g: 11, carbs_g: 46, fat_g: 9 },
    default_portion_g: 110,
    reference_unit_g: 440,
    cal_range: [280, 345],
    protein_range: [9.5, 12.5],
    uncertainty_level: "medium",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["تميس جبن", "تميس بالجبنة", "خبز تميس جبن"],
  },
  {
    id: "curated-tamees-ghee",
    name_ar: "تميس بالسمن / بسكوت",
    name_en: "Ghee / Biscuit Tamees Bread",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 340, protein_g: 8, carbs_g: 52, fat_g: 11 },
    default_portion_g: 95,
    reference_unit_g: 380,
    cal_range: [310, 380],
    protein_range: [7, 9],
    uncertainty_level: "medium",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["تميس سمن", "تميس بسكوت", "تميس بالسمن"],
  },
  {
    id: "curated-samoli",
    name_ar: "خبز صامولي",
    name_en: "Samoli Bread Roll",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 275, protein_g: 8.3, carbs_g: 51.7, fat_g: 3.3 },
    default_portion_g: 60,
    reference_unit_g: 60,
    cal_range: [260, 295],
    protein_range: [7.5, 9],
    uncertainty_level: "low",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["صامولي", "عيش صامولي", "خبز صمولي", "samoli"],
  },
  {
    id: "curated-mafrood",
    name_ar: "خبز مفرود / عربي",
    name_en: "Arabic Flatbread (Mafrood)",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 275, protein_g: 8.3, carbs_g: 55, fat_g: 1.7 },
    default_portion_g: 60,
    reference_unit_g: 60,
    cal_range: [260, 290],
    protein_range: [7.5, 9],
    uncertainty_level: "low",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["خبز مفرود", "خبز عربي", "عيش مفرود", "خبز ابيض", "pita"],
  },
  {
    id: "curated-mutabbaq",
    name_ar: "مطبق مالح (لحم/بيض/كراث)",
    name_en: "Savory Mutabbaq (Meat & Egg)",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 230, protein_g: 9, carbs_g: 24, fat_g: 11 },
    default_portion_g: 180,
    reference_unit_g: 360,
    cal_range: [195, 270],
    protein_range: [7, 11],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["مطبق", "مطبق مالح", "مطبق لحم", "mutabbaq"],
  },
  {
    id: "curated-masoob",
    name_ar: "معصوب (عادي بالموز والقشطة)",
    name_en: "Masoob (Banana & Cream)",
    category: "bread_pastry",
    state: "ready_to_eat",
    per_100g: { calories: 260, protein_g: 5, carbs_g: 36, fat_g: 11 },
    default_portion_g: 250,
    reference_unit_g: 500,
    cal_range: [220, 320],
    protein_range: [4, 6.5],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["معصوب", "معصوب بالقشطة", "معصوب موز", "masoob"],
  },

  // Cooked Rice & Traditional Dishes
  {
    id: "curated-kabsa-rice",
    name_ar: "أرز كبسة / مضغوط (مطبوخ بدون اللحم)",
    name_en: "Cooked Kabsa / Madghoot Rice",
    category: "rice_grain",
    state: "cooked",
    per_100g: { calories: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [140, 175],
    protein_range: [2.5, 3.5],
    uncertainty_level: "medium",
    verification_notes: "USDA cooked seasoned rice / SFDA",
    aliases: ["رز كبسة", "أرز كبسة", "رز مضغوط", "ارز مضغوط", "كبسة رز", "رز الكبسة"],
  },
  {
    id: "curated-white-rice",
    name_ar: "أرز أبيض مسلوق / بشاور (مطبوخ)",
    name_en: "Cooked Plain White / Peshawari Rice",
    category: "rice_grain",
    state: "cooked",
    per_100g: { calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
    default_portion_g: 220,
    reference_unit_g: 220,
    cal_range: [120, 140],
    protein_range: [2.4, 3],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central cooked white rice",
    aliases: ["رز ابيض", "أرز أبيض", "رز بشاور", "رز مسلوق", "white rice"],
  },
  {
    id: "curated-bukhari-rice",
    name_ar: "أرز بخاري / مندي (مطبوخ)",
    name_en: "Cooked Bukhari / Mandi Rice",
    category: "rice_grain",
    state: "cooked",
    per_100g: { calories: 165, protein_g: 3, carbs_g: 31, fat_g: 3.2 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [145, 185],
    protein_range: [2.5, 3.5],
    uncertainty_level: "medium",
    verification_notes: "USDA / SFDA",
    aliases: ["رز بخاري", "رز مندي", "أرز بخاري", "أرز مندي", "ارز بخاري"],
  },
  {
    id: "curated-jareesh",
    name_ar: "جريش",
    name_en: "Jareesh (Cracked Wheat)",
    category: "traditional_dish",
    state: "cooked",
    per_100g: { calories: 135, protein_g: 4.5, carbs_g: 21, fat_g: 3.5 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [115, 165],
    protein_range: [3.5, 5.5],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["جريش", "الجريش", "جريش احمر", "جريش ابيض", "jareesh"],
  },
  {
    id: "curated-qursan",
    name_ar: "قرصان بالخضار واللحم",
    name_en: "Qursan with Vegetables",
    category: "traditional_dish",
    state: "cooked",
    per_100g: { calories: 145, protein_g: 6, carbs_g: 20, fat_g: 4.5 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [120, 175],
    protein_range: [4.5, 7.5],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["قرصان", "القرصان", "qursan"],
  },
  {
    id: "curated-saleeg",
    name_ar: "سليق (أرز بالحليب بدون الدجاج)",
    name_en: "Saleeg Rice (without Chicken)",
    category: "traditional_dish",
    state: "cooked",
    per_100g: { calories: 150, protein_g: 4, carbs_g: 24, fat_g: 4 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [130, 180],
    protein_range: [3.2, 5],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["سليق", "سليق طائفي", "رز سليق", "saleeg"],
  },
  {
    id: "curated-margoog",
    name_ar: "مرقوق",
    name_en: "Margoog",
    category: "traditional_dish",
    state: "cooked",
    per_100g: { calories: 140, protein_g: 5.5, carbs_g: 21, fat_g: 4 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [115, 170],
    protein_range: [4, 7],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["مرقوق", "المرقوق", "margoog"],
  },

  // Cooked Poultry & Meats (Edible Meat Only, Boneless)
  {
    id: "curated-chicken-cooked",
    name_ar: "دجاج شواية / مضغوط / مندي / كبسة (صافي اللحم المأكول بدون العظم)",
    name_en: "Cooked Chicken Meat (Boneless / Edible)",
    category: "meat_poultry",
    state: "cooked",
    per_100g: { calories: 215, protein_g: 26, carbs_g: 0, fat_g: 11.5 },
    default_portion_g: 115,
    reference_unit_g: 460,
    cal_range: [195, 240],
    protein_range: [24, 28],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central roasted chicken meat",
    aliases: [
      "دجاج كبسة",
      "دجاج شواية",
      "دجاج مندي",
      "دجاج مضغوط",
      "دجاج مسحب",
      "دجاج مشوي",
      "نص حبة دجاج",
      "ربع دجاجة",
      "حبة دجاج",
      "لحم دجاج",
      "دجاج مطبوخ",
    ],
  },
  {
    id: "curated-lamb-cooked",
    name_ar: "لحم غنم / حاشي مطبوخ (صافي بدون عظم)",
    name_en: "Cooked Lamb / Camel Meat (Boneless)",
    category: "meat_poultry",
    state: "cooked",
    per_100g: { calories: 270, protein_g: 25, carbs_g: 0, fat_g: 19 },
    default_portion_g: 100,
    reference_unit_g: 400,
    cal_range: [240, 310],
    protein_range: [23, 27],
    uncertainty_level: "medium",
    verification_notes: "USDA FoodData Central cooked lamb/mutton",
    aliases: ["لحم كبسة", "لحم غنم", "لحم حاشي", "لحم مندي", "لحم مضغوط", "لحم مطبوخ", "cooked lamb"],
  },

  // Popular Breakfast, Snacks & Dates
  {
    id: "curated-foul",
    name_ar: "فول مدمس / قلابة (بدون زيت إضافي كثير)",
    name_en: "Foul Mudammas / Qallaba",
    category: "legume",
    state: "cooked",
    per_100g: { calories: 115, protein_g: 7, carbs_g: 16, fat_g: 2.5 },
    default_portion_g: 200,
    reference_unit_g: 200,
    cal_range: [100, 145],
    protein_range: [6, 8],
    uncertainty_level: "medium",
    verification_notes: "USDA cooked fava beans / SFDA",
    aliases: ["فول", "فول مدمس", "فول قلابة", "صحن فول", "foul"],
  },
  {
    id: "curated-lentils",
    name_ar: "عدس / دال (مطبوخ)",
    name_en: "Cooked Lentils / Dal",
    category: "legume",
    state: "cooked",
    per_100g: { calories: 125, protein_g: 7.5, carbs_g: 18, fat_g: 2.5 },
    default_portion_g: 200,
    reference_unit_g: 200,
    cal_range: [110, 150],
    protein_range: [6.5, 8.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central cooked lentils",
    aliases: ["عدس", "شوربة عدس", "دال", "عدس مطبوخ", "lentils"],
  },
  {
    id: "curated-sambusa-baked",
    name_ar: "سمبوسة لحم / دجاج بالفرن أو القلاية الهوائية",
    name_en: "Baked / Air-Fried Sambusa",
    category: "snack_fastfood",
    state: "cooked",
    per_100g: { calories: 238, protein_g: 12.5, carbs_g: 27.5, fat_g: 8.8 },
    default_portion_g: 40,
    reference_unit_g: 40,
    cal_range: [210, 265],
    protein_range: [10, 14],
    uncertainty_level: "medium",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["سمبوسة بالفرن", "سمبوسة لحم فرن", "سمبوسة قلاية هوائية", "سمبوسة مشوية", "samboosa baked"],
  },
  {
    id: "curated-sambusa-fried",
    name_ar: "سمبوسة مقلية بالزيت",
    name_en: "Fried Sambusa",
    category: "snack_fastfood",
    state: "cooked",
    per_100g: { calories: 338, protein_g: 11.3, carbs_g: 27.5, fat_g: 20 },
    default_portion_g: 40,
    reference_unit_g: 40,
    cal_range: [300, 380],
    protein_range: [9.5, 13],
    uncertainty_level: "high",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["سمبوسة", "سمبوسك", "سمبوسة مقلية", "سمبوسة زيت", "samboosa fried"],
  },
  {
    id: "curated-shawarma-small",
    name_ar: "شاورما دجاج عادي (خبز عربي صغير)",
    name_en: "Regular Chicken Shawarma (Small Pita)",
    category: "snack_fastfood",
    state: "ready_to_eat",
    per_100g: { calories: 227, protein_g: 13.3, carbs_g: 20, fat_g: 10 },
    default_portion_g: 150,
    reference_unit_g: 150,
    cal_range: [200, 260],
    protein_range: [11, 15],
    uncertainty_level: "medium",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["شاورما", "شاورما دجاج", "ساندوتش شاورما", "شاورما عادي", "shawarma"],
  },
  {
    id: "curated-shawarma-large",
    name_ar: "شاورما صاروخ / صاج كبير",
    name_en: "Large Sarookh / Saj Chicken Shawarma",
    category: "snack_fastfood",
    state: "ready_to_eat",
    per_100g: { calories: 229, protein_g: 12.5, carbs_g: 19.6, fat_g: 10.7 },
    default_portion_g: 280,
    reference_unit_g: 280,
    cal_range: [205, 265],
    protein_range: [10.5, 14.5],
    uncertainty_level: "medium",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["شاورما صاروخ", "صاروخ شاورما", "شاورما صاج"],
  },
  {
    id: "curated-dates",
    name_ar: "تمر (سكري / خلاص / صقعي)",
    name_en: "Dates (Sukari / Khalas / Sagai)",
    category: "fruit_dates",
    state: "ready_to_eat",
    per_100g: { calories: 282, protein_g: 2, carbs_g: 75, fat_g: 0.4 },
    default_portion_g: 30,
    reference_unit_g: 30,
    cal_range: [270, 295],
    protein_range: [1.8, 2.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central / SFDA date palms",
    aliases: ["تمر", "رطب", "تمر سكري", "تمر خلاص", "تمر صقعي", "dates"],
  },
];

/** Normalize Arabic: unify alef forms, ta marbuta, alef maqsura; strip diacritics/tatweel. */
export function normalizeArabic(s: string): string {
  return (s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy ilike wildcard pattern */
const fuzzyPattern = (normalized: string) => normalized.replace(/[اهي]/g, "_");

function toFood(row: Row): FoodNutrition {
  let p = row.per_100g as unknown;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      p = {};
    }
  }

  const defPortion = row.default_portion_g != null ? Number(row.default_portion_g) : undefined;
  const refUnit = row.reference_unit_g != null ? Number(row.reference_unit_g) : undefined;

  return {
    id: String(row.id ?? row.name_ar ?? ""),
    name_ar: String(row.name_ar ?? ""),
    name_en: String(row.name_en ?? ""),
    source: "db",
    per100g: normalizeMacroNutrients(p),
    category: row.category as FoodCategory | undefined,
    default_portion_g: defPortion,
    reference_unit_g: refUnit,
    uncertainty_level: (row.uncertainty_level as "low" | "medium" | "high") || "medium",
    verification_notes: row.verification_notes ? String(row.verification_notes) : undefined,
  };
}

/** Strip characters that break ilike patterns or PostgREST or() syntax. */
const clean = (s: string) => s.replace(/[%_,(){}"\\*:]/g, " ").replace(/\s+/g, " ").trim();

const aliasesOf = (row: Row): string[] =>
  Array.isArray(row.aliases) ? (row.aliases as unknown[]).map(String) : [];

/** Search in-memory curated dataset when Supabase query is empty or offline */
export function searchCuratedFallback(term: string): FoodNutrition | null {
  const norm = normalizeArabic(clean(term)).toLowerCase();
  if (!norm || norm.length < 2) return null;

  let bestEntry: CuratedFoodEntry | null = null;
  let bestScore = -1;

  for (const entry of CURATED_SAUDI_FOODS) {
    const names = [entry.name_ar, entry.name_en, ...entry.aliases].map((n) =>
      normalizeArabic(n).toLowerCase(),
    );

    let currentScore = 0;
    if (names.some((n) => n === norm)) {
      currentScore = 100;
    } else if (names.some((n) => n.includes(norm) || norm.includes(n))) {
      currentScore = 70;
    } else {
      const normWords = norm.split(" ").filter((w) => w.length >= 3);
      for (const w of normWords) {
        if (names.some((n) => n.includes(w))) {
          currentScore = Math.max(currentScore, 40);
        }
      }
    }

    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 40) {
    return {
      id: bestEntry.id,
      name_ar: bestEntry.name_ar,
      name_en: bestEntry.name_en,
      source: "db",
      per100g: createMacroNutrients(
        bestEntry.per_100g.calories,
        bestEntry.per_100g.protein_g,
        bestEntry.per_100g.carbs_g,
        bestEntry.per_100g.fat_g,
      ),
      category: bestEntry.category,
      default_portion_g: bestEntry.default_portion_g,
      reference_unit_g: bestEntry.reference_unit_g,
      uncertainty_level: bestEntry.uncertainty_level,
      verification_notes: bestEntry.verification_notes,
    };
  }

  return null;
}

/**
 * Query `foods` table in Supabase.
 */
async function search(term: string): Promise<Row[]> {
  const normalized = normalizeArabic(term);
  const pattern = `%${fuzzyPattern(normalized)}%`;
  const filters = [
    `search_text.ilike.${pattern}`,
    `name_ar.ilike.${pattern}`,
    `name_en.ilike.${pattern}`,
  ].join(",");

  try {
    const [textRes, aliasRes] = await Promise.all([
      supabase.from("foods").select("*").or(filters).limit(20),
      supabase
        .from("foods")
        .select("*")
        .overlaps("aliases", [...new Set([term, normalized])])
        .limit(20),
    ]);

    const merged = new Map<string, Row>();
    for (const r of [...((textRes.data as Row[]) ?? []), ...((aliasRes.data as Row[]) ?? [])]) {
      merged.set(String(r.id), r);
    }
    return [...merged.values()];
  } catch (err) {
    console.warn("[foods] Supabase search failed, falling back to local dataset:", err);
    return [];
  }
}

/** Score a row against the normalized search term (higher is better). */
function score(row: Row, normalizedTerm: string): number {
  const names = [String(row.name_ar ?? ""), String(row.name_en ?? ""), ...aliasesOf(row)].map(
    normalizeArabic,
  );
  if (names.some((n) => n.toLowerCase() === normalizedTerm.toLowerCase())) return 100;
  if (names.some((n) => n.includes(normalizedTerm))) return 50 - Math.min(names[0].length, 40) / 10;
  return 10 - Math.min(names[0].length, 40) / 10;
}

/** Build a food from the AI's own per-100g estimate (used strictly when no match in DB). */
function foodFromAi(
  item: Pick<ParsedItem, "name_ar" | "name_en" | "category" | "ai_fallback_per_100g" | "ai_estimated_per_100g">,
): FoodNutrition | null {
  const e = item.ai_fallback_per_100g || item.ai_estimated_per_100g;
  if (!e) return null;
  return {
    id: `ai-${item.name_en}`,
    name_ar: item.name_ar,
    name_en: item.name_en,
    source: "ai",
    category: item.category,
    per100g: normalizeMacroNutrients(e),
  };
}

/**
 * Find the best food for an item:
 * 1. Supabase foods table first (source "db")
 * 2. In-memory curated Saudi foods dataset
 * 3. Fall back to AI bounded per-100g estimate (source "ai")
 */
export async function findFood(
  item: Pick<
    ParsedItem,
    "name_ar" | "name_en" | "category" | "ai_fallback_per_100g" | "ai_estimated_per_100g"
  >,
): Promise<FoodNutrition | null> {
  const full = [item.name_ar, item.name_en].map((s) => clean(s ?? "")).filter(Boolean);
  const words = full
    .flatMap((s) => s.split(" "))
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length);
  const terms = [...new Set([...full, ...words])];

  // 1. Try Supabase foods lookup
  for (const term of terms) {
    const rows = await search(term);
    if (rows.length > 0) {
      const nt = normalizeArabic(term);
      const best = [...rows].sort((a, b) => score(b, nt) - score(a, nt))[0];
      return toFood(best);
    }
  }

  // 2. Try in-memory Curated Saudi foods
  for (const term of terms) {
    const curated = searchCuratedFallback(term);
    if (curated) {
      return curated;
    }
  }

  // 3. AI estimate fallback strictly if DB and curated match failed
  console.warn("[foods] no curated DB match, using AI estimate fallback for", item.name_ar, "/", item.name_en);
  return foodFromAi(item);
}

/**
 * Convert a FoodNutrition or ParsedItem match into a canonical MealItem
 * with deterministic plausibility checks applied.
 */
export function toMealItem(params: {
  food: FoodNutrition | null;
  parsedName?: { ar?: string; en?: string };
  category?: FoodCategory;
  grams: number;
  state?: FoodState;
  source?: MacroSource;
  confidence?: "high" | "medium" | "low";
  portion_assumed?: boolean;
  default_portion_g?: number | null;
  reference_unit_g?: number | null;
}): MealItem {
  const name_ar = params.parsedName?.ar || params.food?.name_ar || params.food?.name_en || "صنف";
  const name_en = params.parsedName?.en || params.food?.name_en || params.food?.name_ar || "item";
  const per_100g = params.food?.per100g ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const source: MacroSource =
    params.source || (params.food?.source === "db" ? "db_match" : "ai_estimate");

  const category = params.category || params.food?.category;
  const default_portion_g =
    params.default_portion_g ?? params.food?.default_portion_g ?? null;
  const reference_unit_g =
    params.reference_unit_g ?? params.food?.reference_unit_g ?? null;

  // If portion was assumed and grams were <= 0, use default_portion_g
  let initialGrams = Number(params.grams) || 0;
  if (params.portion_assumed && initialGrams <= 0 && default_portion_g) {
    initialGrams = default_portion_g;
  }
  const safeGrams = Math.max(0, Math.min(5000, initialGrams));

  const rawItem: MealItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    canonical_name: name_en,
    display_name_ar: name_ar,
    grams: safeGrams,
    unit_type: "g",
    state: params.state || params.food?.category === "meat_poultry" ? "cooked" : "ready_to_eat",
    category,
    per_100g: normalizeMacroNutrients(per_100g),
    source,
    food_id: params.food && params.food.source === "db" ? params.food.id : null,
    confidence: params.confidence || "medium",
    portion_assumed: params.portion_assumed ?? false,
    default_portion_g,
    default_full_loaf_or_unit_g: reference_unit_g,
    reference_unit_g,
    plausibility_warning: null,
  };

  return applyPlausibilityChecks(rawItem);
}
