import { describe, it, expect } from "vitest";
import {
  calculateItemMacros,
  calculateMealTotals,
  createMacroNutrients,
  normalizeMacroNutrients,
  calcMacros,
  sumMacros,
} from "../src/lib/nutrition";
import { toMealItem } from "../src/lib/foodLookup";
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
    // 250g of rice: 130 * 2.5 = 325 cal, 2.7 * 2.5 = 6.75 -> 6.8g prot, 28.2 * 2.5 = 70.5g carbs, 0.3 * 2.5 = 0.75 -> 0.8g fat
    const macros250 = calculateItemMacros(ricePer100g, 250);
    expect(macros250.calories).toBe(325);
    expect(macros250.protein_g).toBe(6.8);
    expect(macros250.carbs_g).toBe(70.5);
    expect(macros250.fat_g).toBe(0.8);

    // 50g of rice (half portion)
    const macros50 = calculateItemMacros(ricePer100g, 50);
    expect(macros50.calories).toBe(65);
    expect(macros50.protein_g).toBe(1.4);
    expect(macros50.carbs_g).toBe(14.1);
    expect(macros50.fat_g).toBe(0.2);
  });

  it("eliminates the double-scaling bug when grams change multiple times", () => {
    // Start with 100g
    let currentGrams = 100;
    const item = {
      per_100g: ricePer100g,
      grams: currentGrams,
    };

    // User scales to 200g
    currentGrams = 200;
    const scaled200 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled200.calories).toBe(260);

    // User scales from 200g to 300g (MUST scale from per_100g, NOT from 260 calories)
    currentGrams = 300;
    const scaled300 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled300.calories).toBe(390); // If double-scaled it would be 260 * 3 = 780 or 260 * 1.5 = 390 then compounding

    // User drops to 50g
    currentGrams = 50;
    const scaled50 = calculateItemMacros(item.per_100g, currentGrams);
    expect(scaled50.calories).toBe(65);
    expect(scaled50.protein_g).toBe(1.4);
  });

  it("calculates meal totals deterministically across multiple items", () => {
    const chickenPer100g: MacroNutrients = {
      calories: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
    };

    const items = [
      { per_100g: chickenPer100g, grams: 200 }, // 330 cal, 62g P, 0g C, 7.2g F
      { per_100g: ricePer100g, grams: 150 },    // 195 cal, 4.1g P, 42.3g C, 0.5g F
    ];

    const totals = calculateMealTotals(items);
    expect(totals.calories).toBe(525);
    expect(totals.protein_g).toBe(66.1);
    expect(totals.carbs_g).toBe(42.3);
    expect(totals.fat_g).toBe(7.7);
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
      // carbs and fat missing
    };

    const norm = normalizeMacroNutrients(dirty);
    expect(norm.calories).toBe(121);
    expect(norm.protein_g).toBe(9.5);
    expect(norm.carbs_g).toBe(0);
    expect(norm.fat_g).toBe(0);
  });

  it("legacy calcMacros and sumMacros wrappers work with both formats", () => {
    const food = {
      per100g: {
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
        per100g: {
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
