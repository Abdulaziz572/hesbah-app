import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import type {
  MealDraft,
  MealInput,
  MealInputType,
  MediaPayload,
  ReparsedSingleItem,
  SingleItemInput,
} from "./types";

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

AUDIO INPUT (voice recordings):
- The user may attach an audio recording of themselves describing a meal. Listen to it carefully and treat it exactly like a typed description.
- Accurately understand Arabic, including Saudi/Gulf/Najdi/Hijazi dialect food terms, colloquial quantities ("نص", "ربع", "حبتين", "صحن", "كاسة", "معلقة", "كفّ") and brand/product names (e.g. Al Baik/البيك, Kudu/كودو, Almarai/المراعي, Pepsi/بيبسي, Nadec, Saudia). Ignore filler words, hesitations and background noise.
- If the audio is silent, unintelligible, or contains no food, return an empty items array, add a global warning (e.g. the recording was unclear) and set needs_clarification to true.

IMAGE INPUT (photos):
- The user may attach a photo (camera, gallery, screenshot or pasted picture). Identify every visible food and drink, including cooked dishes, packaged products and drinks.
- Visually estimate each item's portion in grams from plate/bowl/container proportions, utensils, hands, cups and packaging for scale. Use quantity.basis = "visual_guess" and keep ranges honest (widen them when the angle, lighting or scale is poor).
- Identify cooked dishes and decompose them into base ingredients (see rule 2). Note cooking method when visible (grilled, fried, baked).
- If the photo shows a nutrition facts label or packaged-product label, read the printed values carefully: use the printed serving size/weight for the quantity (basis "user_stated" when the label states it) and copy the printed per-100g (or per-serving converted to per-100g) values into ai_estimated_per_100g for that item. Use the brand/product name on the package.
- If the photo is blurry, dark or does not show food, add a global warning and set needs_clarification to true.

COMBINED INPUT:
- Text, audio and image may be combined. The user's note or speech takes priority over visual guesses when it states a quantity or correction (e.g. "أكلت نص هذا الصحن فقط" = only half of the plate shown; scale your gram estimate of the photographed portion accordingly and use basis "user_stated" when appropriate).

DESCRIPTION FIELD:
- Whenever the input includes audio and/or an image, ALWAYS fill transcribed_or_detected_description_ar with one short, natural Arabic sentence (or two) summarizing what you heard (for voice, a faithful cleaned-up transcription/summary) and/or what you saw (for photos). Never put nutrient values in it. For text-only input you may leave it as an empty string.

CONFIDENCE & CLARIFICATION:
- Set confidence per item (high/medium/low). Use needs_user_confirmation (list of field names such as "quantity", "cooking_state", "name") when the user should confirm.
- Add clarifying_questions (field, question_en, question_ar) for important ambiguities, and set needs_clarification true if any exist or any item has low confidence.
- Use global_warnings for meal-level issues (e.g. blurry photo, unclear portion size, unclear audio). Empty arrays are allowed.
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
      enum: ["photo", "text", "voice", "multimodal"],
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
    transcribed_or_detected_description_ar: { type: SchemaType.STRING },
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

const SINGLE_ITEM_INSTRUCTION = `You are an expert food and nutrition analyzer for an Arabic nutrition tracking application.
You are given a single food item (which may have an existing name, weight, and nutrients) and a correction or description prompt from the user in Arabic (e.g. "لا هذا فخذ دجاج مقلي مو صدور", "مطبوخ مع ملعقة سمن", "خلها 3 حبات سمبوسة لحم بالفرن", or a brand new item description).

RULES:
1. Identify the exact food item and its preparation/cooking state (e.g., grilled, fried, boiled, baked, raw, cooked).
2. Set accurate "name_ar" (clear Arabic food name) and "name_en".
3. Estimate the portion in grams ("grams"):
   - If the user explicitly stated a new quantity (e.g. "3 حبات", "صحن كبير", "150 جرام"), calculate the grams accordingly.
   - If the user only corrected the cooking method or ingredient type without specifying quantity, keep or sensibly adapt the current item's grams.
   - For a new item without quantity specified, use a standard typical serving weight in grams (e.g. 1 apple ~ 150g, 1 cup ~ 240g).
4. Fill "ai_estimated_per_100g" with accurate nutritional values per 100g:
   - "kcal": calories per 100g
   - "protein_g": protein in grams per 100g
   - "carbs_g": carbohydrates in grams per 100g
   - "fat_g": fat in grams per 100g
5. Output ONLY a valid JSON object matching the schema. No markdown, no commentary.`;

