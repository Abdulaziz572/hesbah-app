-- ============================================================
-- Hesbah App — Task 3: Saudi Food Engine Seed Data & Schema Extensions
-- Idempotent schema upgrades and curated reference estimates
-- ============================================================

-- 1. Extend public.foods table idempotently with metadata columns
alter table public.foods add column if not exists category text;
alter table public.foods add column if not exists default_portion_g numeric;
alter table public.foods add column if not exists reference_unit_g numeric;
alter table public.foods add column if not exists cal_range_min numeric;
alter table public.foods add column if not exists cal_range_max numeric;
alter table public.foods add column if not exists protein_range_min numeric;
alter table public.foods add column if not exists protein_range_max numeric;
alter table public.foods add column if not exists uncertainty_level text;
alter table public.foods add column if not exists verification_notes text;

-- 2. Idempotent Upsert for Curated Reference Saudi Foods
insert into public.foods (
  name_ar, name_en, source, category, state, per_100g,
  default_portion_g, reference_unit_g, cal_range_min, cal_range_max,
  protein_range_min, protein_range_max, uncertainty_level, verification_notes, aliases, search_text
)
select * from (values
  (
    'خبز تميس عادي', 'Plain Tamees Bread', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 275, "protein_g": 8.5, "carbs_g": 54, "fat_g": 2.5}'::jsonb,
    90, 360, 250, 300, 7.5, 9.5, 'low', 'SFDA / Saudi MOH nutrition tables',
    array['تميس', 'تميس عادي', 'خبز تميس', 'tamees', 'tameez'],
    'خبز تميس عادي تميس تميس عادي خبز تميس plain tamees bread'
  ),
  (
    'تميس بالجبن', 'Cheese Tamees Bread', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 310, "protein_g": 11, "carbs_g": 46, "fat_g": 9}'::jsonb,
    110, 440, 280, 345, 9.5, 12.5, 'medium', 'SFDA / Saudi MOH nutrition tables',
    array['تميس جبن', 'تميس بالجبنة', 'خبز تميس جبن'],
    'تميس بالجبن تميس جبن تميس بالجبنة خبز تميس جبن cheese tamees bread'
  ),
  (
    'تميس بالسمن / بسكوت', 'Ghee / Biscuit Tamees Bread', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 340, "protein_g": 8, "carbs_g": 52, "fat_g": 11}'::jsonb,
    95, 380, 310, 380, 7, 9, 'medium', 'SFDA / Saudi MOH nutrition tables',
    array['تميس سمن', 'تميس بسكوت', 'تميس بالسمن'],
    'تميس بالسمن بسكوت تميس سمن تميس بسكوت تميس بالسمن ghee biscuit tamees'
  ),
  (
    'خبز صامولي', 'Samoli Bread Roll', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 275, "protein_g": 8.3, "carbs_g": 51.7, "fat_g": 3.3}'::jsonb,
    60, 60, 260, 295, 7.5, 9, 'low', 'SFDA / Saudi MOH nutrition tables',
    array['صامولي', 'عيش صامولي', 'خبز صمولي', 'samoli'],
    'خبز صامولي صامولي عيش صامولي خبز صمولي samoli bread roll'
  ),
  (
    'خبز مفرود / عربي', 'Arabic Flatbread (Mafrood)', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 275, "protein_g": 8.3, "carbs_g": 55, "fat_g": 1.7}'::jsonb,
    60, 60, 260, 290, 7.5, 9, 'low', 'SFDA / Saudi MOH nutrition tables',
    array['خبز مفرود', 'خبز عربي', 'عيش مفرود', 'خبز ابيض', 'pita'],
    'خبز مفرود عربي خبز مفرود خبز عربي عيش مفرود خبز ابيض arabic flatbread mafrood pita'
  ),
  (
    'مطبق مالح (لحم/بيض/كراث)', 'Savory Mutabbaq (Meat & Egg)', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 230, "protein_g": 9, "carbs_g": 24, "fat_g": 11}'::jsonb,
    180, 360, 195, 270, 7, 11, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['مطبق', 'مطبق مالح', 'مطبق لحم', 'mutabbaq'],
    'مطبق مالح لحم بيض كراث مطبق مطبق مالح مطبق لحم savory mutabbaq'
  ),
  (
    'معصوب (عادي بالموز والقشطة)', 'Masoob (Banana & Cream)', 'curated_estimate', 'bread_pastry', 'ready_to_eat',
    '{"calories": 260, "protein_g": 5, "carbs_g": 36, "fat_g": 11}'::jsonb,
    250, 500, 220, 320, 4, 6.5, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['معصوب', 'معصوب بالقشطة', 'معصوب موز', 'masoob'],
    'معصوب عادي بالموز والقشطة معصوب معصوب بالقشطة معصوب موز masoob'
  ),
  (
    'أرز كبسة / مضغوط (مطبوخ بدون اللحم)', 'Cooked Kabsa / Madghoot Rice', 'curated_estimate', 'rice_grain', 'cooked',
    '{"calories": 155, "protein_g": 3, "carbs_g": 30, "fat_g": 2.5}'::jsonb,
    250, 250, 140, 175, 2.5, 3.5, 'medium', 'USDA cooked seasoned rice / SFDA',
    array['رز كبسة', 'أرز كبسة', 'رز مضغوط', 'ارز مضغوط', 'كبسة رز'],
    'أرز كبسة مضغوط مطبوخ بدون اللحم رز كبسة أرز كبسة رز مضغوط ارز مضغوط cooked kabsa rice'
  ),
  (
    'أرز أبيض مسلوق / بشاور (مطبوخ)', 'Cooked Plain White / Peshawari Rice', 'curated_estimate', 'rice_grain', 'cooked',
    '{"calories": 130, "protein_g": 2.7, "carbs_g": 28, "fat_g": 0.3}'::jsonb,
    220, 220, 120, 140, 2.4, 3, 'low', 'USDA FoodData Central cooked white rice',
    array['رز ابيض', 'أرز أبيض', 'رز بشاور', 'رز مسلوق', 'white rice'],
    'أرز أبيض مسلوق بشاور مطبوخ رز ابيض أرز أبيض رز بشاور رز مسلوق white rice'
  ),
  (
    'أرز بخاري / مندي (مطبوخ)', 'Cooked Bukhari / Mandi Rice', 'curated_estimate', 'rice_grain', 'cooked',
    '{"calories": 165, "protein_g": 3, "carbs_g": 31, "fat_g": 3.2}'::jsonb,
    250, 250, 145, 185, 2.5, 3.5, 'medium', 'USDA / SFDA',
    array['رز بخاري', 'رز مندي', 'أرز بخاري', 'أرز مندي', 'ارز بخاري'],
    'أرز بخاري مندي مطبوخ رز بخاري رز مندي أرز بخاري أرز مندي bukhari mandi rice'
  ),
  (
    'جريش', 'Jareesh (Cracked Wheat)', 'curated_estimate', 'traditional_dish', 'cooked',
    '{"calories": 135, "protein_g": 4.5, "carbs_g": 21, "fat_g": 3.5}'::jsonb,
    250, 250, 115, 165, 3.5, 5.5, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['جريش', 'الجريش', 'جريش احمر', 'جريش ابيض', 'jareesh'],
    'جريش الجريش جريش احمر جريش ابيض jareesh'
  ),
  (
    'قرصان بالخضار واللحم', 'Qursan with Vegetables', 'curated_estimate', 'traditional_dish', 'cooked',
    '{"calories": 145, "protein_g": 6, "carbs_g": 20, "fat_g": 4.5}'::jsonb,
    250, 250, 120, 175, 4.5, 7.5, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['قرصان', 'القرصان', 'qursan'],
    'قرصان بالخضار واللحم قرصان القرصان qursan'
  ),
  (
    'سليق (أرز بالحليب بدون الدجاج)', 'Saleeg Rice (without Chicken)', 'curated_estimate', 'traditional_dish', 'cooked',
    '{"calories": 150, "protein_g": 4, "carbs_g": 24, "fat_g": 4}'::jsonb,
    250, 250, 130, 180, 3.2, 5, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['سليق', 'سليق طائفي', 'رز سليق', 'saleeg'],
    'سليق أرز بالحليب بدون الدجاج سليق طائفي رز سليق saleeg rice'
  ),
  (
    'مرقوق', 'Margoog', 'curated_estimate', 'traditional_dish', 'cooked',
    '{"calories": 140, "protein_g": 5.5, "carbs_g": 21, "fat_g": 4}'::jsonb,
    250, 250, 115, 170, 4, 7, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['مرقوق', 'المرقوق', 'margoog'],
    'مرقوق المرقوق margoog'
  ),
  (
    'دجاج شواية / مضغوط / مندي / كبسة (صافي اللحم المأكول بدون العظم)', 'Cooked Chicken Meat (Boneless / Edible)', 'curated_estimate', 'meat_poultry', 'cooked',
    '{"calories": 215, "protein_g": 26, "carbs_g": 0, "fat_g": 11.5}'::jsonb,
    115, 460, 195, 240, 24, 28, 'low', 'USDA FoodData Central roasted chicken meat',
    array['دجاج كبسة', 'دجاج شواية', 'دجاج مندي', 'دجاج مضغوط', 'دجاج مسحب', 'دجاج مشوي', 'نص حبة دجاج', 'ربع دجاجة', 'حبة دجاج'],
    'دجاج شواية مضغوط مندي كبسة صافي اللحم المأكول بدون العظم دجاج كبسة دجاج شواية دجاج مندي chicken'
  ),
  (
    'لحم غنم / حاشي مطبوخ (صافي بدون عظم)', 'Cooked Lamb / Camel Meat (Boneless)', 'curated_estimate', 'meat_poultry', 'cooked',
    '{"calories": 270, "protein_g": 25, "carbs_g": 0, "fat_g": 19}'::jsonb,
    100, 400, 240, 310, 23, 27, 'medium', 'USDA FoodData Central cooked lamb/mutton',
    array['لحم كبسة', 'لحم غنم', 'لحم حاشي', 'لحم مندي', 'لحم مضغوط', 'cooked lamb'],
    'لحم غنم حاشي مطبوخ صافي بدون عظم لحم كبسة لحم غنم لحم حاشي لحم مندي cooked lamb meat'
  ),
  (
    'فول مدمس / قلابة (بدون زيت إضافي كثير)', 'Foul Mudammas / Qallaba', 'curated_estimate', 'legume', 'cooked',
    '{"calories": 115, "protein_g": 7, "carbs_g": 16, "fat_g": 2.5}'::jsonb,
    200, 200, 100, 145, 6, 8, 'medium', 'USDA cooked fava beans / SFDA',
    array['فول', 'فول مدمس', 'فول قلابة', 'صحن فول', 'foul'],
    'فول مدمس قلابة بدون زيت إضافي كثير فول فول مدمس فول قلابة صحن فول foul mudammas'
  ),
  (
    'عدس / دال (مطبوخ)', 'Cooked Lentils / Dal', 'curated_estimate', 'legume', 'cooked',
    '{"calories": 125, "protein_g": 7.5, "carbs_g": 18, "fat_g": 2.5}'::jsonb,
    200, 200, 110, 150, 6.5, 8.5, 'low', 'USDA FoodData Central cooked lentils',
    array['عدس', 'شوربة عدس', 'دال', 'عدس مطبوخ', 'lentils'],
    'عدس دال مطبوخ عدس شوربة عدس دال عدس مطبوخ cooked lentils dal'
  ),
  (
    'سمبوسة لحم / دجاج بالفرن أو القلاية الهوائية', 'Baked / Air-Fried Sambusa', 'curated_estimate', 'snack_fastfood', 'cooked',
    '{"calories": 238, "protein_g": 12.5, "carbs_g": 27.5, "fat_g": 8.8}'::jsonb,
    40, 40, 210, 265, 10, 14, 'medium', 'SFDA / Saudi MOH nutrition tables',
    array['سمبوسة بالفرن', 'سمبوسة لحم فرن', 'سمبوسة قلاية هوائية', 'سمبوسة مشوية', 'samboosa baked'],
    'سمبوسة لحم دجاج بالفرن القلاية الهوائية سمبوسة بالفرن سمبوسة مشوية samboosa baked'
  ),
  (
    'سمبوسة مقلية بالزيت', 'Fried Sambusa', 'curated_estimate', 'snack_fastfood', 'cooked',
    '{"calories": 338, "protein_g": 11.3, "carbs_g": 27.5, "fat_g": 20}'::jsonb,
    40, 40, 300, 380, 9.5, 13, 'high', 'SFDA / Saudi MOH nutrition tables',
    array['سمبوسة', 'سمبوسك', 'سمبوسة مقلية', 'سمبوسة زيت', 'samboosa fried'],
    'سمبوسة مقلية بالزيت سمبوسة سمبوسك سمبوسة مقلية سمبوسة زيت samboosa fried'
  ),
  (
    'شاورما دجاج عادي (خبز عربي صغير)', 'Regular Chicken Shawarma (Small Pita)', 'curated_estimate', 'snack_fastfood', 'ready_to_eat',
    '{"calories": 227, "protein_g": 13.3, "carbs_g": 20, "fat_g": 10}'::jsonb,
    150, 150, 200, 260, 11, 15, 'medium', 'SFDA / Saudi MOH nutrition tables',
    array['شاورما', 'شاورما دجاج', 'ساندوتش شاورما', 'شاورما عادي', 'shawarma'],
    'شاورما دجاج عادي خبز عربي صغير شاورما شاورما دجاج ساندوتش شاورما chicken shawarma'
  ),
  (
    'شاورما صاروخ / صاج كبير', 'Large Sarookh / Saj Chicken Shawarma', 'curated_estimate', 'snack_fastfood', 'ready_to_eat',
    '{"calories": 229, "protein_g": 12.5, "carbs_g": 19.6, "fat_g": 10.7}'::jsonb,
    280, 280, 205, 265, 10.5, 14.5, 'medium', 'SFDA / Saudi MOH nutrition tables',
    array['شاورما صاروخ', 'صاروخ شاورما', 'شاورما صاج'],
    'شاورما صاروخ صاج كبير صاروخ شاورما شاورما صاج large sarookh shawarma'
  ),
  (
    'تمر (سكري / خلاص / صقعي)', 'Dates (Sukari / Khalas / Sagai)', 'curated_estimate', 'fruit_dates', 'ready_to_eat',
    '{"calories": 282, "protein_g": 2, "carbs_g": 75, "fat_g": 0.4}'::jsonb,
    30, 30, 270, 295, 1.8, 2.5, 'low', 'USDA FoodData Central / SFDA date palms',
    array['تمر', 'رطب', 'تمر سكري', 'تمر خلاص', 'تمر صقعي', 'dates'],
    'تمر سكري خلاص صقعي رطب تمر سكري تمر خلاص تمر صقعي dates'
  )
) as v (
  name_ar, name_en, source, category, state, per_100g,
  default_portion_g, reference_unit_g, cal_range_min, cal_range_max,
  protein_range_min, protein_range_max, uncertainty_level, verification_notes, aliases, search_text
)
where not exists (
  select 1 from public.foods where public.foods.name_ar = v.name_ar
);
