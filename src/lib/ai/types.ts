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
  cooking_state: CookingState;
  confidence: Confidence;
  visible: boolean;
  quantity: ParsedItemQuantity;
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
  grams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  per100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/** Result returned when re-parsing or adding a single food item. */
export interface ReparsedSingleItem {
  name_ar: string;
  name_en: string;
  grams: number;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cooking_state?: CookingState;
  notes?: string;
}