const SINGLE_ITEM_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name_ar: { type: SchemaType.STRING },
    name_en: { type: SchemaType.STRING },
    grams: { type: SchemaType.NUMBER },
    cooking_state: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["raw", "cooked", "dry", "unknown"],
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
    notes: { type: SchemaType.STRING },
  },
  required: ["name_ar", "name_en", "grams", "ai_estimated_per_100g"],
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

  private static parseResponse(raw: string, inputType: MealInputType): MealDraft {
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

  /** Strip a data-URL prefix and any whitespace from a base64 string. */
  private static cleanBase64(data: string): string {
    return data.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  }

  /** Gemini wants a bare MIME type: "audio/webm;codecs=opus" -> "audio/webm". */
  private static baseMime(mimeType: string): string {
    return mimeType.split(";")[0].trim().toLowerCase();
  }

  private static mediaPart(media: MediaPayload) {
    return {
      inlineData: {
        data: MealParser.cleanBase64(media.base64),
        mimeType: MealParser.baseMime(media.mimeType),
      },
    };
  }

  /**
   * Unified entry point: any combination of text, voice and image. Media is passed
   * inline to Gemini and never persisted.
   */
  static async parseMealInput(input: MealInput): Promise<MealDraft> {
    const text = input.text?.trim() ?? "";
    const { audio, image } = input;
    if (!text && !audio?.base64 && !image?.base64) {
      throw new Error("MealParser: no input provided (text, audio or image required).");
    }

    const kinds = [text && "text", audio?.base64 && "voice", image?.base64 && "photo"].filter(
      Boolean,
    );
    const inputType: MealInputType =
      kinds.length > 1 ? "multimodal" : ((kinds[0] as MealInputType | undefined) ?? "text");

    const instructions: string[] = [`Input type: ${inputType}`];
    if (audio?.base64) {
      instructions.push(
        "An audio recording of the user describing their meal is attached. Listen to it and extract the foods and quantities.",
      );
    }
    if (image?.base64) {
      instructions.push(
        "A photo related to the meal is attached. Identify the foods and visually estimate portions in grams.",
      );
    }
    if (text) {
      instructions.push(
        `${audio || image ? "Additional note from the user" : "Meal description"}:\n${text}`,
      );
    }

    const parts: Array<{ text: string } | ReturnType<typeof MealParser.mediaPart>> = [
      { text: instructions.join("\n") },
    ];
    if (image?.base64) parts.push(MealParser.mediaPart(image));
    if (audio?.base64) parts.push(MealParser.mediaPart(audio));

    const result = await MealParser.getModel().generateContent(parts);
    return MealParser.parseResponse(result.response.text(), inputType);
  }

  static async parseText(text: string): Promise<MealDraft> {
    if (!text.trim()) {
      throw new Error("MealParser: text input is empty.");
    }
    return MealParser.parseMealInput({ text });
  }

  static async parseImage(base64Image: string, mimeType: string): Promise<MealDraft> {
    if (!base64Image) {
      throw new Error("MealParser: image data is empty.");
    }
    return MealParser.parseMealInput({ image: { base64: base64Image, mimeType } });
  }

  private static getSingleItemModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SINGLE_ITEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SINGLE_ITEM_SCHEMA,
        temperature: 0.2,
      },
    });
  }

  /**
   * Reparse or refine a single food item based on user correction or description.
   * If currentItem is provided, the model adjusts that item; if null/undefined, it parses a new single item.
   */
  static async reparseSingleItem(
    currentItem: SingleItemInput | null | undefined,
    correctionPrompt: string,
  ): Promise<ReparsedSingleItem> {
    const prompt = correctionPrompt.trim();
    if (!prompt) {
      throw new Error("MealParser: correction prompt is empty.");
    }

    const lines: string[] = [];
    if (currentItem && (currentItem.name || currentItem.name_ar || currentItem.name_en)) {
      lines.push("CURRENT FOOD ITEM DATA:");
      lines.push(`- Name: ${currentItem.name_ar || currentItem.name || currentItem.name_en}`);
      if (currentItem.grams) lines.push(`- Current Weight: ${currentItem.grams}g`);
      if (currentItem.calories != null) lines.push(`- Current Calories: ${currentItem.calories} kcal`);
      if (currentItem.per100g) {
        lines.push(
          `- Current Per 100g: ${currentItem.per100g.calories} kcal, ${currentItem.per100g.protein}g protein, ${currentItem.per100g.carbs}g carbs, ${currentItem.per100g.fat}g fat`,
        );
      }
      lines.push("");
      lines.push(`USER CORRECTION NOTE:\n"${prompt}"`);
      lines.push(
        "Apply the user's correction to this item, re-estimating portions and per-100g nutritional facts accordingly.",
      );
    } else {
      lines.push(`NEW FOOD ITEM TO ANALYZE:\n"${prompt}"`);
      lines.push(
        "Extract this single food item, estimate realistic portion in grams, and calculate nutritional values per 100g.",
      );
    }

    const result = await MealParser.getSingleItemModel().generateContent(lines.join("\n"));
    const raw = result.response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("MealParser: model returned invalid JSON for single item.");
    }

    const fallbackGrams = Math.max(1, Math.round(Number(currentItem?.grams) || 100));
    const grams = Math.max(1, Math.min(5000, Math.round(Number(parsed.grams) || fallbackGrams)));

    const est = parsed.ai_estimated_per_100g || {};
    const p100 = {
      calories: Math.max(0, Math.round(Number(est.kcal) || 0)),
      protein: Math.max(0, Math.round((Number(est.protein_g) || 0) * 10) / 10),
      carbs: Math.max(0, Math.round((Number(est.carbs_g) || 0) * 10) / 10),
      fat: Math.max(0, Math.round((Number(est.fat_g) || 0) * 10) / 10),
    };

    const factor = grams / 100;
    const calories = Math.round(p100.calories * factor);
    const protein = Math.round(p100.protein * factor * 10) / 10;
    const carbs = Math.round(p100.carbs * factor * 10) / 10;
    const fat = Math.round(p100.fat * factor * 10) / 10;

    return {
      name_ar: String(parsed.name_ar || currentItem?.name_ar || currentItem?.name || "صنف غذائي"),
      name_en: String(parsed.name_en || currentItem?.name_en || "Food item"),
      grams,
      per100g: p100,
      calories,
      protein,
      carbs,
      fat,
      cooking_state: parsed.cooking_state,
      notes: parsed.notes,
    };
  }
}

