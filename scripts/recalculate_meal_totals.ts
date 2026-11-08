/**
 * Hesbah App — Legacy Meal Totals Recalculation Script
 *
 * Recomputes `meal_items` derived macros and `meals` aggregate totals strictly from
 * `per_100g_snapshot` and `grams` (`per_100g * grams / 100`) to fix any historical
 * double-scaled or drifted records.
 *
 * SAFETY: Defaults to `DRY_RUN = true`. Set `DRY_RUN=false` in the environment
 * only after reviewing the dry-run diff output.
 */

import { createClient } from "@supabase/supabase-js";
import {
  calculateItemMacros,
  calculateMealTotals,
  normalizeMacroNutrients,
} from "../src/lib/nutrition";

const DRY_RUN = process.env.DRY_RUN !== "false";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log(
    `[recalculate_meal_totals] Starting in ${DRY_RUN ? "DRY_RUN (read-only)" : "LIVE WRITE"} mode...`,
  );

  const { data: meals, error } = await supabase
    .from("meals")
    .select("id, description, total_calories, total_protein, total_carbs, total_fat, meal_items(*)");

  if (error) {
    console.error("[recalculate_meal_totals] Failed to fetch meals:", error.message);
    process.exit(1);
  }

  let mealsChanged = 0;
  let itemsChanged = 0;

  for (const meal of meals ?? []) {
    const rawItems: any[] = Array.isArray(meal.meal_items) ? meal.meal_items : [];
    if (rawItems.length === 0) continue;

    const normalizedItemsForTotal: Array<{ per_100g: ReturnType<typeof normalizeMacroNutrients>; grams: number }> = [];

    for (const item of rawItems) {
      const grams = Math.max(0, Number(item.grams) || 100);
      const factor = grams > 0 ? grams / 100 : 1;

      const per100g = item.per_100g_snapshot
        ? normalizeMacroNutrients(item.per_100g_snapshot)
        : normalizeMacroNutrients({
            calories: (Number(item.calories) || 0) / factor,
            protein_g: (Number(item.protein_g) || 0) / factor,
            carbs_g: (Number(item.carbs_g) || 0) / factor,
            fat_g: (Number(item.fat_g) || 0) / factor,
          });

      normalizedItemsForTotal.push({ per_100g: per100g, grams });
      const derived = calculateItemMacros(per100g, grams);

      const itemDiffers =
        Math.abs((Number(item.calories) || 0) - derived.calories) > 1 ||
        Math.abs((Number(item.protein_g) || 0) - derived.protein_g) > 0.2 ||
        Math.abs((Number(item.carbs_g) || 0) - derived.carbs_g) > 0.2 ||
        Math.abs((Number(item.fat_g) || 0) - derived.fat_g) > 0.2;

      if (itemDiffers) {
        itemsChanged++;
        console.log(
          `  [ITEM DIFF] meal=${meal.id} item="${item.name_ar}" (${grams}g): ` +
            `kcal ${item.calories} -> ${derived.calories}, ` +
            `P ${item.protein_g} -> ${derived.protein_g}, ` +
            `C ${item.carbs_g} -> ${derived.carbs_g}, ` +
            `F ${item.fat_g} -> ${derived.fat_g}`,
        );

        if (!DRY_RUN) {
          await supabase
            .from("meal_items")
            .update({
              per_100g_snapshot: per100g,
              calories: derived.calories,
              protein_g: derived.protein_g,
              carbs_g: derived.carbs_g,
              fat_g: derived.fat_g,
            })
            .eq("id", item.id);
        }
      }
    }

    const totals = calculateMealTotals(normalizedItemsForTotal);
    const mealDiffers =
      Math.abs((Number(meal.total_calories) || 0) - totals.calories) > 1 ||
      Math.abs((Number(meal.total_protein) || 0) - totals.protein_g) > 0.2 ||
      Math.abs((Number(meal.total_carbs) || 0) - totals.carbs_g) > 0.2 ||
      Math.abs((Number(meal.total_fat) || 0) - totals.fat_g) > 0.2;

    if (mealDiffers) {
      mealsChanged++;
      console.log(
        `[MEAL DIFF] meal=${meal.id} "${meal.description}": ` +
          `kcal ${meal.total_calories} -> ${totals.calories}, ` +
          `P ${meal.total_protein} -> ${totals.protein_g}, ` +
          `C ${meal.total_carbs} -> ${totals.carbs_g}, ` +
          `F ${meal.total_fat} -> ${totals.fat_g}`,
      );

      if (!DRY_RUN) {
        await supabase
          .from("meals")
          .update({
            total_calories: totals.calories,
            total_protein: totals.protein_g,
            total_carbs: totals.carbs_g,
            total_fat: totals.fat_g,
          })
          .eq("id", meal.id);
      }
    }
  }

  console.log(
    `[recalculate_meal_totals] Done (${DRY_RUN ? "DRY_RUN" : "LIVE"}). ` +
      `Meals with drift: ${mealsChanged}, Items with drift: ${itemsChanged}.`,
  );
}

main().catch((err) => {
  console.error("[recalculate_meal_totals] Fatal error:", err);
  process.exit(1);
});

