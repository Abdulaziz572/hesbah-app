-- ============================================================
-- Hesbah App — Saudi Food Composition Tables (SFCT 2025) Seed
-- Laboratory-analyzed traditional Saudi dishes with athlete micronutrients & electrolytes
-- Idempotent upsert script safe for repeated execution in Supabase SQL editor.
-- ============================================================

-- 1. Ensure metadata columns exist
alter table public.foods add column if not exists category text;
alter table public.foods add column if not exists default_portion_g numeric;
alter table public.foods add column if not exists reference_unit_g numeric;
alter table public.foods add column if not exists cal_range_min numeric;
alter table public.foods add column if not exists cal_range_max numeric;
alter table public.foods add column if not exists protein_range_min numeric;
alter table public.foods add column if not exists protein_range_max numeric;
alter table public.foods add column if not exists uncertainty_level text;
alter table public.foods add column if not exists verification_notes text;

-- 2. Create partial unique index to support idempotent ON CONFLICT for SFCT dishes
create unique index if not exists foods_sfct_source_name_ar_idx 
  on public.foods (name_ar) 
  where source = 'sfct_2025';

-- 3. Insert or Update SFCT 2025 Laboratory Dishes
insert into public.foods (
  name_ar, name_en, source, category, state, per_100g,
  default_portion_g, reference_unit_g, cal_range_min, cal_range_max,
  protein_range_min, protein_range_max, uncertainty_level, verification_notes, aliases, search_text
)
values
  -- 1. قرصان نجد
  (
    'قرصان نجد', 'Najdi Qursan', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 132, "protein_g": 3.7, "carbs_g": 10.3, "fat_g": 7.5, "fiber_g": 4.1, "sugar_g": 1.03, "saturated_fat_g": 2.22, "cholesterol_mg": 15.7, "sodium_mg": 422, "potassium_mg": 232, "magnesium_mg": 25, "calcium_mg": 23, "iron_mg": 1.1, "zinc_mg": 0.77}'::jsonb,
    623, 2492, 115, 150, 3.1, 4.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.15)',
    array['قرصان', 'القرصان', 'قرصان نجد', 'قرصان بالخضار', 'قرصان لحم', 'qursan', 'gursan'],
    'قرصان القرصان قرصان نجد قرصان بالخضار قرصان لحم najdi qursan'
  ),
  -- 2. جريش نجد
  (
    'جريش نجد', 'Najdi Jareesh', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 163, "protein_g": 8.4, "carbs_g": 14.0, "fat_g": 7.4, "fiber_g": 3.7, "sugar_g": 0, "saturated_fat_g": 2.78, "cholesterol_mg": 12.7, "sodium_mg": 206, "potassium_mg": 161, "magnesium_mg": 18, "calcium_mg": 63, "iron_mg": 0.58, "zinc_mg": 0.53}'::jsonb,
    606, 2423, 145, 185, 7.2, 9.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.17)',
    array['جريش', 'الجريش', 'جريش نجد', 'جريش ابيض', 'جريش باللبن', 'jareesh', 'jreesh'],
    'جريش الجريش جريش نجد جريش ابيض جريش باللبن najdi jareesh'
  ),
  -- 3. مرقوق خضار
  (
    'مرقوق خضار', 'Vegetable Margoog', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 98, "protein_g": 6.0, "carbs_g": 10.3, "fat_g": 2.5, "fiber_g": 5.7, "sugar_g": 0, "saturated_fat_g": 1.39, "cholesterol_mg": 15.0, "sodium_mg": 165, "potassium_mg": 262, "magnesium_mg": 27, "calcium_mg": 16, "iron_mg": 1.33, "zinc_mg": 1.31}'::jsonb,
    566, 2265, 85, 115, 5.0, 7.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.19)',
    array['مرقوق', 'المرقوق', 'مرقوق خضار', 'مرقوق باللحم', 'مرقوق نجد', 'margoog'],
    'مرقوق المرقوق مرقوق خضار مرقوق باللحم مرقوق نجد vegetable margoog'
  ),
  -- 4. قرص خمير / قرص عمر
  (
    'قرص خمير / قرص عمر', 'Qurs Khameer / Qurs Omar Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 349, "protein_g": 11.9, "carbs_g": 45.3, "fat_g": 11.2, "fiber_g": 9.3, "sugar_g": 8.6, "added_sugar_g": 8.2, "saturated_fat_g": 1.82, "cholesterol_mg": 5.67, "sodium_mg": 75, "potassium_mg": 377, "magnesium_mg": 85, "calcium_mg": 94, "iron_mg": 2.36, "zinc_mg": 1.67}'::jsonb,
    182, 728, 315, 380, 10.5, 13.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.21)',
    array['قرص خمير', 'قرص عمر', 'خبز خمير', 'خمير نجد', 'gurs khameer'],
    'قرص خمير قرص عمر خبز خمير خمير نجد qurs khameer omar bread'
  ),
  -- 5. قشد
  (
    'قشد', 'Qishd (Date & Ghee Warm Dessert)', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 382, "protein_g": 3.1, "carbs_g": 56.7, "fat_g": 14.3, "fiber_g": 7.1, "sugar_g": 52.6, "saturated_fat_g": 8.11, "cholesterol_mg": 37.7, "sodium_mg": 20, "potassium_mg": 619, "magnesium_mg": 59, "calcium_mg": 52, "iron_mg": 0.8, "zinc_mg": 0.86}'::jsonb,
    140, 560, 350, 420, 2.5, 4.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.23)',
    array['قشد', 'القشد', 'قشد ملكي', 'قشد بالتمر', 'qishd', 'gheshed'],
    'قشد القشد قشد ملكي قشد بالتمر qishd'
  ),
  -- 6. محلى
  (
    'محلى', 'Muhalla (Date Pudding)', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 187, "protein_g": 4.9, "carbs_g": 30.0, "fat_g": 4.3, "fiber_g": 3.9, "sugar_g": 13.5, "saturated_fat_g": 2.69, "cholesterol_mg": 8.67, "sodium_mg": 58, "potassium_mg": 262, "magnesium_mg": 48, "calcium_mg": 25, "iron_mg": 0.94, "zinc_mg": 1.18}'::jsonb,
    452, 1807, 165, 210, 4.0, 5.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.25)',
    array['محلى', 'المحلى', 'حلوى المحلى', 'محلى بالتمر', 'muhalla'],
    'محلى المحلى حلوى المحلى محلى بالتمر muhalla date pudding'
  ),
  -- 7. حميس
  (
    'حميس', 'Hamees (Sauteed Spiced Meat)', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 190, "protein_g": 9.4, "carbs_g": 11.0, "fat_g": 12.2, "fiber_g": 0.2, "sugar_g": 0, "saturated_fat_g": 6.57, "cholesterol_mg": 63.7, "sodium_mg": 388, "potassium_mg": 321, "magnesium_mg": 22, "calcium_mg": 22, "iron_mg": 1.17, "zinc_mg": 2.08}'::jsonb,
    215, 858, 170, 215, 8.0, 11.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.27)',
    array['حميس', 'الحميس', 'حميس لحم', 'مقلقل حميس', 'hamees'],
    'حميس الحميس حميس لحم مقلقل حميس hamees'
  ),
  -- 8. حنيني الرياض
  (
    'حنيني الرياض', 'Riyadh Hininy', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 320, "protein_g": 6.4, "carbs_g": 46.3, "fat_g": 10.2, "fiber_g": 8.0, "sugar_g": 19.7, "saturated_fat_g": 7.21, "cholesterol_mg": 29.3, "sodium_mg": 115, "potassium_mg": 388, "magnesium_mg": 75, "calcium_mg": 41, "iron_mg": 2.17, "zinc_mg": 1.97}'::jsonb,
    469, 2816, 290, 350, 5.5, 7.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.29)',
    array['حنيني', 'الحنيني', 'حنيني نجد', 'حنيني الرياض', 'hininy', 'haneeni'],
    'حنيني الحنيني حنيني نجد حنيني الرياض riyadh hininy'
  ),
  -- 9. شعثة
  (
    'شعثة', 'Shatha (Dates with Iqt & Ghee)', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 373, "protein_g": 9.7, "carbs_g": 45.3, "fat_g": 14.5, "fiber_g": 11.8, "sugar_g": 50.0, "saturated_fat_g": 10.1, "cholesterol_mg": 31.7, "sodium_mg": 108, "potassium_mg": 739, "magnesium_mg": 64, "calcium_mg": 312, "iron_mg": 1.02, "zinc_mg": 0.92}'::jsonb,
    207, 828, 340, 410, 8.5, 11.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.31)',
    array['شعثة', 'الشعثة', 'شعثة بالتمر والاقط', 'shatha'],
    'شعثة الشعثة شعثة بالتمر والاقط shatha'
  ),
  -- 10. مخامير
  (
    'مخامير', 'Makhameer', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 205, "protein_g": 8.5, "carbs_g": 28.3, "fat_g": 4.5, "fiber_g": 7.6, "sugar_g": 6.2, "saturated_fat_g": 2.68, "cholesterol_mg": 10.0, "sodium_mg": 117, "potassium_mg": 357, "magnesium_mg": 79, "calcium_mg": 98, "iron_mg": 1.3, "zinc_mg": 1.86}'::jsonb,
    327, 1307, 185, 230, 7.2, 9.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.33)',
    array['مخامير', 'المخامير', 'مخامير نجد', 'makhameer'],
    'مخامير المخامير مخامير نجد makhameer'
  ),
  -- 11. أرز بخاري باللحم
  (
    'أرز بخاري باللحم', 'Bukhari Rice with Lamb', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 163, "protein_g": 5.1, "carbs_g": 17.3, "fat_g": 8.1, "fiber_g": 0.3, "sugar_g": 0, "saturated_fat_g": 1.82, "cholesterol_mg": 9.0, "sodium_mg": 313, "potassium_mg": 151, "magnesium_mg": 9, "calcium_mg": 14, "iron_mg": 0.43, "zinc_mg": 0.59}'::jsonb,
    600, 2399, 145, 185, 4.5, 6.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.37)',
    array['أرز بخاري باللحم', 'رز بخاري لحم', 'بخاري لحم', 'bukhari rice with lamb'],
    'أرز بخاري باللحم رز بخاري لحم بخاري لحم bukhari rice with lamb'
  ),
  -- 12. أرز بخاري بالدجاج
  (
    'أرز بخاري بالدجاج', 'Bukhari Rice with Chicken', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 129, "protein_g": 5.7, "carbs_g": 14.0, "fat_g": 5.6, "fiber_g": 3.0, "sugar_g": 0, "saturated_fat_g": 0.77, "cholesterol_mg": 10.7, "sodium_mg": 224, "potassium_mg": 139, "magnesium_mg": 8, "calcium_mg": 12, "iron_mg": 0.43, "zinc_mg": 0.45}'::jsonb,
    607, 2426, 115, 145, 4.8, 6.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.39)',
    array['أرز بخاري بالدجاج', 'رز بخاري دجاج', 'بخاري دجاج', 'bukhari rice with chicken'],
    'أرز بخاري بالدجاج رز بخاري دجاج بخاري دجاج bukhari rice with chicken'
  ),
  -- 13. الثريف
  (
    'الثريف', 'Ath-Thareef (Hijazi Bread Mash)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 181, "protein_g": 6.8, "carbs_g": 28.3, "fat_g": 3.0, "fiber_g": 7.2, "sugar_g": 1.9, "added_sugar_g": 1.8, "saturated_fat_g": 1.19, "cholesterol_mg": 4.33, "sodium_mg": 83, "potassium_mg": 301, "magnesium_mg": 67, "calcium_mg": 52, "iron_mg": 1.89, "zinc_mg": 1.19}'::jsonb,
    416, 1663, 160, 205, 5.8, 7.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.41)',
    array['الثريف', 'ثريف', 'ثريف مكي', 'ath-thareef'],
    'الثريف ثريف ثريف مكي ath-thareef hijazi bread'
  ),
  -- 14. الخواضة / سويق
  (
    'الخواضة / سويق', 'Al-Khawadah / Suweeq', 'sfct_2025', 'traditional_dish', 'ready_to_eat',
    '{"calories": 495, "protein_g": 8.5, "carbs_g": 42.7, "fat_g": 33.5, "fiber_g": 5.9, "sugar_g": 0, "saturated_fat_g": 19.9, "cholesterol_mg": 71.3, "sodium_mg": 6, "potassium_mg": 332, "magnesium_mg": 100, "calcium_mg": 15, "iron_mg": 2.97, "zinc_mg": 2.22}'::jsonb,
    111, 442, 450, 540, 7.2, 9.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.43)',
    array['الخواضة', 'خواضة', 'سويق', 'سويق بالسمن', 'al-khawadah', 'suweeq'],
    'الخواضة خواضة سويق سويق بالسمن al-khawadah suweeq'
  ),
  -- 15. عيش باللحم
  (
    'عيش باللحم', 'Hijazi Meat Bread (Aish Bil-Lahm)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 316, "protein_g": 13.6, "carbs_g": 20.7, "fat_g": 18.5, "fiber_g": 7.2, "sugar_g": 2.6, "saturated_fat_g": 5.42, "cholesterol_mg": 29.3, "sodium_mg": 311, "potassium_mg": 294, "magnesium_mg": 86, "calcium_mg": 46, "iron_mg": 2.43, "zinc_mg": 2.15}'::jsonb,
    264, 1585, 285, 350, 11.8, 15.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.45)',
    array['عيش باللحم', 'عيش لحم', 'عيش باللحمة حجازي', 'aish bil-lahm'],
    'عيش باللحم عيش لحم عيش باللحمة حجازي aish bil-lahm'
  ),
  -- 16. عيش بالدجاج
  (
    'عيش بالدجاج', 'Hijazi Chicken Bread (Aish Bil-Dajaj)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 285, "protein_g": 13.1, "carbs_g": 20.3, "fat_g": 15.4, "fiber_g": 6.7, "sugar_g": 0, "saturated_fat_g": 4.16, "cholesterol_mg": 29.7, "sodium_mg": 310, "potassium_mg": 313, "magnesium_mg": 88, "calcium_mg": 51, "iron_mg": 2.86, "zinc_mg": 1.66}'::jsonb,
    286, 1716, 255, 315, 11.5, 14.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.47)',
    array['عيش بالدجاج', 'عيش دجاج', 'عيش بالدجاج حجازي', 'aish bil-dajaj'],
    'عيش بالدجاج عيش دجاج عيش بالدجاج حجازي aish bil-dajaj'
  ),
  -- 17. جبنية فلة
  (
    'جبنية فلة', 'Jubniyah Fulah (Fried Cheese Pastry with Syrup)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 417, "protein_g": 5.6, "carbs_g": 53.0, "fat_g": 19.9, "fiber_g": 1.7, "sugar_g": 32.8, "added_sugar_g": 32.8, "saturated_fat_g": 5.25, "cholesterol_mg": 22.7, "sodium_mg": 525, "potassium_mg": 92, "magnesium_mg": 14, "calcium_mg": 87, "iron_mg": 1.45, "zinc_mg": 0.94}'::jsonb,
    91, 362, 380, 460, 4.8, 6.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.49)',
    array['جبنية', 'جبنية فلة', 'الجبنية', 'جبنيه', 'jubniyah'],
    'جبنية جبنية فلة الجبنية جبنيه jubniyah'
  ),
  -- 18. السليق الطائفي باللحم
  (
    'السليق الطائفي باللحم', 'Taifi Saleeg with Lamb', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 212, "protein_g": 6.6, "carbs_g": 21.7, "fat_g": 10.8, "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 6.06, "cholesterol_mg": 30.3, "sodium_mg": 584, "potassium_mg": 117, "magnesium_mg": 9, "calcium_mg": 13, "iron_mg": 0.39, "zinc_mg": 1.41}'::jsonb,
    350, 1401, 190, 240, 5.8, 7.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.51)',
    array['سليق', 'السليق', 'سليق طائفي باللحم', 'سليق لحم', 'saleeg with lamb'],
    'سليق السليق سليق طائفي باللحم سليق لحم saleeg with lamb'
  ),
  -- 19. السليق الطائفي بالدجاج
  (
    'السليق الطائفي بالدجاج', 'Taifi Saleeg with Chicken', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 146, "protein_g": 8.3, "carbs_g": 18.3, "fat_g": 4.2, "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 1.98, "cholesterol_mg": 25.7, "sodium_mg": 542, "potassium_mg": 166, "magnesium_mg": 12, "calcium_mg": 9, "iron_mg": 0.25, "zinc_mg": 0.62}'::jsonb,
    375, 1500, 130, 165, 7.2, 9.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.53)',
    array['سليق طائفي بالدجاج', 'سليق دجاج', 'السليق الطائفي', 'saleeg with chicken'],
    'سليق طائفي بالدجاج سليق دجاج السليق الطائفي saleeg with chicken'
  ),
  -- 20. سمك ناجل مقلي
  (
    'سمك ناجل مقلي', 'Fried Najel Fish', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 159, "protein_g": 27.7, "carbs_g": 2.0, "fat_g": 4.2, "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 0.83, "cholesterol_mg": 69.7, "sodium_mg": 100, "potassium_mg": 387, "magnesium_mg": 32, "calcium_mg": 43, "iron_mg": 0, "zinc_mg": 0.82}'::jsonb,
    212, 849, 140, 180, 25.0, 30.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.55)',
    array['سمك مقلي', 'ناجل مقلي', 'سمك ناجل', 'fried najel fish'],
    'سمك مقلي ناجل مقلي سمك ناجل fried najel fish'
  ),
  -- 21. عصيدة بدقيق البر
  (
    'عصيدة بدقيق البر', 'Whole Wheat Aseeda', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 177, "protein_g": 1.6, "carbs_g": 28.7, "fat_g": 5.1, "fiber_g": 4.6, "sugar_g": 25.9, "saturated_fat_g": 3.46, "cholesterol_mg": 8.67, "sodium_mg": 9, "potassium_mg": 303, "magnesium_mg": 37, "calcium_mg": 27, "iron_mg": 0.46, "zinc_mg": 0.55}'::jsonb,
    349, 1395, 155, 200, 1.2, 2.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.57)',
    array['عصيدة', 'عصيدة بر', 'عصيدة بدقيق البر', 'aseeda'],
    'عصيدة عصيدة بر عصيدة بدقيق البر whole wheat aseeda'
  ),
  -- 22. عصيدة بالدقيق الأبيض
  (
    'عصيدة بالدقيق الأبيض', 'White Flour Aseeda', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 139, "protein_g": 1.2, "carbs_g": 21.7, "fat_g": 4.3, "fiber_g": 3.9, "sugar_g": 26.4, "saturated_fat_g": 3.03, "cholesterol_mg": 11.3, "sodium_mg": 7, "potassium_mg": 280, "magnesium_mg": 25, "calcium_mg": 23, "iron_mg": 0.39, "zinc_mg": 0.41}'::jsonb,
    351, 1403, 120, 160, 0.9, 1.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.59)',
    array['عصيدة دقيق ابيض', 'عصيدة بيضاء', 'aseeda white'],
    'عصيدة دقيق ابيض عصيدة بيضاء white flour aseeda'
  ),
  -- 23. كباب ميروا / كباب عملي
  (
    'كباب ميروا / كباب عملي', 'Hijazi Kebab Meero', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 267, "protein_g": 21.8, "carbs_g": 16.0, "fat_g": 11.5, "fiber_g": 6.6, "sugar_g": 0, "saturated_fat_g": 2.02, "cholesterol_mg": 32.7, "sodium_mg": 381, "potassium_mg": 437, "magnesium_mg": 64, "calcium_mg": 24, "iron_mg": 2.85, "zinc_mg": 2.29}'::jsonb,
    47, 188, 240, 295, 19.5, 24.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.61)',
    array['كباب ميروا', 'كباب عملي', 'كباب ميرو', 'kebab meero'],
    'كباب ميروا كباب عملي كباب ميرو hijazi kebab meero'
  ),
  -- 24. مشبك حجازي
  (
    'مشبك حجازي', 'Hijazi Mushabbak', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 367, "protein_g": 2.3, "carbs_g": 45.7, "fat_g": 18.9, "fiber_g": 1.7, "sugar_g": 26.2, "added_sugar_g": 26.2, "saturated_fat_g": 2.14, "cholesterol_mg": 0, "sodium_mg": 291, "potassium_mg": 79, "magnesium_mg": 6, "calcium_mg": 7, "iron_mg": 1.18, "zinc_mg": 0.37}'::jsonb,
    198, 793, 330, 400, 1.8, 3.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.63)',
    array['مشبك', 'المشبك', 'مشبك حجازي', 'mushabbak'],
    'مشبك المشبك مشبك حجازي hijazi mushabbak'
  ),
  -- 25. مشرمل سمك بالطحينة
  (
    'مشرمل سمك بالطحينة', 'Fish Musharmal with Tahini', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 212, "protein_g": 18.7, "carbs_g": 1.67, "fat_g": 13.2, "fiber_g": 6.3, "sugar_g": 0, "saturated_fat_g": 2.18, "cholesterol_mg": 47.7, "sodium_mg": 204, "potassium_mg": 338, "magnesium_mg": 65, "calcium_mg": 48, "iron_mg": 1.59, "zinc_mg": 1.1}'::jsonb,
    400, 1599, 190, 235, 16.5, 21.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.65)',
    array['مشرمل', 'سمك مشرمل', 'سمك بالطحينة', 'musharmal fish'],
    'مشرمل سمك مشرمل سمك بالطحينة fish musharmal tahini'
  ),
  -- 26. مطبق حلو بالموز
  (
    'مطبق حلو بالموز', 'Sweet Banana Mutabbaq', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 290, "protein_g": 7.1, "carbs_g": 41.3, "fat_g": 10.1, "fiber_g": 2.3, "sugar_g": 12.7, "added_sugar_g": 6.3, "saturated_fat_g": 1.71, "cholesterol_mg": 41.7, "sodium_mg": 135, "potassium_mg": 223, "magnesium_mg": 21, "calcium_mg": 14, "iron_mg": 2.82, "zinc_mg": 0.99}'::jsonb,
    187, 748, 260, 320, 6.0, 8.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.67)',
    array['مطبق حلو بالموز', 'مطبق موز', 'مطبق حلو', 'sweet banana mutabbaq'],
    'مطبق حلو بالموز مطبق موز مطبق حلو sweet banana mutabbaq'
  ),
  -- 27. مطبق حلو بالجبنة
  (
    'مطبق حلو بالجبنة', 'Sweet Cheese Mutabbaq', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 310, "protein_g": 8.9, "carbs_g": 38.0, "fat_g": 12.9, "fiber_g": 8.6, "sugar_g": 10.3, "added_sugar_g": 8.2, "saturated_fat_g": 3.88, "cholesterol_mg": 55.7, "sodium_mg": 380, "potassium_mg": 189, "magnesium_mg": 18, "calcium_mg": 72, "iron_mg": 2.55, "zinc_mg": 1.29}'::jsonb,
    199, 797, 280, 345, 7.8, 10.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.69)',
    array['مطبق حلو بالجبنة', 'مطبق جبن حلو', 'sweet cheese mutabbaq'],
    'مطبق حلو بالجبنة مطبق جبن حلو sweet cheese mutabbaq'
  ),
  -- 28. مطبق مالح باللحم
  (
    'مطبق مالح باللحم', 'Savory Meat Mutabbaq', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 201, "protein_g": 9.7, "carbs_g": 24.3, "fat_g": 6.6, "fiber_g": 2.3, "sugar_g": 2.5, "saturated_fat_g": 1.79, "cholesterol_mg": 34.7, "sodium_mg": 182, "potassium_mg": 248, "magnesium_mg": 20, "calcium_mg": 17, "iron_mg": 2.61, "zinc_mg": 1.59}'::jsonb,
    496, 1985, 180, 225, 8.5, 11.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.71)',
    array['مطبق مالح', 'مطبق لحم', 'مطبق مالح باللحم', 'savory meat mutabbaq'],
    'مطبق مالح مطبق لحم مطبق مالح باللحم savory meat mutabbaq'
  ),
  -- 29. مطبق مالح بالدجاج
  (
    'مطبق مالح بالدجاج', 'Savory Chicken Mutabbaq', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 208, "protein_g": 10.1, "carbs_g": 27.3, "fat_g": 6.1, "fiber_g": 1.3, "sugar_g": 5.4, "saturated_fat_g": 1.1, "cholesterol_mg": 37.7, "sodium_mg": 93, "potassium_mg": 286, "magnesium_mg": 21, "calcium_mg": 21, "iron_mg": 1.94, "zinc_mg": 0.69}'::jsonb,
    506, 2024, 185, 230, 8.8, 11.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.73)',
    array['مطبق دجاج', 'مطبق مالح بالدجاج', 'savory chicken mutabbaq'],
    'مطبق دجاج مطبق مالح بالدجاج savory chicken mutabbaq'
  ),
  -- 30. معصوب ملكي حجازي
  (
    'معصوب ملكي حجازي', 'Hijazi Royal Masoob', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 233, "protein_g": 5.3, "carbs_g": 35.0, "fat_g": 6.4, "fiber_g": 6.2, "sugar_g": 16.3, "added_sugar_g": 6.77, "saturated_fat_g": 4.1, "cholesterol_mg": 12.3, "sodium_mg": 588, "potassium_mg": 338, "magnesium_mg": 66, "calcium_mg": 23, "iron_mg": 1.41, "zinc_mg": 1.12}'::jsonb,
    368, 1472, 210, 260, 4.5, 6.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.75)',
    array['معصوب', 'المعصوب', 'معصوب ملكي', 'معصوب بالقشطة', 'masoob'],
    'معصوب المعصوب معصوب ملكي معصوب بالقشطة hijazi royal masoob'
  ),
  -- 31. معمول حجازي بالتمر
  (
    'معمول حجازي بالتمر', 'Hijazi Date Maamoul', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 484, "protein_g": 6.6, "carbs_g": 54.3, "fat_g": 25.5, "fiber_g": 5.7, "sugar_g": 18.9, "added_sugar_g": 1.1, "saturated_fat_g": 17.8, "cholesterol_mg": 71.7, "sodium_mg": 50, "potassium_mg": 306, "magnesium_mg": 41, "calcium_mg": 52, "iron_mg": 3.2, "zinc_mg": 0.9}'::jsonb,
    184, 736, 440, 520, 5.8, 7.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.77)',
    array['معمول', 'المعمول', 'معمول حجازي', 'معمول بالتمر', 'maamoul'],
    'معمول المعمول معمول حجازي معمول بالتمر hijazi date maamoul'
  ),
  -- 32. المنتو باللحم / يغمش
  (
    'المنتو باللحم / يغمش', 'Mantu Meat Dumplings / Yaghmush', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 218, "protein_g": 9.6, "carbs_g": 24.3, "fat_g": 8.4, "fiber_g": 3.3, "sugar_g": 0, "saturated_fat_g": 3.85, "cholesterol_mg": 16.0, "sodium_mg": 157, "potassium_mg": 215, "magnesium_mg": 22, "calcium_mg": 16, "iron_mg": 2.31, "zinc_mg": 1.46}'::jsonb,
    447, 1789, 195, 245, 8.5, 11.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.79)',
    array['منتو', 'المنتو', 'منتو باللحم', 'يغمش', 'mantu'],
    'منتو المنتو منتو باللحم يغمش mantu yaghmush'
  ),
  -- 33. أرز بالحمص مديني
  (
    'أرز بالحمص مديني', 'Madinah Rice with Chickpeas', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 168, "protein_g": 7.2, "carbs_g": 22.3, "fat_g": 4.6, "fiber_g": 4.0, "sugar_g": 0, "saturated_fat_g": 2.08, "cholesterol_mg": 14.7, "sodium_mg": 219, "potassium_mg": 210, "magnesium_mg": 20, "calcium_mg": 13, "iron_mg": 0.71, "zinc_mg": 1.07}'::jsonb,
    518, 2071, 150, 190, 6.2, 8.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.83)',
    array['رز بالحمص', 'أرز بالحمص', 'ارز بالحمص مديني', 'rice with chickpeas'],
    'رز بالحمص أرز بالحمص ارز بالحمص مديني madinah rice chickpeas'
  ),
  -- 34. أرز بالعدس / معدوس
  (
    'أرز بالعدس / معدوس', 'Mados (Rice with Lentils)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 105, "protein_g": 2.6, "carbs_g": 16.3, "fat_g": 2.9, "fiber_g": 1.4, "sugar_g": 0, "saturated_fat_g": 1.92, "cholesterol_mg": 5.0, "sodium_mg": 566, "potassium_mg": 114, "magnesium_mg": 10, "calcium_mg": 12, "iron_mg": 0.48, "zinc_mg": 0.41}'::jsonb,
    412, 1648, 95, 120, 2.1, 3.4, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.85)',
    array['رز بالعدس', 'أرز بالعدس', 'معدوس', 'rice with lentils'],
    'رز بالعدس أرز بالعدس معدوس mados rice lentils'
  ),
  -- 35. أرز مديني باللحم
  (
    'أرز مديني باللحم', 'Madini Rice with Lamb', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 178, "protein_g": 6.5, "carbs_g": 21.0, "fat_g": 6.8, "fiber_g": 0.1, "sugar_g": 0, "saturated_fat_g": 3.48, "cholesterol_mg": 18.7, "sodium_mg": 254, "potassium_mg": 158, "magnesium_mg": 10, "calcium_mg": 12, "iron_mg": 0.42, "zinc_mg": 0.55}'::jsonb,
    530, 2118, 155, 200, 5.6, 7.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.87)',
    array['رز مديني باللحم', 'أرز مديني باللحم', 'رز مديني لحم', 'madini rice with lamb'],
    'رز مديني باللحم أرز مديني باللحم رز مديني لحم madini rice lamb'
  ),
  -- 36. أرز مديني بالدجاج
  (
    'أرز مديني بالدجاج', 'Madini Rice with Chicken', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 172, "protein_g": 6.6, "carbs_g": 25.3, "fat_g": 4.8, "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 2.5, "cholesterol_mg": 16.7, "sodium_mg": 259, "potassium_mg": 171, "magnesium_mg": 12, "calcium_mg": 15, "iron_mg": 0.27, "zinc_mg": 0.29}'::jsonb,
    504, 2017, 150, 195, 5.8, 7.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.89)',
    array['رز مديني بالدجاج', 'أرز مديني بالدجاج', 'رز مديني دجاج', 'madini rice with chicken'],
    'رز مديني بالدجاج أرز مديني بالدجاج رز مديني دجاج madini rice chicken'
  ),
  -- 37. المثلوثة المدينية
  (
    'المثلوثة المدينية', 'Madinah Mathlootha', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 247, "protein_g": 5.2, "carbs_g": 40.3, "fat_g": 5.7, "fiber_g": 6.5, "sugar_g": 17.5, "saturated_fat_g": 3.73, "cholesterol_mg": 7.0, "sodium_mg": 163, "potassium_mg": 249, "magnesium_mg": 38, "calcium_mg": 131, "iron_mg": 2.75, "zinc_mg": 0.67}'::jsonb,
    239, 955, 220, 275, 4.4, 6.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.91)',
    array['مثلوثة', 'المثلوثة', 'مثلوثة مدينية', 'mathlootha'],
    'مثلوثة المثلوثة مثلوثة مدينية madinah mathlootha'
  ),
  -- 38. شريك مديني
  (
    'شريك مديني', 'Madinah Shuraik Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 297, "protein_g": 9.1, "carbs_g": 47.3, "fat_g": 6.7, "fiber_g": 4.5, "sugar_g": 3.7, "added_sugar_g": 3.3, "saturated_fat_g": 0.89, "cholesterol_mg": 0, "sodium_mg": 322, "potassium_mg": 206, "magnesium_mg": 30, "calcium_mg": 14, "iron_mg": 3.72, "zinc_mg": 1.19}'::jsonb,
    150, 599, 270, 325, 8.0, 10.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.93)',
    array['شريك', 'الشريك', 'شريك مديني', 'خبز شريك', 'shuraik'],
    'شريك الشريك شريك مديني خبز شريك madinah shuraik bread'
  ),
  -- 39. تويتات مدينية
  (
    'تويتات مدينية', 'Madinah Tuwaitat Pastry', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 403, "protein_g": 7.8, "carbs_g": 40.3, "fat_g": 22.7, "fiber_g": 3.3, "sugar_g": 9.6, "added_sugar_g": 8.9, "saturated_fat_g": 2.66, "cholesterol_mg": 6.0, "sodium_mg": 149, "potassium_mg": 153, "magnesium_mg": 25, "calcium_mg": 16, "iron_mg": 2.52, "zinc_mg": 0.85}'::jsonb,
    265, 1060, 365, 440, 6.8, 9.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.95)',
    array['تويتات', 'التويتات', 'تويتات مدينية', 'tuwaitat'],
    'تويتات التويتات تويتات مدينية tuwaitat'
  ),
  -- 40. حيسة مدينية بالتمر
  (
    'حيسة مدينية بالتمر', 'Madinah Date Haisah', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 393, "protein_g": 4.4, "carbs_g": 55.7, "fat_g": 14.7, "fiber_g": 9.9, "sugar_g": 40.7, "saturated_fat_g": 9.78, "cholesterol_mg": 31.7, "sodium_mg": 23, "potassium_mg": 529, "magnesium_mg": 81, "calcium_mg": 52, "iron_mg": 1.23, "zinc_mg": 1.54}'::jsonb,
    153, 611, 360, 430, 3.8, 5.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.97)',
    array['حيسة', 'الحيسة', 'حيسة مدينية', 'حيسة تمر', 'haisah'],
    'حيسة الحيسة حيسة مدينية حيسة تمر madinah date haisah'
  ),
  -- 41. الدليكة المدينية
  (
    'الدليكة المدينية', 'Madinah Daleeka', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 353, "protein_g": 9.1, "carbs_g": 63.7, "fat_g": 4.4, "fiber_g": 9.6, "sugar_g": 42.3, "saturated_fat_g": 2.78, "cholesterol_mg": 32.3, "sodium_mg": 66, "potassium_mg": 692, "magnesium_mg": 90, "calcium_mg": 161, "iron_mg": 1.75, "zinc_mg": 1.71}'::jsonb,
    242, 966, 320, 390, 8.0, 10.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.99)',
    array['دليكة', 'الدليكة', 'دليكة مدينية', 'daleeka'],
    'دليكة الدليكة دليكة مدينية daleeka'
  ),
  -- 42. كنافة الخربز
  (
    'كنافة الخربز', 'Kharbaz Kunafah', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 359, "protein_g": 3.0, "carbs_g": 45.3, "fat_g": 17.9, "fiber_g": 2.7, "sugar_g": 18.9, "added_sugar_g": 18.9, "saturated_fat_g": 12.7, "cholesterol_mg": 44.0, "sodium_mg": 150, "potassium_mg": 186, "magnesium_mg": 12, "calcium_mg": 18, "iron_mg": 1.22, "zinc_mg": 0.37}'::jsonb,
    331, 1326, 320, 395, 2.4, 3.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.101)',
    array['كنافة الخربز', 'كنافة خربز', 'kunafah kharbaz'],
    'كنافة الخربز كنافة خربز kharbaz kunafah'
  ),
  -- 43. كنافة بالقشطة
  (
    'كنافة بالقشطة', 'Cream Kunafah', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 417, "protein_g": 3.2, "carbs_g": 44.0, "fat_g": 25.2, "fiber_g": 2.0, "sugar_g": 18.9, "added_sugar_g": 16.6, "saturated_fat_g": 17.2, "cholesterol_mg": 62.0, "sodium_mg": 152, "potassium_mg": 84, "magnesium_mg": 11, "calcium_mg": 33, "iron_mg": 1.19, "zinc_mg": 0.26}'::jsonb,
    250, 1501, 380, 460, 2.6, 4.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.103)',
    array['كنافة قشطة', 'كنافة بالقشطة', 'كنافة', 'kunafah cream'],
    'كنافة قشطة كنافة بالقشطة كنافة cream kunafah'
  ),
  -- 44. كنافة بالجبن
  (
    'كنافة بالجبن', 'Cheese Kunafah', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 414, "protein_g": 5.5, "carbs_g": 49.7, "fat_g": 21.6, "fiber_g": 0, "sugar_g": 19.5, "added_sugar_g": 18.9, "saturated_fat_g": 14.7, "cholesterol_mg": 55.3, "sodium_mg": 554, "potassium_mg": 143, "magnesium_mg": 15, "calcium_mg": 79, "iron_mg": 1.51, "zinc_mg": 0.64}'::jsonb,
    220, 1319, 375, 455, 4.6, 6.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.105)',
    array['كنافة جبن', 'كنافة بالجبنة', 'kunafah cheese'],
    'كنافة جبن كنافة بالجبنة cheese kunafah'
  ),
  -- 45. لبنية حجازية
  (
    'لبنية حجازية', 'Hijazi Labaniyah Sweet', 'sfct_2025', 'dairy_egg', 'ready_to_eat',
    '{"calories": 442, "protein_g": 1.2, "carbs_g": 79.3, "fat_g": 12.9, "fiber_g": 0, "sugar_g": 54.3, "added_sugar_g": 52.6, "saturated_fat_g": 2.97, "cholesterol_mg": 0, "sodium_mg": 69, "potassium_mg": 237, "magnesium_mg": 7, "calcium_mg": 95, "iron_mg": 0.2, "zinc_mg": 0.71}'::jsonb,
    253, 1518, 400, 485, 0.9, 1.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.107)',
    array['لبنية', 'اللبنية', 'لبنية حجازية', 'labaniyah'],
    'لبنية اللبنية لبنية حجازية hijazi labaniyah'
  ),
  -- 46. أرز حساوي أحمر
  (
    'أرز حساوي أحمر', 'Hasawi Red Rice', 'sfct_2025', 'rice_grain', 'cooked',
    '{"calories": 163, "protein_g": 6.5, "carbs_g": 19.3, "fat_g": 6.1, "fiber_g": 1.5, "sugar_g": 0, "saturated_fat_g": 3.68, "cholesterol_mg": 24.0, "sodium_mg": 275, "potassium_mg": 200, "magnesium_mg": 24, "calcium_mg": 16, "iron_mg": 1.07, "zinc_mg": 1.65}'::jsonb,
    538, 2153, 145, 185, 5.6, 7.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.111)',
    array['أرز حساوي', 'رز حساوي', 'رز احمر حساوي', 'hasawi rice'],
    'أرز حساوي رز حساوي رز احمر حساوي hasawi red rice'
  ),
  -- 47. بلاليط بالبيض والبصل
  (
    'بلاليط بالبيض والبصل', 'Eastern Balaleet with Egg & Onion', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 168, "protein_g": 5.3, "carbs_g": 26.0, "fat_g": 4.0, "fiber_g": 3.4, "sugar_g": 2.0, "added_sugar_g": 2.0, "saturated_fat_g": 2.31, "cholesterol_mg": 22.0, "sodium_mg": 80, "potassium_mg": 88, "magnesium_mg": 12, "calcium_mg": 10, "iron_mg": 0.87, "zinc_mg": 0.78}'::jsonb,
    320, 1280, 150, 190, 4.5, 6.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.113)',
    array['بلاليط', 'البلاليط', 'بلاليط بالبيض', 'سيوية', 'شعيرية', 'balaleet'],
    'بلاليط البلاليط بلاليط بالبيض سيوية شعيرية balaleet'
  ),
  -- 48. خبز أحمر حساوي بالتمر
  (
    'خبز أحمر حساوي بالتمر', 'Hasawi Red Date Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 263, "protein_g": 8.8, "carbs_g": 48.0, "fat_g": 1.6, "fiber_g": 9.7, "sugar_g": 23.5, "saturated_fat_g": 0.32, "cholesterol_mg": 0, "sodium_mg": 193, "potassium_mg": 422, "magnesium_mg": 98, "calcium_mg": 41, "iron_mg": 2.2, "zinc_mg": 1.75}'::jsonb,
    185, 741, 240, 290, 7.8, 10.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.115)',
    array['خبز أحمر', 'خبز حساوي', 'خبز التمر', 'خبز احمر حساوي', 'hasawi red bread'],
    'خبز أحمر خبز حساوي خبز التمر خبز احمر حساوي hasawi red date bread'
  ),
  -- 49. عصيدة تمر الشرقية
  (
    'عصيدة تمر الشرقية', 'Eastern Date Aseeda', 'sfct_2025', 'fruit_dates', 'cooked',
    '{"calories": 152, "protein_g": 4.1, "carbs_g": 26.7, "fat_g": 1.5, "fiber_g": 7.0, "sugar_g": 19.7, "saturated_fat_g": 0.86, "cholesterol_mg": 4.67, "sodium_mg": 11, "potassium_mg": 262, "magnesium_mg": 36, "calcium_mg": 16, "iron_mg": 0.37, "zinc_mg": 0.86}'::jsonb,
    400, 1599, 135, 175, 3.4, 5.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.117)',
    array['عصيدة تمر', 'عصيدة التمر', 'عصيدة حساوية', 'date aseeda'],
    'عصيدة تمر عصيدة التمر عصيدة حساوية eastern date aseeda'
  ),
  -- 50. مبصل حساوي
  (
    'مبصل حساوي', 'Hasawi Mubassal (Onion Bread)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 245, "protein_g": 6.6, "carbs_g": 26.3, "fat_g": 10.6, "fiber_g": 8.9, "sugar_g": 1.5, "saturated_fat_g": 1.33, "cholesterol_mg": 0, "sodium_mg": 377, "potassium_mg": 283, "magnesium_mg": 71, "calcium_mg": 32, "iron_mg": 1.81, "zinc_mg": 1.26}'::jsonb,
    161, 645, 220, 275, 5.6, 7.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.119)',
    array['مبصل', 'المبصل', 'مبصل حساوي', 'mubassal'],
    'مبصل المبصل مبصل حساوي hasawi mubassal'
  ),
  -- 51. محمر سمك مقلي بالدبس
  (
    'محمر سمك مقلي بالدبس', 'Muhammar Sweet Rice with Fried Fish', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 183, "protein_g": 6.9, "carbs_g": 30.0, "fat_g": 3.3, "fiber_g": 2.6, "sugar_g": 16.6, "added_sugar_g": 16.1, "saturated_fat_g": 1.37, "cholesterol_mg": 12.7, "sodium_mg": 65, "potassium_mg": 267, "magnesium_mg": 20, "calcium_mg": 16, "iron_mg": 0, "zinc_mg": 0.66}'::jsonb,
    458, 1831, 160, 210, 5.9, 8.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.121)',
    array['محمر', 'أرز محمر', 'محمر سمك', 'رز محمر بالدبس', 'muhammar'],
    'محمر أرز محمر محمر سمك رز محمر بالدبس muhammar fish'
  ),
  -- 52. مفلق روبيان حساوي
  (
    'مفلق روبيان حساوي', 'Hasawi Shrimp Mufallaq (Cracked Wheat with Shrimp)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 109, "protein_g": 7.6, "carbs_g": 9.67, "fat_g": 3.3, "fiber_g": 5.4, "sugar_g": 0, "saturated_fat_g": 1.42, "cholesterol_mg": 44.7, "sodium_mg": 500, "potassium_mg": 218, "magnesium_mg": 33, "calcium_mg": 21, "iron_mg": 0.63, "zinc_mg": 0.72}'::jsonb,
    511, 2046, 95, 130, 6.5, 9.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.123)',
    array['مفلق', 'مفلق روبيان', 'مفلق حساوي', 'mufallaq shrimp'],
    'مفلق مفلق روبيان مفلق حساوي hasawi shrimp mufallaq'
  ),
  -- 53. ممروس حساوي بالتمر
  (
    'ممروس حساوي بالتمر', 'Hasawi Mamroos Date Mash', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 351, "protein_g": 8.4, "carbs_g": 53.0, "fat_g": 9.3, "fiber_g": 10.0, "sugar_g": 40.6, "saturated_fat_g": 6.04, "cholesterol_mg": 21.0, "sodium_mg": 56, "potassium_mg": 411, "magnesium_mg": 85, "calcium_mg": 50, "iron_mg": 1.8, "zinc_mg": 0.87}'::jsonb,
    131, 524, 315, 390, 7.2, 9.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.125)',
    array['ممروس', 'الممروس', 'ممروس حساوي', 'mamroos'],
    'ممروس الممروس ممروس حساوي hasawi mamroos date'
  ),
  -- 54. تاوة القصيم
  (
    'تاوة القصيم', 'Qassim Tawa Fried Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 299, "protein_g": 9.9, "carbs_g": 37.0, "fat_g": 10.4, "fiber_g": 8.2, "sugar_g": 8.3, "added_sugar_g": 8.0, "saturated_fat_g": 1.27, "cholesterol_mg": 0, "sodium_mg": 87, "potassium_mg": 244, "magnesium_mg": 73, "calcium_mg": 29, "iron_mg": 2.38, "zinc_mg": 1.02}'::jsonb,
    140, 559, 270, 330, 8.6, 11.4, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.129)',
    array['تاوة', 'التاوة', 'تاوة القصيم', 'tawa qassim'],
    'تاوة التاوة تاوة القصيم qassim tawa bread'
  ),
  -- 55. دويفة القصيم
  (
    'دويفة القصيم', 'Qassim Dwaifah Soup', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 29, "protein_g": 0.6, "carbs_g": 2.0, "fat_g": 1.4, "fiber_g": 3.0, "sugar_g": 0, "saturated_fat_g": 0.61, "cholesterol_mg": 0, "sodium_mg": 165, "potassium_mg": 173, "magnesium_mg": 14, "calcium_mg": 12, "iron_mg": 0.66, "zinc_mg": 0.35}'::jsonb,
    382, 1528, 22, 36, 0.4, 0.9, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.131)',
    array['دويفة', 'الدويفة', 'دويفة القصيم', 'dwaifah'],
    'دويفة الدويفة دويفة القصيم qassim dwaifah soup'
  ),
  -- 56. كليجا القصيم
  (
    'كليجا القصيم', 'Qassim Kleicha', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 380, "protein_g": 6.8, "carbs_g": 61.2, "fat_g": 12.0, "fiber_g": 5.4, "sugar_g": 28.5, "added_sugar_g": 24.0, "saturated_fat_g": 4.1, "cholesterol_mg": 0, "sodium_mg": 145, "potassium_mg": 260, "magnesium_mg": 52, "calcium_mg": 38, "iron_mg": 2.1, "zinc_mg": 0.95}'::jsonb,
    168, 1010, 340, 420, 5.8, 8.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.133)',
    array['كليجا', 'الكليجا', 'كليجا القصيم', 'kleicha', 'kleyjah'],
    'كليجا الكليجا كليجا القصيم qassim kleicha'
  ),
  -- 57. حنيني القصيم
  (
    'حنيني القصيم', 'Qassim Hininy', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 320, "protein_g": 6.5, "carbs_g": 47.0, "fat_g": 10.0, "fiber_g": 8.2, "sugar_g": 21.0, "saturated_fat_g": 6.8, "cholesterol_mg": 28.0, "sodium_mg": 110, "potassium_mg": 395, "magnesium_mg": 78, "calcium_mg": 45, "iron_mg": 2.2, "zinc_mg": 1.9}'::jsonb,
    458, 2750, 290, 350, 5.6, 7.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.135)',
    array['حنيني القصيم', 'حنيني', 'hininy qassim'],
    'حنيني القصيم حنيني hininy qassim'
  ),
  -- 58. فقع مطبوخ
  (
    'فقع مطبوخ', 'Cooked Desert Truffles', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 89, "protein_g": 4.8, "carbs_g": 8.5, "fat_g": 3.2, "fiber_g": 3.8, "sugar_g": 0.5, "saturated_fat_g": 0.8, "cholesterol_mg": 0, "sodium_mg": 190, "potassium_mg": 340, "magnesium_mg": 22, "calcium_mg": 18, "iron_mg": 1.7, "zinc_mg": 1.1}'::jsonb,
    275, 1100, 75, 105, 4.0, 5.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.137)',
    array['فقع', 'الفقع', 'كماء', 'كمأة', 'فقع مطبوخ', 'desert truffles'],
    'فقع الفقع كماء كمأة فقع مطبوخ cooked desert truffles'
  ),
  -- 59. مطازيز القصيم
  (
    'مطازيز القصيم', 'Qassim Matazeez', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 130, "protein_g": 7.2, "carbs_g": 16.5, "fat_g": 3.8, "fiber_g": 4.8, "sugar_g": 1.2, "saturated_fat_g": 1.5, "cholesterol_mg": 18.0, "sodium_mg": 260, "potassium_mg": 310, "magnesium_mg": 35, "calcium_mg": 28, "iron_mg": 1.6, "zinc_mg": 1.4}'::jsonb,
    550, 2200, 115, 150, 6.2, 8.4, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.139)',
    array['مطازيز', 'المطازيز', 'مطازيز القصيم', 'مطازيز بالخضار واللحم', 'matazeez'],
    'مطازيز المطازيز مطازيز القصيم مطازيز بالخضار واللحم qassim matazeez'
  ),
  -- 60. مصابيب القصيم
  (
    'مصابيب القصيم', 'Qassim Masabeeb (Mini Pancakes with Ghee & Honey)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 240, "protein_g": 7.5, "carbs_g": 38.0, "fat_g": 6.5, "fiber_g": 5.2, "sugar_g": 12.0, "added_sugar_g": 8.0, "saturated_fat_g": 2.8, "cholesterol_mg": 15.0, "sodium_mg": 210, "potassium_mg": 240, "magnesium_mg": 45, "calcium_mg": 48, "iron_mg": 1.9, "zinc_mg": 1.2}'::jsonb,
    200, 800, 215, 270, 6.5, 8.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.141)',
    array['مصابيب', 'المصابيب', 'مصابيب القصيم', 'مصابيب بالسمن والعسل', 'masabeeb'],
    'مصابيب المصابيب مصابيب القصيم مصابيب بالسمن والعسل qassim masabeeb pancakes'
  ),
  -- 61. عريكة عسيرية بالسمن والعسل
  (
    'عريكة عسيرية بالسمن والعسل', 'Asiri Areeka with Ghee & Honey', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 281, "protein_g": 5.8, "carbs_g": 48.2, "fat_g": 8.1, "fiber_g": 6.8, "sugar_g": 24.5, "added_sugar_g": 12.0, "saturated_fat_g": 4.5, "cholesterol_mg": 18.0, "sodium_mg": 180, "potassium_mg": 360, "magnesium_mg": 68, "calcium_mg": 42, "iron_mg": 2.1, "zinc_mg": 1.3}'::jsonb,
    308, 1850, 250, 310, 5.0, 7.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.145)',
    array['عريكة', 'العريكة', 'عريكة عسيرية', 'عريكة جنوبية', 'areeka asir'],
    'عريكة العريكة عريكة عسيرية عريكة جنوبية asiri areeka ghee honey'
  ),
  -- 62. مشغوثة عسيرية
  (
    'مشغوثة عسيرية', 'Asiri Mashghootha', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 170, "protein_g": 5.2, "carbs_g": 26.5, "fat_g": 4.8, "fiber_g": 4.5, "sugar_g": 11.0, "saturated_fat_g": 2.6, "cholesterol_mg": 12.0, "sodium_mg": 160, "potassium_mg": 290, "magnesium_mg": 48, "calcium_mg": 65, "iron_mg": 1.4, "zinc_mg": 1.0}'::jsonb,
    438, 1750, 150, 195, 4.5, 6.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.147)',
    array['مشغوثة', 'المشغوثة', 'مشغوثة عسيرية', 'mashghootha'],
    'مشغوثة المشغوثة مشغوثة عسيرية asiri mashghootha'
  ),
  -- 63. تصابيع عسيرية
  (
    'تصابيع عسيرية', 'Asiri Tasabee (Southern Dumplings in Milk & Ghee)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 172, "protein_g": 5.5, "carbs_g": 27.0, "fat_g": 4.6, "fiber_g": 4.2, "sugar_g": 8.5, "saturated_fat_g": 2.4, "cholesterol_mg": 10.0, "sodium_mg": 190, "potassium_mg": 240, "magnesium_mg": 42, "calcium_mg": 58, "iron_mg": 1.3, "zinc_mg": 0.95}'::jsonb,
    412, 1650, 150, 195, 4.8, 6.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.149)',
    array['تصابيع', 'التصابيع', 'تصابيع عسيرية', 'تضابيع', 'tasabee'],
    'تصابيع التصابيع تصابيع عسيرية تضابيع asiri tasabee southern dumplings'
  ),
  -- 64. حنيذ عسيري بالمرخ
  (
    'حنيذ عسيري بالمرخ', 'Asiri Haneeth with Markh', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 248, "protein_g": 26.4, "carbs_g": 0, "fat_g": 15.2, "fiber_g": 0, "sugar_g": 0, "saturated_fat_g": 6.8, "cholesterol_mg": 85.0, "sodium_mg": 290, "potassium_mg": 380, "magnesium_mg": 26, "calcium_mg": 22, "iron_mg": 2.4, "zinc_mg": 3.8}'::jsonb,
    362, 1450, 220, 275, 23.5, 29.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.151)',
    array['حنيذ', 'الحنيذ', 'حنيذ عسيري', 'حنيذ بالمرخ', 'حنيذ لحم', 'haneeth asir'],
    'حنيذ الحنيذ حنيذ عسيري حنيذ بالمرخ حنيذ لحم asiri haneeth markh'
  ),
  -- 65. خبز الميفا العسيري
  (
    'خبز الميفا العسيري', 'Asiri Mifa Oven Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 256, "protein_g": 9.2, "carbs_g": 48.5, "fat_g": 2.1, "fiber_g": 8.5, "sugar_g": 1.8, "saturated_fat_g": 0.4, "cholesterol_mg": 0, "sodium_mg": 280, "potassium_mg": 320, "magnesium_mg": 82, "calcium_mg": 36, "iron_mg": 2.8, "zinc_mg": 1.8}'::jsonb,
    205, 820, 230, 280, 8.0, 10.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.153)',
    array['خبز ميفا', 'الميفا', 'خبز الميفا', 'خبز تنور عسيري', 'mifa bread'],
    'خبز ميفا الميفا خبز الميفا خبز تنور عسيري asiri mifa bread'
  ),
  -- 66. مقلقل عسيري
  (
    'مقلقل عسيري', 'Asiri Muqalqal Lamb', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 208, "protein_g": 18.5, "carbs_g": 4.2, "fat_g": 13.0, "fiber_g": 1.1, "sugar_g": 1.8, "saturated_fat_g": 5.2, "cholesterol_mg": 68.0, "sodium_mg": 360, "potassium_mg": 340, "magnesium_mg": 24, "calcium_mg": 26, "iron_mg": 2.2, "zinc_mg": 2.9}'::jsonb,
    262, 1050, 185, 235, 16.5, 21.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.155)',
    array['مقلقل', 'المقلقل', 'مقلقل عسيري', 'مقلقل لحم جنوبي', 'muqalqal asir'],
    'مقلقل المقلقل مقلقل عسيري مقلقل لحم جنوبي asiri muqalqal lamb'
  ),
  -- 67. رقش عسيري باللحم
  (
    'رقش عسيري باللحم', 'Asiri Raqash Meat Broth', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 163, "protein_g": 11.2, "carbs_g": 18.0, "fat_g": 4.8, "fiber_g": 3.8, "sugar_g": 1.5, "saturated_fat_g": 1.9, "cholesterol_mg": 32.0, "sodium_mg": 310, "potassium_mg": 290, "magnesium_mg": 38, "calcium_mg": 32, "iron_mg": 2.0, "zinc_mg": 1.8}'::jsonb,
    445, 1780, 145, 185, 9.8, 12.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.157)',
    array['رقش', 'الرقش', 'رقش عسيري', 'رقش باللحم', 'raqash asir'],
    'رقش الرقش رقش عسيري رقش باللحم asiri raqash meat broth'
  ),
  -- 68. كبيبة حائل
  (
    'كبيبة حائل', 'Hail Kebebah (Rice & Lamb Stuffed Grape Leaves)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 160, "protein_g": 7.4, "carbs_g": 18.5, "fat_g": 6.2, "fiber_g": 3.2, "sugar_g": 1.8, "saturated_fat_g": 2.4, "cholesterol_mg": 22.0, "sodium_mg": 340, "potassium_mg": 270, "magnesium_mg": 28, "calcium_mg": 45, "iron_mg": 1.8, "zinc_mg": 1.5}'::jsonb,
    412, 1650, 140, 180, 6.5, 8.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.161)',
    array['كبيبة', 'الكبيبة', 'كبيبة حائل', 'كبيبة حائلية', 'kebebah hail'],
    'كبيبة الكبيبة كبيبة حائل كبيبة حائلية hail kebebah stuffed leaves'
  ),
  -- 69. مقشوش حائل
  (
    'مقشوش حائل', 'Hail Maqshoosh (Saudi National Dessert)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 276, "protein_g": 7.8, "carbs_g": 44.5, "fat_g": 7.2, "fiber_g": 5.8, "sugar_g": 16.5, "added_sugar_g": 12.0, "saturated_fat_g": 3.5, "cholesterol_mg": 18.0, "sodium_mg": 195, "potassium_mg": 280, "magnesium_mg": 52, "calcium_mg": 44, "iron_mg": 2.1, "zinc_mg": 1.2}'::jsonb,
    195, 780, 250, 305, 6.8, 9.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.163)',
    array['مقشوش', 'المقشوش', 'مقشوش حائل', 'مقشوش حائلي', 'حلوى المقشوش', 'maqshoosh'],
    'مقشوش المقشوش مقشوش حائل مقشوش حائلي حلوى المقشوش hail maqshoosh national dessert'
  ),
  -- 70. هريس حائل
  (
    'هريس حائل', 'Hail Harees with Meat', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 162, "protein_g": 9.5, "carbs_g": 15.0, "fat_g": 6.8, "fiber_g": 3.9, "sugar_g": 0.2, "saturated_fat_g": 2.8, "cholesterol_mg": 24.0, "sodium_mg": 280, "potassium_mg": 210, "magnesium_mg": 26, "calcium_mg": 34, "iron_mg": 1.4, "zinc_mg": 1.6}'::jsonb,
    525, 2100, 145, 185, 8.2, 11.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.165)',
    array['هريس', 'الهريس', 'هريس حائل', 'هريس باللحم', 'harees hail'],
    'هريس الهريس هريس حائل هريس باللحم hail harees meat'
  ),
  -- 71. مليحية حائل
  (
    'مليحية حائل', 'Hail Mlaihiyah (Rice & Meat with Cooked Laban)', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 162, "protein_g": 8.8, "carbs_g": 17.2, "fat_g": 6.1, "fiber_g": 3.5, "sugar_g": 2.1, "saturated_fat_g": 2.6, "cholesterol_mg": 25.0, "sodium_mg": 380, "potassium_mg": 260, "magnesium_mg": 32, "calcium_mg": 78, "iron_mg": 1.5, "zinc_mg": 1.7}'::jsonb,
    562, 2250, 145, 185, 7.6, 10.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.167)',
    array['مليحية', 'المليحية', 'مليحية حائل', 'mlaihiyah hail'],
    'مليحية المليحية مليحية حائل hail mlaihiyah laban meat'
  ),
  -- 72. مجلوبة تبوك
  (
    'مجلوبة تبوك', 'Tabuk Majloobah', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 156, "protein_g": 8.2, "carbs_g": 17.5, "fat_g": 5.8, "fiber_g": 2.8, "sugar_g": 0.5, "saturated_fat_g": 2.2, "cholesterol_mg": 26.0, "sodium_mg": 290, "potassium_mg": 230, "magnesium_mg": 22, "calcium_mg": 25, "iron_mg": 1.3, "zinc_mg": 1.4}'::jsonb,
    512, 2050, 140, 175, 7.1, 9.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.173)',
    array['مجلوبة', 'المجلوبة', 'مجلوبة تبوك', 'majloobah tabuk'],
    'مجلوبة المجلوبة مجلوبة تبوك tabuk majloobah'
  ),
  -- 73. صيادية سمك تبوك
  (
    'صيادية سمك تبوك', 'Tabuk Sayadiyah Fish & Rice', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 148, "protein_g": 11.5, "carbs_g": 18.2, "fat_g": 3.2, "fiber_g": 1.2, "sugar_g": 1.1, "saturated_fat_g": 0.8, "cholesterol_mg": 34.0, "sodium_mg": 310, "potassium_mg": 280, "magnesium_mg": 24, "calcium_mg": 28, "iron_mg": 1.1, "zinc_mg": 0.95}'::jsonb,
    488, 1950, 130, 168, 10.2, 13.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.175)',
    array['صيادية', 'الصيادية', 'صيادية تبوك', 'صيادية سمك', 'sayadiyah tabuk'],
    'صيادية الصيادية صيادية تبوك صيادية سمك tabuk sayadiyah fish rice'
  ),
  -- 74. مكمورة تبوك
  (
    'مكمورة تبوك', 'Tabuk Makmoorah Layered Dish', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 170, "protein_g": 9.8, "carbs_g": 21.0, "fat_g": 5.1, "fiber_g": 3.4, "sugar_g": 1.4, "saturated_fat_g": 1.6, "cholesterol_mg": 28.0, "sodium_mg": 270, "potassium_mg": 250, "magnesium_mg": 30, "calcium_mg": 26, "iron_mg": 1.7, "zinc_mg": 1.2}'::jsonb,
    455, 1820, 150, 195, 8.5, 11.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.177)',
    array['مكمورة', 'المكمورة', 'مكمورة تبوك', 'makmoorah tabuk'],
    'مكمورة المكمورة مكمورة تبوك tabuk makmoorah'
  ),
  -- 75. قرص جمر تبوك
  (
    'قرص جمر تبوك', 'Tabuk Qurs Jamr (Ember-Baked Bread)', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 264, "protein_g": 9.8, "carbs_g": 50.2, "fat_g": 2.4, "fiber_g": 8.8, "sugar_g": 2.1, "saturated_fat_g": 0.5, "cholesterol_mg": 0, "sodium_mg": 260, "potassium_mg": 340, "magnesium_mg": 85, "calcium_mg": 38, "iron_mg": 2.9, "zinc_mg": 1.9}'::jsonb,
    212, 850, 240, 290, 8.6, 11.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.179)',
    array['قرص جمر', 'خبز جمر', 'قرص النار', 'qurs jamr tabuk'],
    'قرص جمر خبز جمر قرص النار tabuk qurs jamr bread'
  ),
  -- 76. دغابيس الباحة باللحم
  (
    'دغابيس الباحة باللحم', 'Al-Baha Daghabees with Lamb', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 149, "protein_g": 8.6, "carbs_g": 16.8, "fat_g": 5.1, "fiber_g": 4.2, "sugar_g": 1.2, "saturated_fat_g": 2.1, "cholesterol_mg": 25.0, "sodium_mg": 320, "potassium_mg": 270, "magnesium_mg": 36, "calcium_mg": 32, "iron_mg": 1.9, "zinc_mg": 1.7}'::jsonb,
    562, 2250, 130, 170, 7.5, 9.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.197)',
    array['دغابيس', 'الدغابيس', 'دغابيس الباحة', 'دغابيس باللحم', 'daghabees baha'],
    'دغابيس الدغابيس دغابيس الباحة دغابيس باللحم al-baha daghabees lamb'
  ),
  -- 77. خبزة المقناة الجنوبية
  (
    'خبزة المقناة الجنوبية', 'Southern Khubzat Al-Maqnah', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 257, "protein_g": 9.1, "carbs_g": 49.0, "fat_g": 2.2, "fiber_g": 8.6, "sugar_g": 2.4, "saturated_fat_g": 0.4, "cholesterol_mg": 0, "sodium_mg": 275, "potassium_mg": 330, "magnesium_mg": 88, "calcium_mg": 40, "iron_mg": 2.8, "zinc_mg": 1.9}'::jsonb,
    233, 1400, 230, 285, 8.0, 10.4, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.199)',
    array['خبزة المقناة', 'المقناة', 'خبزة جنوبية', 'خبزة الباحة', 'khubzat maqnah'],
    'خبزة المقناة المقناة خبزة جنوبية خبزة الباحة southern khubzat maqnah'
  ),
  -- 78. فتة الدخن بالسمن والعسل
  (
    'فتة الدخن بالسمن والعسل', 'Southern Millet Fatteh with Ghee & Honey', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 290, "protein_g": 6.5, "carbs_g": 48.0, "fat_g": 8.2, "fiber_g": 7.2, "sugar_g": 22.0, "added_sugar_g": 10.0, "saturated_fat_g": 4.6, "cholesterol_mg": 19.0, "sodium_mg": 170, "potassium_mg": 350, "magnesium_mg": 92, "calcium_mg": 46, "iron_mg": 2.6, "zinc_mg": 1.7}'::jsonb,
    300, 1200, 260, 320, 5.6, 7.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.201)',
    array['فتة دخن', 'فتة الدخن', 'فتة جنوبية بالسمن', 'fatteh dukhan'],
    'فتة دخن فتة الدخن فتة جنوبية بالسمن southern millet fatteh ghee honey'
  ),
  -- 79. حميسة الشمال
  (
    'حميسة الشمال', 'Northern Hameesah Meat Stew', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 191, "protein_g": 16.8, "carbs_g": 4.5, "fat_g": 11.5, "fiber_g": 0.8, "sugar_g": 1.2, "saturated_fat_g": 4.8, "cholesterol_mg": 62.0, "sodium_mg": 360, "potassium_mg": 310, "magnesium_mg": 24, "calcium_mg": 22, "iron_mg": 2.1, "zinc_mg": 2.6}'::jsonb,
    275, 1100, 170, 215, 15.0, 19.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.223)',
    array['حميسة', 'الحميسة', 'حميسة الشمال', 'hameesah north'],
    'حميسة الحميسة حميسة الشمال northern hameesah meat stew'
  ),
  -- 80. بكيلة الشمال بالتمر والسمح
  (
    'بكيلة الشمال بالتمر والسمح', 'Northern Bakeelah with Dates & Samh', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 327, "protein_g": 7.4, "carbs_g": 58.0, "fat_g": 6.8, "fiber_g": 9.2, "sugar_g": 44.0, "saturated_fat_g": 3.2, "cholesterol_mg": 14.0, "sodium_mg": 45, "potassium_mg": 580, "magnesium_mg": 88, "calcium_mg": 72, "iron_mg": 2.5, "zinc_mg": 1.6}'::jsonb,
    205, 820, 295, 360, 6.4, 8.6, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.225)',
    array['بكيلة', 'البكيلة', 'بكيلة الشمال', 'بكيلة بالسمح', 'bakeelah north'],
    'بكيلة البكيلة بكيلة الشمال بكيلة بالسمح northern bakeelah dates samh'
  ),
  -- 81. بكيلة الجوف بالسمح
  (
    'بكيلة الجوف بالسمح', 'Al-Jouf Bakeelah with Samh Seeds', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 327, "protein_g": 7.5, "carbs_g": 57.5, "fat_g": 7.1, "fiber_g": 9.5, "sugar_g": 43.5, "saturated_fat_g": 3.4, "cholesterol_mg": 15.0, "sodium_mg": 48, "potassium_mg": 590, "magnesium_mg": 90, "calcium_mg": 75, "iron_mg": 2.6, "zinc_mg": 1.7}'::jsonb,
    210, 840, 295, 360, 6.5, 8.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.239)',
    array['بكيلة الجوف', 'سمح الجوف', 'bakeelah jouf'],
    'بكيلة الجوف سمح الجوف al-jouf bakeelah samh'
  ),
  -- 82. حلوة الجوف
  (
    'حلوة الجوف', 'Halwat Al-Jouf Date Dessert', 'sfct_2025', 'fruit_dates', 'ready_to_eat',
    '{"calories": 320, "protein_g": 4.8, "carbs_g": 62.0, "fat_g": 5.8, "fiber_g": 7.8, "sugar_g": 48.0, "saturated_fat_g": 2.8, "cholesterol_mg": 12.0, "sodium_mg": 38, "potassium_mg": 540, "magnesium_mg": 65, "calcium_mg": 55, "iron_mg": 1.8, "zinc_mg": 1.2}'::jsonb,
    188, 750, 290, 350, 4.0, 5.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.241)',
    array['حلوة الجوف', 'حلوى الجوف', 'تمر حلوة الجوف', 'halwat jouf'],
    'حلوة الجوف حلوى الجوف تمر حلوة الجوف halwat al-jouf date'
  ),
  -- 83. مسخن الجوف بزيت الزيتون
  (
    'مسخن الجوف بزيت الزيتون', 'Al-Jouf Olive Oil Roasted Chicken Musakhan', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 225, "protein_g": 16.4, "carbs_g": 14.8, "fat_g": 11.2, "fiber_g": 2.5, "sugar_g": 2.8, "saturated_fat_g": 1.8, "cholesterol_mg": 48.0, "sodium_mg": 340, "potassium_mg": 310, "magnesium_mg": 28, "calcium_mg": 38, "iron_mg": 1.7, "zinc_mg": 1.5}'::jsonb,
    345, 1380, 200, 255, 14.5, 18.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.243)',
    array['مسخن الجوف', 'مسخن بزيت الزيتون', 'دجاج مسخن الجوف', 'musakhan jouf'],
    'مسخن الجوف مسخن بزيت الزيتون دجاج مسخن الجوف al-jouf chicken musakhan olive oil'
  ),
  -- 84. مرسة جازان بالعسل والسمن
  (
    'مرسة جازان بالعسل والسمن', 'Jazani Marsah with Honey, Ghee & Banana', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 270, "protein_g": 4.8, "carbs_g": 46.5, "fat_g": 7.8, "fiber_g": 4.2, "sugar_g": 26.0, "added_sugar_g": 10.0, "saturated_fat_g": 4.2, "cholesterol_mg": 16.0, "sodium_mg": 160, "potassium_mg": 320, "magnesium_mg": 42, "calcium_mg": 32, "iron_mg": 1.6, "zinc_mg": 0.9}'::jsonb,
    338, 1350, 240, 300, 4.0, 5.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.265)',
    array['مرسة', 'المرسة', 'مرسة جازان', 'مرسة جازانية', 'marsah jazan'],
    'مرسة المرسة مرسة جازان مرسة جازانية jazani marsah honey ghee'
  ),
  -- 85. سمك ميفا جازاني
  (
    'سمك ميفا جازاني', 'Jazani Mifa Oven Baked Fish', 'sfct_2025', 'meat_poultry', 'cooked',
    '{"calories": 152, "protein_g": 24.5, "carbs_g": 1.5, "fat_g": 5.2, "fiber_g": 0.4, "sugar_g": 0.2, "saturated_fat_g": 1.1, "cholesterol_mg": 65.0, "sodium_mg": 280, "potassium_mg": 410, "magnesium_mg": 35, "calcium_mg": 42, "iron_mg": 1.1, "zinc_mg": 0.95}'::jsonb,
    300, 1200, 135, 175, 22.0, 27.5, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.267)',
    array['سمك ميفا', 'سمك ميفا جازاني', 'حنيذ سمك ميفا', 'mifa fish jazan'],
    'سمك ميفا سمك ميفا جازاني حنيذ سمك ميفا jazani mifa baked fish'
  ),
  -- 86. مغش جازاني باللحم
  (
    'مغش جازاني باللحم', 'Jazani Maghash Stone Pot Meat Stew', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 154, "protein_g": 14.8, "carbs_g": 6.2, "fat_g": 7.6, "fiber_g": 2.1, "sugar_g": 1.8, "saturated_fat_g": 3.1, "cholesterol_mg": 45.0, "sodium_mg": 330, "potassium_mg": 360, "magnesium_mg": 28, "calcium_mg": 28, "iron_mg": 2.2, "zinc_mg": 2.8}'::jsonb,
    462, 1850, 135, 175, 13.0, 16.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.269)',
    array['مغش', 'المغش', 'مغش جازاني', 'مغش باللحم', 'maghash jazan'],
    'مغش المغش مغش جازاني مغش باللحم jazani maghash stone pot meat'
  ),
  -- 87. خمير جازاني بالذرة الرفيعة
  (
    'خمير جازاني بالذرة الرفيعة', 'Jazani Red Sorghum Khameer Bread', 'sfct_2025', 'bread_pastry', 'ready_to_eat',
    '{"calories": 229, "protein_g": 7.6, "carbs_g": 46.2, "fat_g": 1.8, "fiber_g": 7.5, "sugar_g": 1.4, "saturated_fat_g": 0.3, "cholesterol_mg": 0, "sodium_mg": 240, "potassium_mg": 310, "magnesium_mg": 84, "calcium_mg": 32, "iron_mg": 3.1, "zinc_mg": 1.7}'::jsonb,
    212, 850, 205, 255, 6.8, 8.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.271)',
    array['خمير جازاني', 'خبز خمير جازان', 'خمير ذرة', 'khameer jazan'],
    'خمير جازاني خبز خمير جازان خمير ذرة jazani sorghum khameer bread'
  ),
  -- 88. وفد نجراني بالمرق واللحم
  (
    'وفد نجراني بالمرق واللحم', 'Najrani Wafd with Broth & Lamb', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 158, "protein_g": 10.4, "carbs_g": 17.5, "fat_g": 5.2, "fiber_g": 3.8, "sugar_g": 1.1, "saturated_fat_g": 2.1, "cholesterol_mg": 30.0, "sodium_mg": 310, "potassium_mg": 280, "magnesium_mg": 38, "calcium_mg": 30, "iron_mg": 1.9, "zinc_mg": 1.8}'::jsonb,
    538, 2150, 140, 180, 9.2, 11.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.283)',
    array['وفد', 'الوفد', 'وفد نجراني', 'وفد بالمرق', 'wafd najran'],
    'وفد الوفد وفد نجراني وفد بالمرق najrani wafd broth lamb'
  ),
  -- 89. رقش نجراني باللحم
  (
    'رقش نجراني باللحم', 'Najrani Raqash in Stone Pot with Meat', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 166, "protein_g": 11.5, "carbs_g": 18.2, "fat_g": 5.0, "fiber_g": 4.0, "sugar_g": 1.2, "saturated_fat_g": 2.0, "cholesterol_mg": 34.0, "sodium_mg": 320, "potassium_mg": 290, "magnesium_mg": 40, "calcium_mg": 34, "iron_mg": 2.1, "zinc_mg": 1.9}'::jsonb,
    475, 1900, 145, 188, 10.2, 13.0, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.285)',
    array['رقش نجراني', 'رقش باللحم', 'رقش مدهن', 'raqash najran meat'],
    'رقش نجراني رقش باللحم رقش مدهن najrani raqash meat stone pot'
  ),
  -- 90. رقش نجراني بالسمن والحليب
  (
    'رقش نجراني بالسمن والحليب', 'Sweet Najrani Raqash with Ghee & Milk', 'sfct_2025', 'traditional_dish', 'cooked',
    '{"calories": 186, "protein_g": 6.2, "carbs_g": 26.5, "fat_g": 6.2, "fiber_g": 3.6, "sugar_g": 8.5, "saturated_fat_g": 3.5, "cholesterol_mg": 16.0, "sodium_mg": 210, "potassium_mg": 270, "magnesium_mg": 42, "calcium_mg": 88, "iron_mg": 1.5, "zinc_mg": 1.1}'::jsonb,
    388, 1550, 165, 210, 5.2, 7.2, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.287)',
    array['رقش بالسمن والحليب', 'رقش حلو', 'raqash najran sweet'],
    'رقش بالسمن والحليب رقش حلو sweet najrani raqash ghee milk'
  ),
  -- 91. رضيفة نجرانية
  (
    'رضيفة نجرانية', 'Najrani Radheefah (Smoked Ghee with Hot Granite)', 'sfct_2025', 'traditional_dish', 'ready_to_eat',
    '{"calories": 702, "protein_g": 2.1, "carbs_g": 6.5, "fat_g": 76.5, "fiber_g": 0.8, "sugar_g": 1.2, "saturated_fat_g": 48.0, "cholesterol_mg": 185.0, "sodium_mg": 120, "potassium_mg": 95, "magnesium_mg": 12, "calcium_mg": 42, "iron_mg": 0.5, "zinc_mg": 0.4}'::jsonb,
    105, 420, 650, 760, 1.5, 2.8, 'low', 'SFDA Saudi Food Composition Tables (SFCT 2025) - Lab Analyzed (p.289)',
    array['رضيفة', 'الرضيفة', 'رضيفة نجرانية', 'رضيفه', 'radheefah najran'],
    'رضيفة الرضيفة رضيفة نجرانية رضيفه najrani radheefah smoked ghee'
  )
on conflict (name_ar) where source = 'sfct_2025' do update set
  name_en = excluded.name_en,
  category = excluded.category,
  state = excluded.state,
  per_100g = excluded.per_100g,
  default_portion_g = excluded.default_portion_g,
  reference_unit_g = excluded.reference_unit_g,
  cal_range_min = excluded.cal_range_min,
  cal_range_max = excluded.cal_range_max,
  protein_range_min = excluded.protein_range_min,
  protein_range_max = excluded.protein_range_max,
  uncertainty_level = excluded.uncertainty_level,
  verification_notes = excluded.verification_notes,
  aliases = excluded.aliases,
  search_text = excluded.search_text;

