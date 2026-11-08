import { describe, it, expect } from "vitest";
import {
  applyPlausibilityChecks,
  calculateItemMacros,
  calculateMealTotals,
  createMacroNutrients,
  normalizeMacroNutrients,
  normalizeItem,
  passesMacroSanityGuard,
  resolvePortionGrams,
  extractSizeModifier,
  getItemType,
  PORTION_TABLE,
  calcMacros,
  sumMacros,
} from "../src/lib/nutrition";
import {
  toMealItem,
  searchCuratedFallback,
  matchPinnedStaple,
  curatedToFood,
  normalizeQuery,
  STAPLE_SAUDI_FOODS,
  CURATED_SAUDI_FOODS,
  SFCT_SAUDI_FOODS,
} from "../src/lib/foodLookup";
import type { MacroNutrients, MealItem } from "../src/lib/ai/types";

describe("Deterministic Macro Calculations & Single Base of Truth", () => {
  const ricePer100g: MacroNutrients = {
    calories: 130,
    protein_g: 2.7,
    carbs_g: 28.2,
    fat_g: 0.3,
  };

  it("returns exact per_100g values when grams is 100g", () => {
    const macros = calculateItemMacros(ricePer100g, 100);
    expect(macros.calories).toBe(130);
    expect(macros.protein_g).toBe(2.7);
    expect(macros.carbs_g).toBe(28.2);
    expect(macros.fat_g).toBe(0.3);
  });

  it("handles 0g and negative grams safely without negative numbers or NaN", () => {
    const zero = calculateItemMacros(ricePer100g, 0);
    expect(zero).toEqual({
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });

    const neg = calculateItemMacros(ricePer100g, -50);
    expect(neg).toEqual({
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
  });

  it("calculates fractional portions accurately with correct rounding", () => {
    const macros250 = calculateItemMacros(ricePer100g, 250);
    expect(macros250.calories).toBe(325);
    expect(macros250.protein_g).toBe(6.8);
    expect(macros250.carbs_g).toBe(70.5);
    expect(macros250.fat_g).toBe(0.8);

    const macros50 = calculateItemMacros(ricePer100g, 50);
    expect(macros50.calories).toBe(65);
    expect(macros50.protein_g).toBe(1.4);
    expect(macros50.carbs_g).toBe(14.1);
    expect(macros50.fat_g).toBe(0.2);
  });

  it("eliminates the double-scaling bug when grams change multiple times", () => {
    let currentGrams = 100;
    const item = {
      per_100g: ricePer100g,
      grams: currentGrams,
    };

    currentGrams = 200;
    const scaled200 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled200.calories).toBe(260);

    currentGrams = 300;
    const scaled300 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled300.calories).toBe(390);

    currentGrams = 50;
    const scaled50 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled50.calories).toBe(65);
    expect(scaled50.protein_g).toBe(1.4);
  });

  it("calculates meal totals deterministically across multiple items (round-trip consistency)", () => {
    const chickenPer100g: MacroNutrients = {
      calories: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
    };

    const items = [
      { per_100g: chickenPer100g, grams: 200 },
      { per_100g: ricePer100g, grams: 150 },
    ];

    const totals = calculateMealTotals(items);
    expect(totals.calories).toBe(525);
    expect(totals.protein_g).toBe(66.1);
    expect(totals.carbs_g).toBe(42.3);
    expect(totals.fat_g).toBe(7.7);

    // Round-trip: sum of calculateItemMacros matches calculateMealTotals
    const m1 = calculateItemMacros(items[0].per_100g, items[0].grams);
    const m2 = calculateItemMacros(items[1].per_100g, items[1].grams);
    expect(m1.calories + m2.calories).toBe(totals.calories);
    expect(Math.round((m1.protein_g + m2.protein_g) * 10) / 10).toBe(totals.protein_g);
  });
});

