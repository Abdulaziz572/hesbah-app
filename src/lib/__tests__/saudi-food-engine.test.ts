import { describe, it, expect } from "vitest";
import {
  calculateItemMacros,
  applyPlausibilityChecks,
  createMacroNutrients,
  type MealItem,
} from "../nutrition";
import { searchCuratedFallback, toMealItem } from "../foodLookup";
import { MealParser } from "../ai/MealParser";
import type { ParsedItem } from "../ai/types";

describe("Saudi Food Engine — Curated Seed Data & Lookups", () => {
  it("resolves Plain Tamees from curated in-memory dataset with accurate reference portions", () => {
    const food = searchCuratedFallback("خبز تميس عادي");
    expect(food).not.toBeNull();
    expect(food?.name_ar).toBe("خبز تميس عادي");
    expect(food?.default_portion_g).toBe(90);
    expect(food?.reference_unit_g).toBe(360);
    expect(food?.per100g.calories).toBe(275);
    expect(food?.per100g.protein_g).toBe(8.5);
    expect(food?.per100g.carbs_g).toBe(54);
    expect(food?.per100g.fat_g).toBe(2.5);
  });

  it("calculates Tamees default portion (90g) to ~248 kcal and ~7.7g protein (never 35g)", () => {
    const food = searchCuratedFallback("تميس");
    expect(food).not.toBeNull();

    const mealItem = toMealItem({
      food,
      grams: food!.default_portion_g!,
      portion_assumed: true,
    });

    expect(mealItem.grams).toBe(90);
    const macros = calculateItemMacros(mealItem.per_100g, mealItem.grams);

    // 275 * 0.9 = 247.5 -> 248 kcal
    expect(macros.calories).toBe(248);
    // 8.5 * 0.9 = 7.65 -> 7.7g protein
    expect(macros.protein_g).toBe(7.7);
    expect(macros.protein_g).toBeLessThan(10);
    expect(macros.calories).toBeLessThan(300);
  });

  it("scales Tamees deterministically across portion chips (ربع 90g, نص 180g, كامل 360g)", () => {
    const food = searchCuratedFallback("تميس عادي");
    expect(food).not.toBeNull();
    const p100 = food!.per100g;

    // ربع تميس (90g)
    const quarter = calculateItemMacros(p100, 90);
    expect(quarter.calories).toBe(248);
    expect(quarter.protein_g).toBe(7.7);

    // نص تميس (180g)
    const half = calculateItemMacros(p100, 180);
    expect(half.calories).toBe(495);
    expect(half.protein_g).toBe(15.3);

    // تميس كامل (360g)
    const whole = calculateItemMacros(p100, 360);
    expect(whole.calories).toBe(990);
    expect(whole.protein_g).toBe(30.6);
  });

  it("scales Cooked Chicken meat across portion chips (ربع دجاجة 115g, نص دجاجة 230g, كاملة 460g)", () => {
    const food = searchCuratedFallback("دجاج شواية");
    expect(food).not.toBeNull();
    const p100 = food!.per100g;

    // ربع دجاجة صافي اللحم (115g)
    const quarter = calculateItemMacros(p100, 115);
    expect(quarter.calories).toBe(247);
    expect(quarter.protein_g).toBe(29.9);

    // نص دجاجة صافي اللحم (230g)
    const half = calculateItemMacros(p100, 230);
    expect(half.calories).toBe(494);
    expect(half.protein_g).toBe(59.8);

    // دجاجة كاملة صافي اللحم (460g)
    const whole = calculateItemMacros(p100, 460);
    expect(whole.calories).toBe(989);
    expect(whole.protein_g).toBe(119.6);
  });
});

