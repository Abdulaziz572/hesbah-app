import { supabase } from "./supabaseClient";
import type { FoodNutrition } from "./nutrition";
import type { ParsedItem } from "./ai/types";

type Row = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/** Read the first present key from the per_100g JSONB (case-insensitive, tolerates naming variants). */
const pick = (obj: Row, keys: string[]): number => {
  const lower: Row = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null) return num(v);
  }
  return 0;
};

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

/**
 * Turn a normalized term into an ilike pattern where letters that have variants
 * become single-char wildcards (_), so it matches stored text regardless of spelling
 * (ا -> أ/إ/آ/ا, ه -> ة/ه, ي -> ى/ي) without needing normalized data in the DB.
 */
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
  const o = (p ?? {}) as Row;
  return {
    id: String(row.id ?? row.name_ar ?? ""),
    name_ar: String(row.name_ar ?? ""),
    name_en: String(row.name_en ?? ""),
    source: "db",
    per100g: {
      calories: pick(o, ["calories", "kcal", "energy_kcal", "calories_kcal", "cal", "energy"]),
      protein: pick(o, ["protein", "protein_g", "proteins"]),
      carbs: pick(o, ["carbs", "carbs_g", "carbohydrates", "carbohydrates_g", "carbohydrate", "carb"]),
      fat: pick(o, ["fat", "fat_g", "fats", "total_fat"]),
    },
  };
}

/** Strip characters that break ilike patterns or PostgREST or() syntax. */
const clean = (s: string) => s.replace(/[%_,(){}"\\*:]/g, " ").replace(/\s+/g, " ").trim();

const aliasesOf = (row: Row): string[] =>
  Array.isArray(row.aliases) ? (row.aliases as unknown[]).map(String) : [];

/** PostgrestError props are non-enumerable, so console.error prints {}; spell them out. */
const describeError = (e: { message?: string; code?: string; details?: string; hint?: string }) => ({
  message: e.message,
  code: e.code,
  details: e.details,
  hint: e.hint,
});

/**
 * Query `foods` (live schema: id uuid, owner_id uuid, source text, name_en text, name_ar text,
 * aliases text[], state text, per_100g jsonb, search_text text, created_at timestamptz).
 * - text columns (search_text, name_ar, name_en): ilike inside .or()
 * - aliases is text[]: exact-element match via .contains(), run separately (ilike doesn't work on arrays)
 * search_text already contains the name + aliases, so ilike on it covers most alias matches.
 */
async function search(term: string): Promise<Row[]> {
  const normalized = normalizeArabic(term);
  const pattern = `%${fuzzyPattern(normalized)}%`;
  const filters = [
    `search_text.ilike.${pattern}`,
    `name_ar.ilike.${pattern}`,
    `name_en.ilike.${pattern}`,
  ].join(",");

  const [textRes, aliasRes] = await Promise.all([
    supabase.from("foods").select("*").or(filters).limit(20),
    supabase
      .from("foods")
      .select("*")
      .overlaps("aliases", [...new Set([term, normalized])])
      .limit(20),
  ]);

  if (textRes.error) console.error("Supabase Query Error (text):", describeError(textRes.error));
  if (aliasRes.error) console.error("Supabase Query Error (aliases):", describeError(aliasRes.error));

  const merged = new Map<string, Row>();
  for (const r of [...((textRes.data as Row[]) ?? []), ...((aliasRes.data as Row[]) ?? [])]) {
    merged.set(String(r.id), r);
  }
  console.log(`[foods] "${term}" -> ${merged.size} row(s)`);
  return [...merged.values()];
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

/** Build a food from the AI's own per-100g estimate (used when Supabase has no match). */
function foodFromAi(item: Pick<ParsedItem, "name_ar" | "name_en" | "ai_estimated_per_100g">): FoodNutrition | null {
  const e = item.ai_estimated_per_100g;
  if (!e) return null;
  return {
    id: `ai-${item.name_en}`,
    name_ar: item.name_ar,
    name_en: item.name_en,
    source: "ai",
    per100g: {
      calories: num(e.kcal),
      protein: num(e.protein_g),
      carbs: num(e.carbs_g),
      fat: num(e.fat_g),
    },
  };
}

/**
 * Find the best food for an AI-identified item: Supabase first (source "db"),
 * otherwise fall back to the AI's per-100g estimate (source "ai").
 */
export async function findFood(
  item: Pick<ParsedItem, "name_ar" | "name_en" | "ai_estimated_per_100g">,
): Promise<FoodNutrition | null> {
  const full = [item.name_ar, item.name_en].map((s) => clean(s ?? "")).filter(Boolean);
  // Then individual words, longest first (e.g. "دجاج مشوي" -> "مشوي"/"دجاج").
  const words = full
    .flatMap((s) => s.split(" "))
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length);
  const terms = [...new Set([...full, ...words])];

  for (const term of terms) {
    const rows = await search(term);
    if (rows.length === 0) continue;
    const nt = normalizeArabic(term);
    const best = [...rows].sort((a, b) => score(b, nt) - score(a, nt))[0];
    return toFood(best);
  }
  console.warn("[foods] no Supabase match, using AI estimate for", item.name_ar, "/", item.name_en);
  return foodFromAi(item);
}
