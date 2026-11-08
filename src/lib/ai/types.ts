export type FoodState = "cooked" | "raw" | "ready_to_eat";
export type MacroSource = "db_match" | "label_ocr" | "ai_estimate" | "manual_override";

export type FoodCategory =
  | "bread_pastry"
  | "rice_grain"
  | "traditional_dish"
  | "meat_poultry"
  | "legume"
  | "snack_fastfood"
  | "fruit_dates"
  | "dairy_egg"
  | "beverage"
  | "other";

export interface MacroNutrients {
  calories: number;        // الطاقة (كيلو كالوري)
  protein_g: number;       // البروتين الكلي (غم)
  carbs_g: number;         // الكربوهيدرات المتاحة (غم) -> fallback to الكربوهيدرات الكلية if "-"
  fat_g: number;           // الدهون الكلية (غم)
  // Athlete & Health Micronutrients (Optional for backward compatibility)
  fiber_g?: number;        // الألياف الكلية (غم)
  sugar_g?: number;        // السكريات الكلية (غم)
  added_sugar_g?: number;  // السكريات المضافة (غم)
  saturated_fat_g?: number;// الأحماض الدهنية المشبعة (غم)
  cholesterol_mg?: number; // الكوليسترول (ملغم)
  sodium_mg?: number;      // الصوديوم (ملغم) - Critical for hydration/cutting
  potassium_mg?: number;   // البوتاسيوم (ملغم) - Critical for muscle cramps/electrolytes
  magnesium_mg?: number;   // المغنيسيوم (ملغم) - Critical for recovery
  calcium_mg?: number;     // الكالسيوم (ملغم)
  iron_mg?: number;        // الحديد (ملغم)
  zinc_mg?: number;        // الزنك (ملغم)
}

export interface MealItem {
  id: string;
  canonical_name: string;
  display_name_ar: string;
  grams: number;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  state: FoodState;
  category?: FoodCategory;
  per_100g: MacroNutrients;
  source: MacroSource;
  food_id?: string | null;
  confidence: "high" | "medium" | "low";
  portion_assumed: boolean;
  default_portion_g?: number | null;
  default_full_loaf_or_unit_g?: number | null;
  reference_unit_g?: number | null;
  plausibility_warning?: string | null;
}

export type CookingState = "raw" | "cooked" | "dry" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type QuantityBasis = "user_stated" | "visual_guess" | "unknown";

export interface ParsedItemQuantity {
  grams_min: number;
  grams_max: number;
  basis: QuantityBasis;
}

export interface AiEstimatedPer100g {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ParsedItem {
  name_en: string;
  name_ar: string;
  canonical_name?: string;
  category?: FoodCategory;
  cooking_state: CookingState;
  confidence: Confidence;
  visible: boolean;
  quantity: ParsedItemQuantity;
  size_modifier?: "small" | "medium" | "large" | null;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  extracted_grams?: number | null;
  fraction_of_reference?: number | null;
  portion_assumed?: boolean;
  ai_fallback_per_100g?: AiEstimatedPer100g;
  ai_estimated_per_100g?: AiEstimatedPer100g;
  needs_user_confirmation: string[];
  warnings: string[];
}

export interface HiddenItem {
  name_en: string;
  reason: string;
}

export interface ClarifyingQuestion {
  field: string;
  question_en: string;
  question_ar: string;
}

/** Inline media sent straight to Gemini (never stored). `base64` has no data-URL prefix. */
export interface MediaPayload {
  mimeType: string;
  base64: string;
}

/** Any combination of text, voice and image describing a meal. At least one is required. */
export interface MealInput {
  text?: string;
  audio?: MediaPayload;
  image?: MediaPayload;
}

export type MealInputType = "photo" | "text" | "voice" | "multimodal";

export interface MealDraft {
  schema_version: string;
  input_type: MealInputType;
  language: "ar" | "en";
  dish_name: {
    en: string;
    ar: string;
  };
  items: ParsedItem[];
  possible_hidden_items: HiddenItem[];
  global_warnings: string[];
  clarifying_questions: ClarifyingQuestion[];
  needs_clarification: boolean;
  /** Natural Arabic summary of what the model heard (voice) or saw (image). */
  transcribed_or_detected_description_ar?: string;
}

/** Input passed when asking the AI to refine or correct a single food item. */
export interface SingleItemInput {
  name?: string;
  name_ar?: string;
  name_en?: string;
  category?: FoodCategory;
  grams?: number;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  per_100g?: MacroNutrients;
}

/** Result returned when re-parsing or adding a single food item. */
export interface ReparsedSingleItem {
  name_ar: string;
  name_en: string;
  category?: FoodCategory;
  grams: number;
  unit_type?: "g" | "ml";
  item_type?: "countable" | "plated";
  size_modifier?: "small" | "medium" | "large" | null;
  per_100g: MacroNutrients;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cooking_state?: CookingState;
  default_portion_g?: number | null;
  reference_unit_g?: number | null;
  portion_assumed?: boolean;
  plausibility_warning?: string | null;
  notes?: string;
}