describe("Legacy Normalization & Backward Compatibility", () => {
  it("normalizes DB rows with legacy keys (kcal, protein, carbohydrates, total_fat)", () => {
    const legacyDbRow = {
      kcal: 250,
      protein: 15.4,
      carbohydrates: 30.2,
      total_fat: 8.1,
    };

    const norm = normalizeMacroNutrients(legacyDbRow);
    expect(norm.calories).toBe(250);
    expect(norm.protein_g).toBe(15.4);
    expect(norm.carbs_g).toBe(30.2);
    expect(norm.fat_g).toBe(8.1);
  });

  it("normalizes DB rows with USDA / Arabic JSON keys (energy_kcal, carbs_g, fat_g, protein_g)", () => {
    const usdaRow = {
      energy_kcal: 140,
      protein_g: 3,
      carbs_g: 28,
      fat_g: 1.5,
    };

    const norm = normalizeMacroNutrients(usdaRow);
    expect(norm.calories).toBe(140);
    expect(norm.protein_g).toBe(3);
    expect(norm.carbs_g).toBe(28);
    expect(norm.fat_g).toBe(1.5);
  });

  it("handles stringified numbers and missing fields cleanly", () => {
    const dirty = {
      calories: "120.7",
      protein: "9.5",
    };

    const norm = normalizeMacroNutrients(dirty);
    expect(norm.calories).toBe(121);
    expect(norm.protein_g).toBe(9.5);
    expect(norm.carbs_g).toBe(0);
    expect(norm.fat_g).toBe(0);
  });

  it("legacy calcMacros and sumMacros wrappers work with per_100g", () => {
    const food = {
      per_100g: {
        calories: 200,
        protein_g: 20,
        carbs_g: 10,
        fat_g: 5,
      },
    };

    const scaled = calcMacros(food, 150);
    expect(scaled.calories).toBe(300);
    expect(scaled.protein).toBe(30);
    expect(scaled.carbs).toBe(15);
    expect(scaled.fat).toBe(7.5);

    const sum = sumMacros([scaled]);
    expect(sum.calories).toBe(300);
  });
});

describe("Shared MealItem Construction", () => {
  it("builds a canonical MealItem using toMealItem", () => {
    const item: MealItem = toMealItem({
      food: {
        id: "food-123",
        name_ar: "كبسة دجاج",
        name_en: "Chicken Kabsa",
        source: "db",
        per_100g: {
          calories: 180,
          protein_g: 12,
          carbs_g: 22,
          fat_g: 5,
        },
      },
      grams: 300,
      state: "cooked",
      confidence: "high",
    });

    expect(item.canonical_name).toBe("Chicken Kabsa");
    expect(item.display_name_ar).toBe("كبسة دجاج");
    expect(item.grams).toBe(300);
    expect(item.unit_type).toBe("g");
    expect(item.state).toBe("cooked");
    expect(item.source).toBe("db_match");
    expect(item.food_id).toBe("food-123");
    expect(item.confidence).toBe("high");
    expect(item.per_100g).toEqual({
      calories: 180,
      protein_g: 12,
      carbs_g: 22,
      fat_g: 5,
    });
  });
});

