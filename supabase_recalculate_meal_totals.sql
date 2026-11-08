-- =============================================================================
-- Hesbah App — Legacy Meal Totals Recalculation SQL (Read-Only Dry-Run Default)
-- Recomputes `meal_items` and `meals` totals from `per_100g_snapshot * grams / 100`.
-- =============================================================================

-- 1. DRY-RUN PREVIEW: Inspect meals whose stored totals drift from per_100g_snapshot * grams / 100
WITH recomputed_items AS (
  SELECT
    mi.id AS item_id,
    mi.meal_id,
    mi.name_ar,
    mi.grams,
    ROUND(COALESCE((mi.per_100g_snapshot->>'calories')::numeric, 0) * (mi.grams / 100.0)) AS calc_calories,
    ROUND(COALESCE((mi.per_100g_snapshot->>'protein_g')::numeric, 0) * (mi.grams / 100.0), 1) AS calc_protein_g,
    ROUND(COALESCE((mi.per_100g_snapshot->>'carbs_g')::numeric, 0) * (mi.grams / 100.0), 1) AS calc_carbs_g,
    ROUND(COALESCE((mi.per_100g_snapshot->>'fat_g')::numeric, 0) * (mi.grams / 100.0), 1) AS calc_fat_g
  FROM public.meal_items mi
  WHERE mi.per_100g_snapshot IS NOT NULL
),
recomputed_meals AS (
  SELECT
    meal_id,
    ROUND(SUM(calc_calories)) AS new_total_calories,
    ROUND(SUM(calc_protein_g), 1) AS new_total_protein,
    ROUND(SUM(calc_carbs_g), 1) AS new_total_carbs,
    ROUND(SUM(calc_fat_g), 1) AS new_total_fat
  FROM recomputed_items
  GROUP BY meal_id
)
SELECT
  m.id AS meal_id,
  m.description,
  m.total_calories AS old_kcal,
  rm.new_total_calories AS new_kcal,
  m.total_protein AS old_p,
  rm.new_total_protein AS new_p,
  m.total_carbs AS old_c,
  rm.new_total_carbs AS new_c,
  m.total_fat AS old_f,
  rm.new_total_fat AS new_f
FROM public.meals m
JOIN recomputed_meals rm ON rm.meal_id = m.id
WHERE
  ABS(COALESCE(m.total_calories, 0) - rm.new_total_calories) > 1
  OR ABS(COALESCE(m.total_protein, 0) - rm.new_total_protein) > 0.2
  OR ABS(COALESCE(m.total_carbs, 0) - rm.new_total_carbs) > 0.2
  OR ABS(COALESCE(m.total_fat, 0) - rm.new_total_fat) > 0.2;

-- =============================================================================
-- 2. OPTIONAL APPLY (COMMENTED OUT BY DEFAULT — UNCOMMENT AFTER REVIEWING DIFF)
-- =============================================================================
-- UPDATE public.meal_items mi
-- SET
--   calories  = ROUND(COALESCE((mi.per_100g_snapshot->>'calories')::numeric, 0) * (mi.grams / 100.0)),
--   protein_g = ROUND(COALESCE((mi.per_100g_snapshot->>'protein_g')::numeric, 0) * (mi.grams / 100.0), 1),
--   carbs_g   = ROUND(COALESCE((mi.per_100g_snapshot->>'carbs_g')::numeric, 0) * (mi.grams / 100.0), 1),
--   fat_g     = ROUND(COALESCE((mi.per_100g_snapshot->>'fat_g')::numeric, 0) * (mi.grams / 100.0), 1)
-- WHERE mi.per_100g_snapshot IS NOT NULL;

