import { supabase } from "./supabaseClient";
import {
  normalizeMacroNutrients,
  createMacroNutrients,
  applyPlausibilityChecks,
  cleanFoodNameForMatching,
  passesMacroSanityGuard,
  type FoodNutrition,
} from "./nutrition";
import type {
  ParsedItem,
  MealItem,
  FoodState,
  MacroSource,
  FoodCategory,
  MacroNutrients,
} from "./ai/types";
import { SFCT_SAUDI_FOODS } from "./data/sfctFoods";

export { SFCT_SAUDI_FOODS };

type Row = Record<string, unknown>;

export interface CuratedFoodEntry {
  id: string;
  name_ar: string;
  name_en: string;
  category: FoodCategory;
  state: FoodState;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  per_100g: MacroNutrients;
  default_portion_g: number;
  reference_unit_g: number;
  cal_range: [number, number];
  protein_range: [number, number];
  uncertainty_level: "low" | "medium" | "high";
  verification_notes: string;
  aliases: string[];
}

/**
 * Raw / plain staple components kept intact for composite dish decomposition
 * (e.g. Kabsa Rice + Chicken) and everyday items not covered in SFCT.
 */
export const STAPLE_SAUDI_FOODS: CuratedFoodEntry[] = [
  // Core Unadulterated Staples (Eggs, Chicken, Whole Wheat Bread, Tuna, Oats, Milk, Whey, Diet Soda)
  {
    id: "curated-boiled-egg",
    name_ar: "بيض مسلوق",
    name_en: "Boiled Egg",
    category: "meat_poultry",
    state: "cooked",
    item_type: "countable",
    per_100g: { calories: 155, protein_g: 12.6, carbs_g: 1.1, fat_g: 10.6 },
    default_portion_g: 50,
    reference_unit_g: 250,
    cal_range: [145, 165],
    protein_range: [11.5, 13.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central hard-boiled whole egg (1 large egg = 50g)",
    aliases: [
      "بيض مسلوق",
      "بيضه مسلوقه",
      "بيضة مسلوقة",
      "بيض",
      "بيضة",
      "بيضتين مسلوق",
      "boiled egg",
      "boiled eggs",
      "hard boiled egg",
      "egg",
      "eggs",
    ],
  },
  {
    id: "curated-fried-egg",
    name_ar: "بيض مقلي / عيون / أومليت",
    name_en: "Fried / Scrambled Egg",
    category: "meat_poultry",
    state: "cooked",
    item_type: "countable",
    per_100g: { calories: 196, protein_g: 13.6, carbs_g: 0.8, fat_g: 14.8 },
    default_portion_g: 50,
    reference_unit_g: 50,
    cal_range: [180, 220],
    protein_range: [12.5, 14.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central fried whole egg",
    aliases: ["بيض مقلي", "بيض عيون", "بيض اومليت", "أومليت", "بيض مخفوق", "fried egg", "scrambled eggs"],
  },
  {
    id: "curated-chicken-cooked",
    name_ar: "دجاج شواية",
    name_en: "Rotisserie / Cooked Chicken",
    category: "meat_poultry",
    state: "cooked",
    item_type: "plated",
    per_100g: { calories: 215, protein_g: 26.0, carbs_g: 0.0, fat_g: 11.5 },
    default_portion_g: 115,
    reference_unit_g: 460,
    cal_range: [195, 240],
    protein_range: [24.0, 28.0],
    uncertainty_level: "low",
    verification_notes: "صافي اللحم المأكول بدون عظم (ربع دجاجة = 115g، نصف دجاجة = 230g، حبة دجاج كاملة = 460g)",
    aliases: [
      "دجاج شواية",
      "دجاج شوايه",
      "حبة دجاج شواية",
      "حبة دجاج شوايه",
      "نص دجاجة",
      "نص دجاجه",
      "نصف دجاجة",
      "نصف دجاجه",
      "ربع دجاجة",
      "ربع دجاجه",
      "نص حبة دجاج",
      "نص حبة دجاج شواية",
      "حبة دجاج",
      "دجاج مشوي",
      "دجاج مندي",
      "دجاج مضغوط",
      "دجاج كبسة",
      "دجاج مسحب",
      "لحم دجاج",
      "دجاج مطبوخ",
      "chicken",
      "roasted chicken",
      "grilled chicken",
    ],
  },
  {
    id: "curated-chicken-breast",
    name_ar: "صدور دجاج مشوية / مسلوقة (صافي)",
    name_en: "Cooked Chicken Breast (Skinless, Boneless)",
    category: "meat_poultry",
    state: "cooked",
    item_type: "countable",
    per_100g: { calories: 165, protein_g: 31.0, carbs_g: 0, fat_g: 3.6 },
    default_portion_g: 150,
    reference_unit_g: 150,
    cal_range: [155, 175],
    protein_range: [29.0, 32.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central cooked chicken breast",
    aliases: [
      "صدور دجاج",
      "صدر دجاج",
      "صدور دجاج مشوية",
      "صدر دجاج مشوي",
      "صدور دجاج مسلوقة",
      "chicken breast",
      "grilled chicken breast",
    ],
  },
  {
    id: "curated-brown-bread",
    name_ar: "خبز بر / أسمر",
    name_en: "Whole Wheat Flatbread (Khobzet / Brown Bread)",
    category: "bread_pastry",
    state: "ready_to_eat",
    item_type: "countable",
    per_100g: { calories: 247, protein_g: 13.0, carbs_g: 41.0, fat_g: 3.4 },
    default_portion_g: 90,
    reference_unit_g: 90,
    cal_range: [235, 265],
    protein_range: [11.0, 14.0],
    uncertainty_level: "low",
    verification_notes: "USDA / SFDA whole wheat Arabic bread (1 loaf = 90g)",
    aliases: [
      "خبز بر",
      "رغيف خبز بر",
      "خبز بر رغيف",
      "خبز اسمر",
      "خبز أسمر",
      "عيش بر",
      "عيش اسمر",
      "خبز قمح كامل",
      "brown bread",
      "whole wheat bread",
    ],
  },
  {
    id: "curated-tuna-water",
    name_ar: "تونة بالماء (مصفاة)",
    name_en: "Canned Tuna in Water (Drained)",
    category: "meat_poultry",
    state: "ready_to_eat",
    item_type: "countable",
    per_100g: { calories: 116, protein_g: 25.5, carbs_g: 0.0, fat_g: 0.8 },
    default_portion_g: 100,
    reference_unit_g: 100,
    cal_range: [105, 130],
    protein_range: [23.0, 27.0],
    uncertainty_level: "low",
    verification_notes: "علبة صغيرة: 60g، علبة وسط: 100g، علبة كبيرة: 130g",
    aliases: [
      "تونة",
      "تونه",
      "علبة تونة",
      "علبه تونه",
      "تونة بالماء",
      "تونه بالماء",
      "علبة تونة بالماء",
      "علبه تونه بالماء",
      "tuna in water",
      "canned tuna in water",
      "tuna",
      "canned tuna",
    ],
  },
  {
    id: "curated-tuna-oil",
    name_ar: "تونة بالزيت (مصفاة)",
    name_en: "Canned Tuna in Oil (Drained)",
    category: "meat_poultry",
    state: "ready_to_eat",
    item_type: "countable",
    per_100g: { calories: 198, protein_g: 26.5, carbs_g: 0.0, fat_g: 10.2 },
    default_portion_g: 100,
    reference_unit_g: 100,
    cal_range: [180, 220],
    protein_range: [24.0, 28.0],
    uncertainty_level: "low",
    verification_notes: "علبة صغيرة: 60g، علبة وسط: 100g، علبة كبيرة: 130g",
    aliases: [
      "تونة بالزيت",
      "تونه بالزيت",
      "علبة تونة بالزيت",
      "علبه تونه بالزيت",
      "tuna in oil",
      "canned tuna in oil",
    ],
  },
  {
    id: "curated-diet-pepsi",
    name_ar: "بيبسي دايت",
    name_en: "Diet Pepsi",
    category: "beverage",
    unit_type: "ml",
    item_type: "countable",
    state: "ready_to_eat",
    per_100g: { calories: 0, protein_g: 0.0, carbs_g: 0.0, fat_g: 0.0 },
    default_portion_g: 330,
    reference_unit_g: 330,
    cal_range: [0, 2],
    protein_range: [0, 0],
    uncertainty_level: "low",
    verification_notes: "330ml can zero calorie soda",
    aliases: [
      "بيبسي دايت",
      "ببسي دايت",
      "دايت بيبسي",
      "diet pepsi",
      "pepsi diet",
      "بيبسي زيرو",
      "كولا دايت",
      "كولا زيرو",
      "diet cola",
      "coca cola zero",
    ],
  },
  {
    id: "curated-oats",
    name_ar: "شوفان (خام / حبوب كاملة)",
    name_en: "Rolled Oats",
    category: "rice_grain",
    state: "raw",
    item_type: "countable",
    per_100g: { calories: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5 },
    default_portion_g: 40,
    reference_unit_g: 40,
    cal_range: [365, 390],
    protein_range: [12.0, 14.5],
    uncertainty_level: "low",
    verification_notes: "USDA FoodData Central rolled oats",
    aliases: ["شوفان", "حبوب شوفان", "شوفان كويكر", "oats", "rolled oats", "oatmeal"],
  },
  {
    id: "curated-milk-full",
    name_ar: "حليب طازج كامل الدسم",
    name_en: "Whole Milk",
    category: "dairy_egg",
    unit_type: "ml",
    state: "ready_to_eat",
    item_type: "plated",
    per_100g: { calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [58, 65],
    protein_range: [3.0, 3.5],
    uncertainty_level: "low",
    verification_notes: "USDA / SFDA whole cow milk",
    aliases: ["حليب", "حليب كامل الدسم", "كوب حليب", "حليب طازج", "milk", "whole milk"],
  },
  {
    id: "curated-whey-protein",
    name_ar: "واي بروتين (مسحوق بروتين)",
    name_en: "Whey Protein Isolate / Powder",
    category: "other",
    state: "ready_to_eat",
    item_type: "countable",
    per_100g: { calories: 400, protein_g: 90.0, carbs_g: 3.3, fat_g: 3.3 },
    default_portion_g: 30,
    reference_unit_g: 30,
    cal_range: [370, 415],
    protein_range: [80.0, 92.0],
    uncertainty_level: "low",
    verification_notes: "Standard 30g scoop = 27g protein",
    aliases: [
      "واي بروتين",
      "بروتين",
      "سكوب بروتين",
      "سكوبين بروتين",
      "بودرة بروتين",
      "whey protein",
      "protein scoop",
      "protein shake",
    ],
  },

  // Breads & Pastries
  {
    id: "curated-tamees-plain",
    name_ar: "خبز تميس عادي",
    name_en: "Plain Tamees Bread",
    category: "bread_pastry",
    state: "ready_to_eat",
    item_type: "plated",
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
    item_type: "plated",
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
    item_type: "plated",
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
    item_type: "countable",
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
    item_type: "countable",
    per_100g: { calories: 275, protein_g: 8.3, carbs_g: 55, fat_g: 1.7 },
    default_portion_g: 60,
    reference_unit_g: 60,
    cal_range: [260, 290],
    protein_range: [7.5, 9],
    uncertainty_level: "low",
    verification_notes: "SFDA / Saudi MOH nutrition tables",
    aliases: ["خبز مفرود", "خبز عربي", "عيش مفرود", "خبز ابيض", "pita"],
  },

  // Cooked Rice & Grains (Staples)
  {
    id: "curated-kabsa-rice",
    name_ar: "أرز كبسة / مضغوط (مطبوخ بدون اللحم)",
    name_en: "Cooked Kabsa / Madghoot Rice",
    category: "rice_grain",
    state: "cooked",
    item_type: "plated",
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
    item_type: "plated",
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
    item_type: "plated",
    per_100g: { calories: 165, protein_g: 3, carbs_g: 31, fat_g: 3.2 },
    default_portion_g: 250,
    reference_unit_g: 250,
    cal_range: [145, 185],
    protein_range: [2.5, 3.5],
    uncertainty_level: "medium",
    verification_notes: "USDA / SFDA",
    aliases: ["رز بخاري", "رز مندي", "أرز بخاري", "أرز مندي", "ارز بخاري", "صحن رز بخاري"],
  },

  // Cooked Poultry & Meats (Edible Meat Only, Boneless)
  {
    id: "curated-lamb-cooked",
    name_ar: "لحم غنم / حاشي مطبوخ (صافي بدون عظم)",
    name_en: "Cooked Lamb / Camel Meat (Boneless)",
    category: "meat_poultry",
    state: "cooked",
    item_type: "plated",
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
    item_type: "plated",
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
    item_type: "plated",
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
    item_type: "countable",
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
    item_type: "countable",
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
    item_type: "countable",
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
    item_type: "countable",
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
    item_type: "countable",
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

/**
 * Curated Saudi Traditional & Everyday Foods in-memory database.
 * Pinned unadulterated staples are placed FIRST so basic foods (e.g. "بيض مسلوق", "خبز بر",
 * "صدور دجاج") never fall through to composite SFCT dishes (like "بلاليط بالبيض").
 */
export const CURATED_SAUDI_FOODS: CuratedFoodEntry[] = [
  ...STAPLE_SAUDI_FOODS,
  ...SFCT_SAUDI_FOODS,
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
    per_100g: normalizeMacroNutrients(p),
    category: row.category as FoodCategory | undefined,
    unit_type: (row.unit_type as "g" | "ml" | undefined) || (row.category === "beverage" ? "ml" : "g"),
    item_type: row.item_type as "countable" | "plated" | undefined,
    default_portion_g: defPortion,
    reference_unit_g: refUnit,
    uncertainty_level: (row.uncertainty_level as "low" | "medium" | "high") || "medium",
    verification_notes: row.verification_notes ? String(row.verification_notes) : undefined,
  };
}

export function curatedToFood(entry: CuratedFoodEntry): FoodNutrition {
  return {
    id: entry.id,
    name_ar: entry.name_ar,
    name_en: entry.name_en,
    source: "db",
    per_100g: normalizeMacroNutrients(entry.per_100g),
    category: entry.category,
    unit_type: entry.unit_type || (entry.category === "beverage" ? "ml" : "g"),
    item_type: entry.item_type,
    default_portion_g: entry.default_portion_g,
    reference_unit_g: entry.reference_unit_g,
    uncertainty_level: entry.uncertainty_level,
    verification_notes: entry.verification_notes,
  };
}

/** Strip characters that break ilike patterns or PostgREST or() syntax. */
const clean = (s: string) => s.replace(/[%_,(){}"\\*:]/g, " ").replace(/\s+/g, " ").trim();

const aliasesOf = (row: Row): string[] =>
  Array.isArray(row.aliases) ? (row.aliases as unknown[]).map(String) : [];

/**
 * Generic descriptor words (cooking method / state / filler). Matching on these alone
 * pulls in unrelated foods (e.g. "مطبوخ" matching cooked lamb for a rice item).
 */
const GENERIC_WORDS = new Set(
  [
    "مطبوخ", "مسلوق", "مشوي", "مقلي", "مطبوخه", "مسلوقه", "مشويه", "مقليه",
    "عادي", "عاديه", "صافي", "بدون", "اللحم", "المأكول", "الماكول", "العظم",
    "طازج", "كامل", "الدسم", "محمر", "مبهر", "ساده", "سادة",
    "cooked", "boiled", "fried", "grilled", "baked", "raw", "fresh", "plain", "with", "without",
    "and", "the", "ready", "eat", "edible", "boneless", "meat", "regular",
  ].map((w) => normalizeArabic(w).toLowerCase()),
);

/**
 * Primary dish/ingredient nouns that MUST NOT appear in a candidate if they are absent
 * from the query (e.g. prevents "بيض" or "بيض مسلوق" from matching "بلاليط بالبيض").
 */
const CONFLICTING_DISH_NOUNS = [
  "بلاليط",
  "شعيريه",
  "مطبق",
  "معصوب",
  "عريكه",
  "مرقوق",
  "جريش",
  "قرصان",
  "سليق",
  "فته",
  "فطيره",
  "كيك",
  "كنافه",
  "بسبوسه",
  "سمبوسه",
  "شاورما",
  "برجر",
  "بيتزا",
  "مكرونه",
  "باستا",
  "شكشوكه",
  "كليجا",
  "لقيمات",
  "حنيني",
  "عصيده",
  "مصابيب",
  "مراصيع",
  "ثريد",
  "هريس",
  "مفطح",
  "كشري",
  "بليله",
  "بصاره",
  "شوفان",
  "حليب",
  "عدس",
  "فول",
].map((w) => normalizeArabic(w).toLowerCase());

/** Extract distinctive non-generic tokens (length >= 2) from a normalized string */
function getDistinctiveTokens(normStr: string): string[] {
  return normStr
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^ال/, "").trim())
    .filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
}

/** Check if candidate introduces any conflicting dish noun not present in the query */
function hasConflictingNoun(queryNorm: string, candidateNorm: string): boolean {
  for (const noun of CONFLICTING_DISH_NOUNS) {
    if (candidateNorm.includes(noun) && !queryNorm.includes(noun)) {
      return true;
    }
  }
  return false;
}

/**
 * 4-Tier Strict Search Ranking:
 * 1. Exact normalized match on primary name (`name_ar` / `name_en`) -> 100
 * 2. Exact normalized match in `aliases` -> 95
 * 3. Full phrase containment (ONLY if candidate doesn't add conflicting food nouns) -> 75
 * 4. All distinctive tokens match (ONLY if candidate doesn't add conflicting nouns or unrelated primary tokens) -> 60
 * Never match on a single shared token if the candidate has other primary ingredient tokens!
 */
function scoreCandidateStrict(
  primaryNames: string[],
  aliases: string[],
  rawQuery: string,
): number {
  const cleanedQuery = cleanFoodNameForMatching(rawQuery) || rawQuery;
  const qNorm = normalizeArabic(clean(cleanedQuery)).toLowerCase();
  const qRawNorm = normalizeArabic(clean(rawQuery)).toLowerCase();
  if (!qNorm || qNorm.length < 2) return 0;

  const normPrimary = primaryNames
    .map((n) => normalizeArabic(clean(n)).toLowerCase())
    .filter(Boolean);
  const normAliases = aliases
    .map((n) => normalizeArabic(clean(n)).toLowerCase())
    .filter(Boolean);
  const allNames = [...normPrimary, ...normAliases];

  // Tier 1: Exact normalized match on primary name
  if (normPrimary.some((n) => n === qNorm || n === qRawNorm)) {
    return 100;
  }

  // Tier 2: Exact normalized match in aliases
  if (normAliases.some((n) => n === qNorm || n === qRawNorm)) {
    return 95;
  }

  // Also check primary name with parenthetical clarifications stripped
  const strippedPrimary = normPrimary.map((n) =>
    n.replace(/\s*\([^)]*\)/g, "").replace(/\s*\/.*$/, "").trim(),
  );
  if (strippedPrimary.some((n) => n === qNorm || n === qRawNorm)) {
    return 92;
  }

  // Tier 3: Full phrase containment (ONLY if candidate has no conflicting dish nouns)
  for (const cand of allNames) {
    if (hasConflictingNoun(qNorm, cand)) continue;
    if (cand.includes(qNorm) || (cand.length >= 4 && qNorm.includes(cand))) {
      // Ensure all distinctive query tokens are in the candidate
      const qTokens = getDistinctiveTokens(qNorm);
      const cTokens = getDistinctiveTokens(cand);
      if (qTokens.length > 0 && qTokens.every((qt) => cand.includes(qt))) {
        // Reject if query is a single token (e.g. "بيض") and candidate has multiple unrelated tokens (e.g. "بلاليط بالبيض")
        if (qTokens.length === 1 && cTokens.length > 2) {
          continue;
        }
        return 75 - Math.min(cand.length, 40) / 10;
      }
    }
  }

  // Tier 4: All distinctive tokens match (never match on a single shared token if candidate has other primary tokens)
  const qTokens = getDistinctiveTokens(qNorm);
  if (qTokens.length === 0) return 0;

  for (const cand of allNames) {
    if (hasConflictingNoun(qNorm, cand)) continue;
    const cTokens = getDistinctiveTokens(cand);
    if (cTokens.length === 0) continue;

    const allQueryTokensPresent = qTokens.every((qt) =>
      cTokens.some((ct) => ct === qt || ct.includes(qt) || qt.includes(ct)),
    );
    if (!allQueryTokensPresent) continue;

    // Never match on a single token if candidate has other primary ingredient tokens
    if (qTokens.length === 1 && cTokens.length > 1) {
      continue;
    }

    // Extra tokens in candidate must be at most 1
    if (cTokens.length - qTokens.length <= 1) {
      return 60 - (cTokens.length - qTokens.length) * 5;
    }
  }

  return 0;
}

/**
 * Normalize query by stripping container, size, and cooking state words.
 */
export function normalizeQuery(q: string): string {
  return (q ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/(?<![A-Za-z0-9\u0600-\u06FF])(?:\d+(?:\.\d+)?\s*)?(?:علبه|علبة|علب|صحن|كوب|حبه|حبة|حبات|حبتين|رغيف|رغيفين|قطعه|قطعة|قطع|قطعتين|شريحه|شريحة|شرائح)(?![A-Za-z0-9\u0600-\u06FF])/gi, " ")
    .replace(/(?<![A-Za-z0-9\u0600-\u06FF])(?:اكلت|شربت|تناولت|اخذت)(?![A-Za-z0-9\u0600-\u06FF])/gi, " ")
    .replace(/(?<![A-Za-z0-9\u0600-\u06FF])(?:صغير|صغيره|صغيرة|كبير|كبيره|كبيرة|وسط|متوسط|متوسطه|متوسطة)(?![A-Za-z0-9\u0600-\u06FF])/gi, " ")
    .replace(/(?<![A-Za-z0-9\u0600-\u06FF])(?:معلب|معلبه|معلبة|طازج|طازجه|طازجة|صافي|صافيه|صافية)(?![A-Za-z0-9\u0600-\u06FF])/gi, " ")
    .replace(/(?<![A-Za-z0-9\u0600-\u06FF])(?:واحد|واحده|واحدة|اثنين|اثنان|ثلاث|ثلاثه|ثلاثة|اربع|اربعه|اربعة|خمس|خمسه|خمسة)(?![A-Za-z0-9\u0600-\u06FF])/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const BRAND_KEYWORDS = /(?<![A-Za-z0-9\u0600-\u06FF])(?:المراعي|نادك|الصافي|بلدنا|كويكر|أوبتيموم|بروتين بار|نستله|لونا|أبو قوس|ابو قوس|almarai|nadec|optimum|quest|protein bar|nestle)(?![A-Za-z0-9\u0600-\u06FF])/i;

/**
 * Step 1 Priority Check: Check pinned unadulterated staples (`STAPLE_SAUDI_FOODS`)
 * for EXACT match only (full phrase or exact alias after normalizeQuery).
 * Bypassed when query contains a brand keyword or OCR label card.
 */
export function matchPinnedStaple(queryAr?: string, queryEn?: string): FoodNutrition | null {
  const queries = [queryAr, queryEn].filter((q): q is string => Boolean(q && q.trim()));
  if (queries.length === 0) return null;

  for (const q of queries) {
    if (BRAND_KEYWORDS.test(q)) {
      return null; // Bypasses pinned staples for branded / packaged products
    }

    const qNorm = normalizeQuery(q);
    const qClean = normalizeArabic(clean(q)).toLowerCase();
    if (!qNorm && !qClean) continue;

    for (const entry of STAPLE_SAUDI_FOODS) {
      const primaryAr = normalizeArabic(entry.name_ar).toLowerCase();
      const primaryEn = entry.name_en.toLowerCase();
      const primaryArStripped = primaryAr.replace(/\s*\([^)]*\)/g, "").replace(/\s*\/.*$/, "").trim();
      const aliases = entry.aliases.map((a) => normalizeArabic(a).toLowerCase());

      const isExactMatch =
        primaryAr === qNorm ||
        primaryAr === qClean ||
        primaryArStripped === qNorm ||
        primaryArStripped === qClean ||
        primaryEn === qNorm ||
        primaryEn === qClean ||
        aliases.includes(qNorm) ||
        aliases.includes(qClean);

      if (isExactMatch) {
        const candidate = curatedToFood(entry);
        if (passesMacroSanityGuard(q, candidate.per_100g, candidate.category)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

/** Search in-memory curated dataset when Supabase query is empty or offline */
export function searchCuratedFallback(term: string): FoodNutrition | null {
  const cleanedTerm = cleanFoodNameForMatching(term) || term;
  const norm = normalizeArabic(clean(cleanedTerm)).toLowerCase();
  if (!norm || norm.length < 2) return null;

  // 1. Check pinned staples first
  const pinned = matchPinnedStaple(term);
  if (pinned) return pinned;

  // 2. Strict 4-tier search across CURATED_SAUDI_FOODS + Macro Sanity Guard
  let bestEntry: CuratedFoodEntry | null = null;
  let bestScore = 0;

  for (const entry of CURATED_SAUDI_FOODS) {
    const currentScore = scoreCandidateStrict(
      [entry.name_ar, entry.name_en],
      entry.aliases,
      term,
    );
    if (currentScore > bestScore) {
      if (passesMacroSanityGuard(term, entry.per_100g, entry.category)) {
        bestScore = currentScore;
        bestEntry = entry;
      }
    }
  }

  if (bestEntry && bestScore >= 55) {
    return curatedToFood(bestEntry);
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

/** Score a Supabase row against the search term using 4-Tier Strict Ranking. */
function score(row: Row, rawTerm: string): number {
  return scoreCandidateStrict(
    [String(row.name_ar ?? ""), String(row.name_en ?? "")],
    aliasesOf(row),
    rawTerm,
  );
}

/** Build a food from the AI's own per-100g estimate (used strictly when no match in DB). */
function foodFromAi(
  item: Pick<ParsedItem, "name_ar" | "name_en" | "category" | "ai_fallback_per_100g" | "ai_estimated_per_100g">,
): FoodNutrition | null {
  const e = item.ai_fallback_per_100g || item.ai_estimated_per_100g;
  if (!e) return null;
  const per_100g = normalizeMacroNutrients(e);
  return {
    id: `ai-${item.name_en}`,
    name_ar: item.name_ar,
    name_en: item.name_en,
    source: "ai",
    category: item.category,
    unit_type: item.category === "beverage" ? "ml" : "g",
    per_100g,
  };
}

/**
 * Guard against mismatched foods: reject a DB/curated match whose per-100g macros
 * contradict the AI's own estimate for the same item by a large margin.
 */
function isConsistentWithAi(
  food: FoodNutrition,
  item: Pick<ParsedItem, "ai_fallback_per_100g" | "ai_estimated_per_100g">,
): boolean {
  const e = item.ai_estimated_per_100g || item.ai_fallback_per_100g;
  if (!e) return true;
  const ai = normalizeMacroNutrients(e);
  if (ai.protein_g + ai.carbs_g + ai.fat_g === 0) return true;
  const m = food.per_100g;
  return (
    Math.abs(m.protein_g - ai.protein_g) <= 12 &&
    Math.abs(m.carbs_g - ai.carbs_g) <= 25 &&
    Math.abs(m.fat_g - ai.fat_g) <= 20
  );
}

/**
 * Find the best food for an item:
 * 1. Checks for OCR label products in Supabase first (source = 'label_ocr')
 * 2. Check pinned unadulterated core staples (`STAPLE_SAUDI_FOODS`) with exact matching
 * 3. Supabase foods table with 4-tier strict ranking + hard macro sanity guard
 * 4. In-memory curated Saudi foods dataset with 4-tier strict ranking + hard macro sanity guard
 * 5. Fall back to AI bounded per-100g estimate (source "ai")
 */
export async function findFood(
  item: Pick<
    ParsedItem,
    "name_ar" | "name_en" | "category" | "ai_fallback_per_100g" | "ai_estimated_per_100g"
  >,
): Promise<FoodNutrition | null> {
  const queryLabel = `${item.name_ar ?? ""} ${item.name_en ?? ""}`.trim();

  const fullTerms = [
    cleanFoodNameForMatching(item.name_ar ?? ""),
    cleanFoodNameForMatching(item.name_en ?? ""),
    normalizeQuery(item.name_ar ?? ""),
    clean(item.name_ar ?? ""),
    clean(item.name_en ?? ""),
  ].filter((s) => s.length >= 2);
  const terms = [...new Set(fullTerms)];

  // 1. Check if an OCR product label exists in Supabase (e.g. user-saved protein powder or branded drink)
  for (const term of terms) {
    const rows = await search(term);
    const ocrRow = rows.find(
      (r) =>
        r.source === "label_ocr" ||
        (r as unknown as { quality?: string }).quality === "label_ocr",
    );
    if (ocrRow) {
      const food = toFood(ocrRow);
      if (
        passesMacroSanityGuard(queryLabel, food.per_100g, food.category ?? item.category) &&
        isConsistentWithAi(food, item)
      ) {
        return food;
      }
    }
  }

  // 2. Pinned Core Staples (exact match for boiled egg, brown bread, chicken breast, tuna, diet pepsi, etc.)
  const pinnedStaple = matchPinnedStaple(item.name_ar, item.name_en);
  if (pinnedStaple) {
    return pinnedStaple;
  }

  // 3. Try Supabase foods lookup
  for (const term of terms) {
    const rows = await search(term);
    if (rows.length > 0) {
      const ranked = [...rows]
        .map((r) => ({ row: r, s: score(r, term) }))
        .filter((x) => x.s >= 55)
        .sort((a, b) => b.s - a.s);

      for (const { row } of ranked) {
        const food = toFood(row);
        if (
          passesMacroSanityGuard(queryLabel, food.per_100g, food.category ?? item.category) &&
          isConsistentWithAi(food, item)
        ) {
          return food;
        }
      }
    }
  }

  // 4. Try in-memory Curated Saudi foods
  for (const term of terms) {
    const curated = searchCuratedFallback(term);
    if (
      curated &&
      passesMacroSanityGuard(queryLabel, curated.per_100g, curated.category ?? item.category) &&
      isConsistentWithAi(curated, item)
    ) {
      return curated;
    }
  }

  // 5. AI estimate fallback strictly if DB and curated match failed
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
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  state?: FoodState;
  source?: MacroSource;
  confidence?: "high" | "medium" | "low";
  portion_assumed?: boolean;
  default_portion_g?: number | null;
  reference_unit_g?: number | null;
}): MealItem {
  const name_ar = params.parsedName?.ar || params.food?.name_ar || params.food?.name_en || "صنف";
  const name_en = params.parsedName?.en || params.food?.name_en || params.food?.name_ar || "item";
  const per_100g = params.food?.per_100g ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const source: MacroSource =
    params.source || (params.food?.source === "db" ? "db_match" : "ai_estimate");

  const category = params.category || params.food?.category;
  const default_portion_g =
    params.default_portion_g ?? params.food?.default_portion_g ?? null;
  const reference_unit_g =
    params.reference_unit_g ?? params.food?.reference_unit_g ?? null;
  const unit_type =
    params.unit_type || params.food?.unit_type || (category === "beverage" ? "ml" : "g");
  const item_type = params.item_type || params.food?.item_type;

  // If portion was assumed and grams were <= 0, use default_portion_g
  let initialGrams = Number(params.grams) || 0;
  if (params.portion_assumed && initialGrams <= 0 && default_portion_g) {
    initialGrams = default_portion_g;
  }
  const safeGrams = Math.max(0, Math.min(5000, initialGrams));

  const isUnspecifiedTuna =
    params.food?.id === "curated-tuna-water" &&
    !/ماء|زيت|water|oil/i.test(`${params.parsedName?.ar ?? ""} ${params.parsedName?.en ?? ""}`);

  const rawItem: MealItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    canonical_name: name_en,
    display_name_ar: name_ar,
    grams: safeGrams,
    unit_type,
    item_type,
    size_modifier: params.size_modifier,
    state: params.state || params.food?.category === "meat_poultry" ? "cooked" : "ready_to_eat",
    category,
    per_100g: normalizeMacroNutrients(per_100g),
    source,
    food_id: params.food && params.food.source === "db" ? params.food.id : null,
    confidence: params.confidence || "medium",
    portion_assumed: isUnspecifiedTuna ? true : (params.portion_assumed ?? false),
    default_portion_g,
    default_full_loaf_or_unit_g: reference_unit_g,
    reference_unit_g,
    plausibility_warning: null,
  };

  return applyPlausibilityChecks(rawItem);
}
