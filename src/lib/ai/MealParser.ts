import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import type { MealDraft } from "./types";

const MODEL_NAME = "gemini-3.5-flash-lite";
const SCHEMA_VERSION = "1.0";

const SYSTEM_INSTRUCTION = `You are MealParser, the food-recognition engine of a nutrition tracking app.

ABSOLUTE RULES:
1. NEVER output calories, kcal, protein, carbohydrates, fat, fiber, sugar, or any other nutrient/macronutrient value anywhere in your output, including warnings and questions, EXCEPT inside each item's ai_estimated_per_100g object (see NUTRITION ESTIMATE RULES). Your main job is to identify foods, their cooking state, and estimate weight ranges in grams.
2. DECOMPOSE mixed meals into base ingredients (e.g. Kabsa => cooked basmati rice + cooked chicken; do not return a single "Kabsa" item). Put the overall dish label in dish_name.
3. Output ONLY a JSON object that conforms to the provided schema. No markdown, no code fences, no commentary.

CONTEXT:
- Users are mostly in Saudi Arabia and the Gulf. Expect dishes such as Kabsa, Mandi, Mathbi, Madfoon, Jareesh, Saleeg, Harees, Mutabbaq, Kebdah, Shawarma, Foul, Falafel, Hummus, Samboosa, Fattah, Aseedah, dates and Arabic coffee. Understand Gulf/Saudi Arabic dialect (e.g. "نص حبة دجاج" = half a whole chicken, "صحن رز" = a plate of rice, "بيبسي دايت" = Diet Pepsi, zero-sugar drink).
- Provide both name_en and name_ar for every food. Set "language" to the language the user used.

QUANTITY RULES:
- Estimate each item's edible weight as a range in grams (grams_min <= grams_max). Never use a single exact guess when unsure; widen the range.
- quantity.basis: "user_stated" if the user gave the amount (convert units/portions to grams sensibly, excluding bones/inedible parts when reasonable), "visual_guess" if estimated from a photo, "unknown" if it cannot be estimated (use 0 and 0 and ask a clarifying question).
- cooking_state must be raw, cooked, dry, or unknown. Rice, meat and pasta are usually "cooked" in prepared meals.
- Zero-calorie drinks (e.g. diet sodas, water) are still listed as items with a volume-based gram estimate (1 ml ~ 1 g).

NUTRITION ESTIMATE RULES:
- For EVERY item, ALWAYS fill ai_estimated_per_100g with kcal, protein_g, carbs_g and fat_g per 100 g of the food AS DESCRIBED (respect cooking_state: cooked rice differs from dry rice), using your general nutrition knowledge (e.g. USDA / standard food-composition tables).
- Be as accurate as possible even for common foods; never leave values as 0 unless the food truly has none (e.g. diet soda, water). Do not guess wildly: use typical values for the specific preparation (grilled, fried, etc.).
- These numbers are ONLY allowed inside ai_estimated_per_100g. Never mention nutrients in warnings, questions, or any other field.

HIDDEN ITEMS:
- ALWAYS consider and flag hidden items in possible_hidden_items: cooking oil, ghee/samn, butter, sauces (tomato, daqoos, tahini, mayo, garlic sauce), added sugar, fried onions, nuts/raisins in rice. Give a short reason for each.
- Only list an item in "items" with visible=true if it is seen or stated; use visible=false for inferred ingredients.

CONFIDENCE & CLARIFICATION:
- Set confidence per item (high/medium/low). Use needs_user_confirmation (list of field names such as "quantity", "cooking_state", "name") when the user should confirm.
- Add clarifying_questions (field, question_en, question_ar) for important ambiguities, and set needs_clarification true if any exist or any item has low confidence.
- Use global_warnings for meal-level issues (e.g. blurry photo, unclear portion size). Empty arrays are allowed.
- If the input is not food, return an empty items array, a global warning, and needs_clarification true.
- schema_version must be "${SCHEMA_VERSION}".`;