describe("11 Production Fixes & Golden Regression Suite", () => {
  it("1) [Critical] Boiled egg count uses default_portion_g (50g) and never reference_unit_g (250g)", () => {
    const eggEntry = STAPLE_SAUDI_FOODS.find((f) => f.id === "curated-boiled-egg")!;
    const eggStaple = { ...curatedToFood(eggEntry), source: "db" as const };
    expect(eggStaple.default_portion_g).toBe(50);
    expect(eggStaple.reference_unit_g).toBe(250);

    // "بيض مسلوق 4 حبات" -> 200g (NOT 1000g)
    const g4 = resolvePortionGrams({ name_ar: "بيض مسلوق 4 حبات", name_en: "4 boiled eggs" }, eggStaple);
    expect(g4).toBe(200);

    // "بيضتين" -> 100g
    const g2 = resolvePortionGrams({ name_ar: "بيضتين", name_en: "2 boiled eggs" }, eggStaple);
    expect(g2).toBe(100);

    // "بيضة" -> 50g
    const g1 = resolvePortionGrams({ name_ar: "بيضة", name_en: "1 boiled egg" }, eggStaple);
    expect(g1).toBe(50);

    // General countable invariant: grams / default_portion_g is an integer when entered by count
    const countableFoods = STAPLE_SAUDI_FOODS.filter((f) => f.item_type === "countable");
    for (const entry of countableFoods) {
      const food = curatedToFood(entry);
      const defG = food.default_portion_g!;
      const resolved3 = resolvePortionGrams({ name_ar: `${food.name_ar} 3 حبات` }, food);
      expect(Math.round((resolved3 / defG) * 100) / 100).toBe(3);
    }

    // Plausibility warning when weight exceeds 5x default_portion_g (e.g. 300g > 250g for eggs)
    const checked = applyPlausibilityChecks({
      id: "egg-test",
      canonical_name: eggStaple.name_en,
      display_name_ar: eggStaple.name_ar,
      grams: 300,
      default_portion_g: 50,
      state: "cooked",
      per_100g: eggStaple.per_100g,
      source: "db_match",
      confidence: "high",
      portion_assumed: false,
    });
    expect(checked.plausibility_warning).toBeDefined();
  });

  it("2) Countable vs Plated item classification for portion chips", () => {
    expect(getItemType("بيض مسلوق", "Boiled Egg", "dairy_egg")).toBe("countable");
    expect(getItemType("خبز بر", "Brown Bread", "bread_pastry")).toBe("countable");
    expect(getItemType("تمر خلاص", "Dates", "fruit_dates")).toBe("countable");
    expect(getItemType("سمبوسة لحم", "Sambusa", "snack_fastfood")).toBe("countable");
    expect(getItemType("صامولي", "Samoli", "bread_pastry")).toBe("countable");

    expect(getItemType("صحن رز بخاري", "Bukhari Rice", "rice_grain")).toBe("plated");
    expect(getItemType("خبز تميس", "Tamees", "bread_pastry")).toBe("plated");
    expect(getItemType("دجاج شواية", "Rotisserie Chicken", "meat_poultry")).toBe("plated");
    expect(getItemType("فول مدمس", "Foul", "legume")).toBe("plated");

    expect(PORTION_TABLE.find((r) => r.id === "boiled_or_fried_egg")!.itemType).toBe("countable");
    expect(PORTION_TABLE.find((r) => r.id === "rice_dish")!.itemType).toBe("plated");
  });

  it("3) Deterministic size modifiers: صغير (×0.6), وسط (×1.0), كبير (×1.4)", () => {
    expect(extractSizeModifier("صحن رز بخاري صغير")).toBe("small");
    expect(extractSizeModifier("صحن رز بخاري وسط")).toBe("medium");
    expect(extractSizeModifier("صحن رز بخاري كبير")).toBe("large");

    const smallRiceGrams = resolvePortionGrams({
      name_ar: "صحن رز بخاري صغير",
      name_en: "Small plate of Bukhari rice",
      category: "rice_grain",
    });
    expect(smallRiceGrams).toBe(150);
    expect(smallRiceGrams).toBeLessThanOrEqual(175);

    const medRiceGrams = resolvePortionGrams({
      name_ar: "صحن رز بخاري وسط",
      name_en: "Medium plate of Bukhari rice",
      category: "rice_grain",
    });
    expect(medRiceGrams).toBe(250);

    const largeRiceGrams = resolvePortionGrams({
      name_ar: "صحن رز بخاري كبير",
      name_en: "Large plate of Bukhari rice",
      category: "rice_grain",
    });
    expect(largeRiceGrams).toBe(350);
  });

  it("4) 'دجاج شواية', 'حبة دجاج شواية', 'نص دجاجة' match pinned cooked chicken staple with concise name and edible boneless weights", () => {
    const m1 = searchCuratedFallback("دجاج شواية");
    expect(m1).not.toBeNull();
    expect(m1!.id).toBe("curated-chicken-cooked");
    expect(m1!.name_ar).toBe("دجاج شواية");
    expect(m1!.name_ar).not.toContain("(");
    expect(m1!.per_100g.calories).toBe(215);
    expect(m1!.per_100g.protein_g).toBe(26);

    const mWhole = searchCuratedFallback("حبة دجاج شواية");
    expect(mWhole?.id).toBe("curated-chicken-cooked");
    expect(resolvePortionGrams({ name_ar: "حبة دجاج شواية" }, mWhole)).toBe(460);

    const mHalf = searchCuratedFallback("نص دجاجة");
    expect(mHalf?.id).toBe("curated-chicken-cooked");
    expect(resolvePortionGrams({ name_ar: "نص دجاجة" }, mHalf)).toBe(230);

    const mQuarter = searchCuratedFallback("ربع دجاجة");
    expect(mQuarter?.id).toBe("curated-chicken-cooked");
    expect(resolvePortionGrams({ name_ar: "ربع دجاجة" }, mQuarter)).toBe(115);
  });

  it("5) Canned tuna normalization & net drained weights (small=60g, medium=100g, large=130g) + water vs oil", () => {
    expect(normalizeQuery("علبة تونة كبيرة")).toBe("تونه");
    expect(normalizeQuery("علبه تونه كبيره معلبه")).toBe("تونه");

    const mLarge1 = searchCuratedFallback("علبة تونة كبيرة");
    expect(mLarge1).not.toBeNull();
    expect(mLarge1!.id).toBe("curated-tuna-water");
    expect(resolvePortionGrams({ name_ar: "علبة تونة كبيرة" }, mLarge1)).toBe(130);

    const mLarge2 = searchCuratedFallback("علبه تونه كبيره معلبه");
    expect(mLarge2).not.toBeNull();
    expect(mLarge2!.id).toBe("curated-tuna-water");
    expect(resolvePortionGrams({ name_ar: "علبه تونه كبيره معلبه" }, mLarge2)).toBe(130);

    const mSmall = searchCuratedFallback("علبة تونة صغيرة");
    expect(resolvePortionGrams({ name_ar: "علبة تونة صغيرة" }, mSmall)).toBe(60);

    const mMed = searchCuratedFallback("علبة تونة");
    expect(resolvePortionGrams({ name_ar: "علبة تونة" }, mMed)).toBe(100);

    // Unspecified tuna sets portion_assumed = true
    const tunaMealItem = toMealItem({
      food: mLarge1!,
      grams: 130,
      parsedName: { ar: "علبة تونة كبيرة" },
    });
    expect(tunaMealItem.portion_assumed).toBe(true);

    // Tuna in oil matches curated-tuna-oil
    const mOil = searchCuratedFallback("تونة بالزيت");
    expect(mOil).not.toBeNull();
    expect(mOil!.id).toBe("curated-tuna-oil");
  });

  it("6) Beverages use unit_type: 'ml' ('بيبسي دايت' -> 330ml, 0 kcal)", () => {
    const pepsi = searchCuratedFallback("بيبسي دايت");
    expect(pepsi).not.toBeNull();
    expect(pepsi!.id).toBe("curated-diet-pepsi");
    expect(pepsi!.unit_type).toBe("ml");
    expect(pepsi!.per_100g.calories).toBe(0);

    const item = toMealItem({ food: pepsi!, grams: pepsi!.default_portion_g! });
    expect(item.unit_type).toBe("ml");
    expect(item.grams).toBe(330);
    expect(calculateItemMacros(item.per_100g, item.grams).calories).toBe(0);
  });

  it("7) matchPinnedStaple enforces exact match only and bypasses branded queries", () => {
    // Branded query "حليب المراعي بروتين" MUST NOT match generic "حليب" staple
    expect(matchPinnedStaple("حليب المراعي بروتين")).toBeNull();

    // Exact query "حليب" matches generic milk staple
    const plainMilk = matchPinnedStaple("حليب");
    expect(plainMilk).not.toBeNull();
    expect(plainMilk!.id).toBe("curated-milk-full");
    expect(plainMilk!.unit_type).toBe("ml");
  });

  it("8) All entries in STAPLE_SAUDI_FOODS, CURATED_SAUDI_FOODS, and SFCT_SAUDI_FOODS pass passesMacroSanityGuard", () => {
    for (const f of STAPLE_SAUDI_FOODS) {
      expect(
        passesMacroSanityGuard(f.name_ar, f.per_100g),
        `STAPLE failed: ${f.id} (${f.name_ar})`,
      ).toBe(true);
    }
    for (const f of CURATED_SAUDI_FOODS) {
      expect(
        passesMacroSanityGuard(f.name_ar, f.per_100g),
        `CURATED failed: ${f.id} (${f.name_ar})`,
      ).toBe(true);
    }
    for (const f of SFCT_SAUDI_FOODS) {
      expect(
        passesMacroSanityGuard(f.name_ar, f.per_100g),
        `SFCT failed: ${f.id} (${f.name_ar})`,
      ).toBe(true);
    }
  });

  it("Golden Test: 'أكلت سكوبين بروتين' (60g from 30g/27gP label) -> 54g Protein (no double scaling)", () => {
    const query = "أكلت سكوبين بروتين";
    const matched = matchPinnedStaple(query);
    expect(matched).not.toBeNull();
    expect(matched!.id).toBe("curated-whey-protein");

    const grams = resolvePortionGrams({ name_ar: query, name_en: "2 scoops whey protein" }, matched);
    expect(grams).toBe(60);

    const labelNormalized = normalizeItem({
      name: query,
      grams,
      serving_macros: {
        calories: 120,
        protein_g: 27,
        carbs_g: 1,
        fat_g: 1,
        basis_grams: 30,
      },
    });

    expect(labelNormalized.per_100g.protein_g).toBe(90);
    expect(labelNormalized.protein).toBe(54);
    expect(labelNormalized.calories).toBe(240);
  });

  it("Hard Macro Sanity Guard rejects swapped or corrupted DB rows", () => {
    expect(
      passesMacroSanityGuard("بيض مسلوق", {
        calories: 135,
        protein_g: 4.5,
        carbs_g: 21.0,
        fat_g: 3.5,
      }),
    ).toBe(false);

    expect(
      passesMacroSanityGuard("أرز أبيض مطبوخ", {
        calories: 130,
        protein_g: 28.0,
        carbs_g: 2.7,
        fat_g: 0.3,
      }),
    ).toBe(false);

    expect(
      passesMacroSanityGuard("تفاح", {
        calories: 500,
        protein_g: 1,
        carbs_g: 14,
        fat_g: 0.2,
      }),
    ).toBe(false);
  });
});