describe("Saudi Food Engine — Composite Dish Decomposition", () => {
  it("decomposes 'كبسة دجاج' into Rice (250g) + Cooked Chicken (115g)", () => {
    const compositeItem: ParsedItem = {
      name_ar: "كبسة دجاج",
      name_en: "Chicken Kabsa",
      canonical_name: "Chicken Kabsa",
      cooking_state: "cooked",
      confidence: "high",
      visible: true,
      quantity: { grams_min: 300, grams_max: 400, basis: "user_stated" },
      portion_assumed: true,
      ai_fallback_per_100g: { kcal: 200, protein_g: 15, carbs_g: 25, fat_g: 6 },
      needs_user_confirmation: [],
      warnings: [],
    };

    const decomposed = MealParser.decomposeCompositeDishes([compositeItem]);
    expect(decomposed.length).toBe(2);

    const rice = decomposed[0];
    const chicken = decomposed[1];

    expect(rice.name_ar).toContain("أرز كبسة");
    expect(rice.category).toBe("rice_grain");
    expect(rice.extracted_grams).toBe(250);

    expect(chicken.name_ar).toContain("دجاج");
    expect(chicken.category).toBe("meat_poultry");
    expect(chicken.extracted_grams).toBe(115);

    // Check calculated meal totals:
    // Rice (250g of 155 kcal / 3g P): ~388 kcal, 7.5g P
    const riceMacros = calculateItemMacros(
      { calories: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
      rice.extracted_grams!,
    );
    expect(riceMacros.calories).toBe(388);
    expect(riceMacros.protein_g).toBe(7.5);

    // Chicken (115g of 215 kcal / 26g P): ~247 kcal, 29.9g P
    const chickenMacros = calculateItemMacros(
      { calories: 215, protein_g: 26, carbs_g: 0, fat_g: 11.5 },
      chicken.extracted_grams!,
    );
    expect(chickenMacros.calories).toBe(247);
    expect(chickenMacros.protein_g).toBe(29.9);

    const totalCalories = riceMacros.calories + chickenMacros.calories;
    const totalProtein = riceMacros.protein_g + chickenMacros.protein_g;

    expect(totalCalories).toBe(635);
    expect(totalProtein).toBeCloseTo(37.4, 1);
    // Crucial check: Chicken Kabsa plate should NEVER return 60g+ protein!
    expect(totalProtein).toBeLessThan(45);
  });
});

describe("Saudi Food Engine — Deterministic Plausibility Checks", () => {
  it("clamps hallucinated bread protein (> 14g/100g) down to 14g and attaches warning", () => {
    const hallucinatedBread: MealItem = {
      id: "test-hallucinated-bread",
      canonical_name: "Tamees Bread",
      display_name_ar: "خبز تميس",
      category: "bread_pastry",
      grams: 90,
      state: "ready_to_eat",
      per_100g: createMacroNutrients(275, 35, 54, 2.5), // 35g protein hallucination!
      source: "ai_estimate",
      confidence: "medium",
      portion_assumed: true,
    };

    const sanitized = applyPlausibilityChecks(hallucinatedBread);
    expect(sanitized.per_100g.protein_g).toBe(14);
    expect(sanitized.plausibility_warning).toContain("الأقصى للمخبوزات");
  });

  it("clamps assumed portion on bread if weight > 150g down to default portion (90g)", () => {
    const hugeAssumedBread: MealItem = {
      id: "test-huge-bread",
      canonical_name: "Tamees Bread",
      display_name_ar: "خبز تميس عادي",
      category: "bread_pastry",
      grams: 360, // Whole loaf erroneously assumed
      default_portion_g: 90,
      state: "ready_to_eat",
      per_100g: createMacroNutrients(275, 8.5, 54, 2.5),
      source: "db_match",
      confidence: "medium",
      portion_assumed: true,
    };

    const sanitized = applyPlausibilityChecks(hugeAssumedBread);
    expect(sanitized.grams).toBe(90);
    expect(sanitized.plausibility_warning).toContain("الحصة الافتراضية للمخبوزات");
  });

  it("clamps cooked plain rice protein to max 5g/100g", () => {
    const hallucinatedRice: MealItem = {
      id: "test-hallucinated-rice",
      canonical_name: "White Rice",
      display_name_ar: "أرز أبيض مسلوق",
      category: "rice_grain",
      grams: 200,
      state: "cooked",
      per_100g: createMacroNutrients(130, 15, 28, 0.3), // 15g protein hallucination on rice!
      source: "ai_estimate",
      confidence: "medium",
      portion_assumed: false,
    };

    const sanitized = applyPlausibilityChecks(hallucinatedRice);
    expect(sanitized.per_100g.protein_g).toBe(5);
    expect(sanitized.plausibility_warning).toContain("المنطقي");
  });

  it("clamps date palms protein to max 4g/100g", () => {
    const hallucinatedDates: MealItem = {
      id: "test-hallucinated-dates",
      canonical_name: "Dates",
      display_name_ar: "تمر خلاص",
      category: "fruit_dates",
      grams: 30,
      state: "ready_to_eat",
      per_100g: createMacroNutrients(280, 12, 75, 0.4), // 12g protein on dates!
      source: "ai_estimate",
      confidence: "medium",
      portion_assumed: false,
    };

    const sanitized = applyPlausibilityChecks(hallucinatedDates);
    expect(sanitized.per_100g.protein_g).toBe(4);
  });

  it("enforces Atwater calorie consistency when calories deviate by > 20% and > 25 kcal", () => {
    // P: 10g (40 kcal), C: 20g (80 kcal), F: 5g (45 kcal) => Expected: 165 kcal.
    // Hallucinated calories: 350 kcal (more than double!)
    const mismatchedItem: MealItem = {
      id: "test-atwater",
      canonical_name: "Test Food",
      display_name_ar: "صنف تجريبي",
      category: "other",
      grams: 100,
      state: "ready_to_eat",
      per_100g: createMacroNutrients(350, 10, 20, 5),
      source: "ai_estimate",
      confidence: "medium",
      portion_assumed: false,
    };

    const sanitized = applyPlausibilityChecks(mismatchedItem);
    expect(sanitized.per_100g.calories).toBe(165);
    expect(sanitized.plausibility_warning).toContain("أتووتر");
  });

  it("scales impossible macro sum when P + C + F > 100g per 100g", () => {
    // 50g P + 60g C + 30g F = 140g per 100g (Physically impossible!)
    const impossibleItem: MealItem = {
      id: "test-impossible-sum",
      canonical_name: "Impossible Food",
      display_name_ar: "طعام مستحيل",
      category: "other",
      grams: 100,
      state: "ready_to_eat",
      per_100g: createMacroNutrients(500, 50, 60, 30),
      source: "ai_estimate",
      confidence: "medium",
      portion_assumed: false,
    };

    const sanitized = applyPlausibilityChecks(impossibleItem);
    const sum =
      sanitized.per_100g.protein_g + sanitized.per_100g.carbs_g + sanitized.per_100g.fat_g;
    expect(sum).toBeLessThanOrEqual(100.1);
    expect(sanitized.plausibility_warning).toContain("الحد الفيزيائي الأقصى");
  });
});
