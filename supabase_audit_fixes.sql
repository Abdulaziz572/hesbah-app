-- =============================================================================
-- Hesbah App — Supabase `public.foods` Safe Macro Sanity Audit (Read-Only Default)
-- =============================================================================
-- IMPORTANT SAFETY RULES:
--   1. Section 1 is a READ-ONLY `SELECT` diagnostic query. Run it first to inspect
--      any rows in `public.foods` that fail the Atwater check or category sanity guard.
--   2. DO NOT automatically swap `protein_g` and `carbs_g` in SQL without manual
--      human review of each row.
--   3. NEVER `DELETE` rows that are referenced by `public.meal_items.food_id`.
--      Prefer soft-deprecation (`is_deprecated = true`) or targeted `UPDATE` by `id`
--      after taking a backup.
--   4. All mutating statements in Section 2 are COMMENTED OUT (`--`) by default.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: READ-ONLY DIAGNOSTIC AUDIT (`SELECT` ONLY)
-- Identifies rows where:
--   (A) Atwater energy (4*P + 4*C + 9*F) deviates from calories by > MAX(15%, 15 kcal)
--   (B) Pure protein items ("بيض مسلوق", "صدور دجاج", "دجاج شواية", "تونة") have
--       carbs_g > 4 or protein_g < 10 per 100g
--   (C) Pure grain/bread items ("أرز أبيض", "رز بشاور", "خبز") have
--       protein_g > 15 or carbs_g < 15 per 100g
-- -----------------------------------------------------------------------------
SELECT
  f.id,
  f.name_ar,
  f.name_en,
  f.per_100g,
  COALESCE((f.per_100g->>'calories')::numeric, (f.per_100g->>'kcal')::numeric, 0) AS kcal,
  COALESCE((f.per_100g->>'protein_g')::numeric, (f.per_100g->>'protein')::numeric, 0) AS protein_g,
  COALESCE((f.per_100g->>'carbs_g')::numeric, (f.per_100g->>'carbs')::numeric, 0) AS carbs_g,
  COALESCE((f.per_100g->>'fat_g')::numeric, (f.per_100g->>'fat')::numeric, 0) AS fat_g,
  ROUND(
    4 * COALESCE((f.per_100g->>'protein_g')::numeric, (f.per_100g->>'protein')::numeric, 0) +
    4 * COALESCE((f.per_100g->>'carbs_g')::numeric, (f.per_100g->>'carbs')::numeric, 0) +
    9 * COALESCE((f.per_100g->>'fat_g')::numeric, (f.per_100g->>'fat')::numeric, 0),
    1
  ) AS atwater_kcal,
  EXISTS (SELECT 1 FROM public.meal_items mi WHERE mi.food_id = f.id) AS is_referenced_in_meals
FROM public.foods f
WHERE
  -- (A) Atwater check deviates by more than GREATEST(kcal * 0.15, 15)
  (
    COALESCE((f.per_100g->>'calories')::numeric, (f.per_100g->>'kcal')::numeric, 0) > 0
    AND ABS(
      (
        4 * COALESCE((f.per_100g->>'protein_g')::numeric, (f.per_100g->>'protein')::numeric, 0) +
        4 * COALESCE((f.per_100g->>'carbs_g')::numeric, (f.per_100g->>'carbs')::numeric, 0) +
        9 * COALESCE((f.per_100g->>'fat_g')::numeric, (f.per_100g->>'fat')::numeric, 0)
      ) - COALESCE((f.per_100g->>'calories')::numeric, (f.per_100g->>'kcal')::numeric, 0)
    ) > GREATEST(
      COALESCE((f.per_100g->>'calories')::numeric, (f.per_100g->>'kcal')::numeric, 0) * 0.15,
      15
    )
  )
  OR
  -- (B) Pure Egg / Chicken / Meat / Tuna rows with implausible macros (carbs > 4g or protein < 10g)
  (
    (f.name_ar ~ '^(بيض|بيضة|صدور دجاج|صدر دجاج|دجاج مشوي|دجاج شواية|تونة)'
     AND f.name_ar !~ '(بلاليط|شعيرية|مطبق|فطيرة|سندوتش|خبز|رز|أرز|كبسة)')
    AND (
      COALESCE((f.per_100g->>'carbs_g')::numeric, (f.per_100g->>'carbs')::numeric, 0) > 4
      OR COALESCE((f.per_100g->>'protein_g')::numeric, (f.per_100g->>'protein')::numeric, 0) < 10
    )
  )
  OR
  -- (C) Pure Rice / Bread rows with implausible macros (protein > 15g or carbs < 15g)
  (
    (f.name_ar ~ '^(أرز أبيض|رز أبيض|رز بشاور|خبز بر|خبز تميس|خبز صامولي|خبز عربي)'
     AND f.name_ar !~ '(دجاج|لحم|سمك|تونة|جبن)')
    AND (
      COALESCE((f.per_100g->>'protein_g')::numeric, (f.per_100g->>'protein')::numeric, 0) > 15
      OR COALESCE((f.per_100g->>'carbs_g')::numeric, (f.per_100g->>'carbs')::numeric, 0) < 15
    )
  );

-- =============================================================================
-- SECTION 2: MANUAL REMEDIATION TEMPLATES (COMMENTED OUT — BACKUP FIRST!)
-- =============================================================================
-- WARNING: Before uncommenting and running any statement below:
--   1. Create a backup table:
--      -- CREATE TABLE public.foods_backup_audit AS SELECT * FROM public.foods;
--   2. Inspect the exact `id` values returned by Section 1 above.
--   3. Never hard-delete rows referenced by `public.meal_items`. Use `is_deprecated`.
-- =============================================================================

-- -- Optional: Add soft-deprecation column if not present
-- ALTER TABLE public.foods
--   ADD COLUMN IF NOT EXISTS is_deprecated boolean DEFAULT false;

-- -- Example 1: Fix a verified Boiled Egg ("بيض مسلوق") row by explicit ID after review
-- UPDATE public.foods
-- SET
--   per_100g = jsonb_build_object(
--     'calories', 155,
--     'protein_g', 12.6,
--     'carbs_g', 1.1,
--     'fat_g', 10.6
--   )
-- WHERE id = '<REPLACE_WITH_VERIFIED_FOOD_UUID>';

-- -- Example 2: Soft-deprecate corrupted rows instead of deleting (safe for foreign keys)
-- UPDATE public.foods
-- SET is_deprecated = true
-- WHERE id IN ('<REPLACE_WITH_CORRUPTED_FOOD_UUID>');