const stringArray = {
  type: SchemaType.ARRAY,
  items: { type: SchemaType.STRING },
} as const;

const MEAL_DRAFT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    schema_version: { type: SchemaType.STRING },
    input_type: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["photo", "text"],
    },
    language: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["ar", "en"],
    },
    dish_name: {
      type: SchemaType.OBJECT,
      properties: {
        en: { type: SchemaType.STRING },
        ar: { type: SchemaType.STRING },
      },
      required: ["en", "ar"],
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name_en: { type: SchemaType.STRING },
          name_ar: { type: SchemaType.STRING },
          cooking_state: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["raw", "cooked", "dry", "unknown"],
          },
          confidence: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["high", "medium", "low"],
          },
          visible: { type: SchemaType.BOOLEAN },
          quantity: {
            type: SchemaType.OBJECT,
            properties: {
              grams_min: { type: SchemaType.NUMBER },
              grams_max: { type: SchemaType.NUMBER },
              basis: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ["user_stated", "visual_guess", "unknown"],
              },
            },
            required: ["grams_min", "grams_max", "basis"],
          },
          ai_estimated_per_100g: {
            type: SchemaType.OBJECT,
            properties: {
              kcal: { type: SchemaType.NUMBER },
              protein_g: { type: SchemaType.NUMBER },
              carbs_g: { type: SchemaType.NUMBER },
              fat_g: { type: SchemaType.NUMBER },
            },
            required: ["kcal", "protein_g", "carbs_g", "fat_g"],
          },
          needs_user_confirmation: stringArray,
          warnings: stringArray,
        },
        required: [
          "name_en",
          "name_ar",
          "cooking_state",
          "confidence",
          "visible",
          "quantity",
          "ai_estimated_per_100g",
          "needs_user_confirmation",
          "warnings",
        ],
      },
    },
    possible_hidden_items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name_en: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
        },
        required: ["name_en", "reason"],
      },
    },
    global_warnings: stringArray,
    clarifying_questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field: { type: SchemaType.STRING },
          question_en: { type: SchemaType.STRING },
          question_ar: { type: SchemaType.STRING },
        },
        required: ["field", "question_en", "question_ar"],
      },
    },
    needs_clarification: { type: SchemaType.BOOLEAN },
  },
  required: [
    "schema_version",
    "input_type",
    "language",
    "dish_name",
    "items",
    "possible_hidden_items",
    "global_warnings",
    "clarifying_questions",
    "needs_clarification",
  ],
};

export class MealParser {
  private static getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: MEAL_DRAFT_SCHEMA,
        temperature: 0.2,
      },
    });
  }

  private static parseResponse(raw: string, inputType: "photo" | "text"): MealDraft {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("MealParser: model returned invalid JSON.");
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as MealDraft).items)
    ) {
      throw new Error("MealParser: model response does not match MealDraft schema.");
    }
    const draft = parsed as MealDraft;
    // Input type is known by the caller; don't trust the model for it.
    draft.input_type = inputType;
    return draft;
  }

  static async parseText(text: string): Promise<MealDraft> {
    if (!text.trim()) {
      throw new Error("MealParser: text input is empty.");
    }
    const result = await MealParser.getModel().generateContent([
      { text: `Input type: text\nMeal description:\n${text}` },
    ]);
    return MealParser.parseResponse(result.response.text(), "text");
  }

  static async parseImage(base64Image: string, mimeType: string): Promise<MealDraft> {
    if (!base64Image) {
      throw new Error("MealParser: image data is empty.");
    }
    // Strip a data-URL prefix if present.
    const data = base64Image.replace(/^data:[^;]+;base64,/, "");
    const result = await MealParser.getModel().generateContent([
      { text: "Input type: photo\nIdentify the foods in this meal photo." },
      { inlineData: { data, mimeType } },
    ]);
    return MealParser.parseResponse(result.response.text(), "photo");
  }
}
