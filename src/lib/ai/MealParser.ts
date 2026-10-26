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
  ParsedItem,
  ReparsedSingleItem,
  SingleItemInput,
  FoodCategory,
} from "./types";
import { findFood } from "../foodLookup";
import { applyPlausibilityChecks, calculateItemMacros, createMacroNutrients } from "../nutrition";

const MODEL_NAME = "gemini-3.5-flash-lite";
const SCHEMA_VERSION = "2.0";

const SYSTEM_INSTRUCTION = `You are MealParser, the extraction-only food recognition engine of a Saudi nutrition tracking app.

STRICT ROLE & BOUNDARIES:
1. EXTRACTION ONLY: You are strictly an ENTITY AND PORTION EXTRACTOR. NEVER compute total dish or meal calories or scaled macros. All final calculations are performed deterministically in application code.
2. COMPOSITE DISH DECOMPOSITION (Mandatory for Saudi dishes):
   When a user mentions a composite dish (e.g. "كبسة دجاج", "مندي لحم", "سليق بالدجاج", "مضغوط دجاج", "كبسة حاشي"), you MUST ALWAYS split it into TWO separate items in the items array:
   - Item 1 (Carbohydrate base): e.g. "أرز كبسة / مضغوط (مطبوخ بدون اللحم)" (category: "rice_grain", cooking_state: "cooked", default 250g).
   - Item 2 (Cooked protein portion): e.g. "دجاج شواية / مضغوط / مندي / كبسة (صافي اللحم المأكول بدون العظم)" (category: "meat_poultry", cooking_state: "cooked", default 115g boneless edible meat for quarter chicken = 0.25 fraction, 230g for half chicken = 0.5 fraction, or 100g for lamb/camel).
   NEVER return a single composite dish item like "كبسة دجاج" or "مندي دجاج"! Put the overarching name in dish_name.
3. ENTITY & PORTION DETAILS:
   - Provide "name_ar" (clear Arabic food name) and "name_en".
   - Set "category": bread_pastry, rice_grain, traditional_dish, meat_poultry, legume, snack_fastfood, fruit_dates, dairy_egg, beverage, other.
   - Set "cooking_state": default to "cooked" or "ready_to_eat" for prepared meals (unless raw was stated).
   - If user stated grams or count, put in "extracted_grams".
   - If user specified a portion fraction of a whole unit (e.g. "ربع تميس" or "ربع دجاجة" -> 0.25, "نص" -> 0.5, "كامل / حبة" -> 1.0), set "fraction_of_reference".
   - Set "portion_assumed": true whenever the user did not specify an exact weight, count, or fraction (e.g. "أكلت تميس", "أكلت صحن كبسة"). Set false when stated.
4. AI FALLBACK NUTRITION (Strictly per 100g cooked/ready-to-eat):
   - Fill "ai_fallback_per_100g" (and "ai_estimated_per_100g") with kcal, protein_g, carbs_g, fat_g per 100g as described.
   - Adhere to realistic biological limits (bread has ~8-11g protein/100g, cooked rice has ~2.5-3g protein/100g, dates have ~2g protein/100g). NEVER estimate 30g+ protein for breads!
5. OUTPUT:
   - Output ONLY a JSON object conforming to the schema. No markdown fences, no conversational commentary.

CONTEXT:
- Saudi/Gulf dialect: "نص حبة دجاج" = half whole chicken (edible cooked meat ~230g), "ربع دجاجة" = quarter chicken (~115g edible), "صحن رز" = plate of rice (~250g), "تميس" = tamees flatbread (default portion ~90g quarter loaf, whole loaf ~360g), "صامولي" = roll (~60g), "حبتين سمبوسة" = 2 sambusas (~80g), "3 تمرات" = 3 dates (~30g).
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
          canonical_name: { type: SchemaType.STRING },
          category: {
            type: SchemaType.STRING,
            format: "enum",
            enum: [
              "bread_pastry",
              "rice_grain",
              "traditional_dish",
              "meat_poultry",
              "legume",
              "snack_fastfood",
              "fruit_dates",
              "dairy_egg",
              "beverage",
              "other",
            ],
          },
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
          extracted_grams: { type: SchemaType.NUMBER },
          fraction_of_reference: { type: SchemaType.NUMBER },
          portion_assumed: { type: SchemaType.BOOLEAN },
          ai_fallback_per_100g: {
            type: SchemaType.OBJECT,
            properties: {
              kcal: { type: SchemaType.NUMBER },
              protein_g: { type: SchemaType.NUMBER },
              carbs_g: { type: SchemaType.NUMBER },
              fat_g: { type: SchemaType.NUMBER },
            },
            required: ["kcal", "protein_g", "carbs_g", "fat_g"],
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
          "portion_assumed",
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

const SINGLE_ITEM_INSTRUCTION = `You are an expert food extractor for an Arabic nutrition tracking application.
You are given a single food item description or correction in Arabic.

RULES:
1. Identify the food item: set clear "name_ar", "name_en", and "category" (bread_pastry, rice_grain, traditional_dish, meat_poultry, legume, snack_fastfood, fruit_dates, dairy_egg, beverage, other).
2. Set "cooking_state" (cooked, raw, ready_to_eat, dry).
3. Estimate realistic portion in grams ("grams"):
   - If user stated count or grams, calculate accurately.
   - For bread/Tamees: default quarter loaf is 90g (whole is 360g).
   - If user gave fraction ("ربع" = 0.25, "نص" = 0.5, "كامل" = 1.0), set "fraction_of_reference".
4. Fill "ai_estimated_per_100g" with realistic per-100g values:
   - For breads: protein is ~8-11g/100g max 14g.
   - For rice: protein is ~2.5-3.5g/100g.
   - For poultry: protein is ~25-28g/100g.
5. Output ONLY valid JSON matching the schema.`;

const SINGLE_ITEM_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name_ar: { type: SchemaType.STRING },
    name_en: { type: SchemaType.STRING },
    category: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [
        "bread_pastry",
        "rice_grain",
        "traditional_dish",
        "meat_poultry",
        "legume",
        "snack_fastfood",
        "fruit_dates",
        "dairy_egg",
        "beverage",
        "other",
      ],
    },
    grams: { type: SchemaType.NUMBER },
    fraction_of_reference: { type: SchemaType.NUMBER },
    portion_assumed: { type: SchemaType.BOOLEAN },
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

  /**
   * Deterministic post-processor enforcing composite dish decomposition
   * (e.g. Kabsa => Kabsa Rice + Cooked Chicken)
   */
  public static decomposeCompositeDishes(items: ParsedItem[]): ParsedItem[] {
    const result: ParsedItem[] = [];

    for (const item of items) {
      const text = ((item.name_ar || "") + " " + (item.name_en || "")).toLowerCase();
      const isKabsaChicken = /كبسة\s*(دجاج|الدجاج)|دجاج\s*كبسة|chicken\s*kabsa/.test(text);
      const isMandiChicken = /مندي\s*(دجاج|الدجاج)|دجاج\s*مندي|chicken\s*mandi/.test(text);
      const isMadghootChicken = /مضغوط\s*(دجاج|الدجاج)|دجاج\s*مضغوط|chicken\s*madghoot/.test(text);
      const isSaleegChicken = /سليق\s*(دجاج|الدجاج|بالدجاج)|chicken\s*saleeg/.test(text);
      const isKabsaMeat = /كبسة\s*(لحم|اللحم|حاشي|غنم)|lamb\s*kabsa|meat\s*kabsa/.test(text);
      const isMandiMeat = /مندي\s*(لحم|اللحم|حاشي|غنم)|lamb\s*mandi|meat\s*mandi/.test(text);

      if (isKabsaChicken || isMandiChicken || isMadghootChicken || isSaleegChicken) {
        // Extract fraction: default quarter chicken = 115g edible meat unless user explicitly specified half or whole
        let frac = item.fraction_of_reference;
        if (frac == null) {
          if (/نص|نصف|half/i.test(text)) {
            frac = 0.5;
          } else if (/كامل|حبة كاملة|whole/i.test(text)) {
            frac = 1.0;
          } else {
            frac = 0.25; // Default: quarter chicken (115g edible meat)
          }
        }
        const chickenGrams = Math.round(460 * frac);
        const riceGrams = 250;

        const carbNameAr = isSaleegChicken
          ? "سليق (أرز بالحليب بدون الدجاج)"
          : isMandiChicken
          ? "أرز بخاري / مندي (مطبوخ)"
          : "أرز كبسة / مضغوط (مطبوخ بدون اللحم)";
        const carbNameEn = isSaleegChicken ? "Saleeg Rice" : "Cooked Kabsa / Mandi Rice";

        // 1. Carbohydrate Base Item
        result.push({
          name_ar: carbNameAr,
          name_en: carbNameEn,
          canonical_name: carbNameEn,
          category: "rice_grain",
          cooking_state: "cooked",
          confidence: item.confidence,
          visible: item.visible,
          quantity: { grams_min: 200, grams_max: 300, basis: "user_stated" },
          extracted_grams: riceGrams,
          portion_assumed: item.portion_assumed ?? true,
          ai_fallback_per_100g: { kcal: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
          ai_estimated_per_100g: { kcal: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
          needs_user_confirmation: [],
          warnings: [],
        });

        // 2. Cooked Chicken Meat Item
        result.push({
          name_ar: "دجاج شواية / مضغوط / مندي / كبسة (صافي اللحم المأكول بدون العظم)",
          name_en: "Cooked Chicken Meat (Boneless / Edible)",
          canonical_name: "Cooked Chicken Meat (Boneless / Edible)",
          category: "meat_poultry",
          cooking_state: "cooked",
          confidence: item.confidence,
          visible: item.visible,
          quantity: { grams_min: chickenGrams - 15, grams_max: chickenGrams + 15, basis: "user_stated" },
          extracted_grams: chickenGrams,
          fraction_of_reference: frac,
          portion_assumed: item.portion_assumed ?? true,
          ai_fallback_per_100g: { kcal: 215, protein_g: 26, carbs_g: 0, fat_g: 11.5 },
          ai_estimated_per_100g: { kcal: 215, protein_g: 26, carbs_g: 0, fat_g: 11.5 },
          needs_user_confirmation: [],
          warnings: [],
        });
      } else if (isKabsaMeat || isMandiMeat) {
        const meatGrams = 100;
        const riceGrams = 250;
        const carbNameAr = isMandiMeat ? "أرز بخاري / مندي (مطبوخ)" : "أرز كبسة / مضغوط (مطبوخ بدون اللحم)";

        result.push({
          name_ar: carbNameAr,
          name_en: "Cooked Kabsa / Mandi Rice",
          canonical_name: "Cooked Kabsa / Mandi Rice",
          category: "rice_grain",
          cooking_state: "cooked",
          confidence: item.confidence,
          visible: item.visible,
          quantity: { grams_min: 200, grams_max: 300, basis: "user_stated" },
          extracted_grams: riceGrams,
          portion_assumed: item.portion_assumed ?? true,
          ai_fallback_per_100g: { kcal: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
          ai_estimated_per_100g: { kcal: 155, protein_g: 3, carbs_g: 30, fat_g: 2.5 },
          needs_user_confirmation: [],
          warnings: [],
        });

        result.push({
          name_ar: "لحم غنم / حاشي مطبوخ (صافي بدون عظم)",
          name_en: "Cooked Lamb / Camel Meat (Boneless)",
          canonical_name: "Cooked Lamb / Camel Meat (Boneless)",
          category: "meat_poultry",
          cooking_state: "cooked",
          confidence: item.confidence,
          visible: item.visible,
          quantity: { grams_min: 80, grams_max: 120, basis: "user_stated" },
          extracted_grams: meatGrams,
          portion_assumed: item.portion_assumed ?? true,
          ai_fallback_per_100g: { kcal: 270, protein_g: 25, carbs_g: 0, fat_g: 19 },
          ai_estimated_per_100g: { kcal: 270, protein_g: 25, carbs_g: 0, fat_g: 19 },
          needs_user_confirmation: [],
          warnings: [],
        });
      } else {
        result.push(item);
      }
    }

    return result;
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
    draft.input_type = inputType;

    // Apply deterministic composite dish decomposition post-processing
    draft.items = MealParser.decomposeCompositeDishes(draft.items);

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
   * Unified entry point: text, voice, and photo extraction.
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
        "An audio recording of the user describing their meal is attached. Listen to it and extract foods and quantities.",
      );
    }
    if (image?.base64) {
      instructions.push(
        "A photo related to the meal is attached. Identify foods and visually estimate portions in grams.",
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
   * Reparse or refine a single food item based on user correction or description,
   * grounded with database lookup & deterministic plausibility checks.
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
      if (currentItem.category) lines.push(`- Category: ${currentItem.category}`);
      if (currentItem.grams) lines.push(`- Current Weight: ${currentItem.grams}g`);
      if (currentItem.calories != null) lines.push(`- Current Calories: ${currentItem.calories} kcal`);
      lines.push("");
      lines.push(`USER CORRECTION NOTE:\n"${prompt}"`);
      lines.push(
        "Apply the user's correction to this item, re-extracting portion and realistic per-100g nutritional facts.",
      );
    } else {
      lines.push(`NEW FOOD ITEM TO ANALYZE:\n"${prompt}"`);
      lines.push(
        "Extract this single food item, category, realistic portion in grams, and nutritional values per 100g.",
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

    const name_ar = String(parsed.name_ar || currentItem?.name_ar || currentItem?.name || "صنف غذائي");
    const name_en = String(parsed.name_en || currentItem?.name_en || "Food item");
    const category: FoodCategory | undefined = parsed.category || currentItem?.category;

    // 1. Check database and curated reference fallback first
    let dbFood = null;
    try {
      dbFood = await findFood({ name_ar, name_en, category });
    } catch (e) {
      console.warn("[MealParser] lookup for single item failed:", e);
    }

    let grams = Math.max(1, Math.min(5000, Math.round(Number(parsed.grams) || Number(currentItem?.grams) || 100)));
    if (parsed.fraction_of_reference && dbFood?.reference_unit_g) {
      grams = Math.round(dbFood.reference_unit_g * parsed.fraction_of_reference);
    } else if (parsed.portion_assumed && dbFood?.default_portion_g) {
      grams = dbFood.default_portion_g;
    }

    // Per 100g base: prioritize curated DB values, otherwise use AI estimate
    const est = parsed.ai_estimated_per_100g || {};
    const rawP100 = dbFood?.per100g ?? {
      calories: Math.max(0, Math.round(Number(est.kcal) || 0)),
      protein_g: Math.max(0, Math.round((Number(est.protein_g) || 0) * 10) / 10),
      carbs_g: Math.max(0, Math.round((Number(est.carbs_g) || 0) * 10) / 10),
      fat_g: Math.max(0, Math.round((Number(est.fat_g) || 0) * 10) / 10),
    };

    // 2. Apply deterministic plausibility checks
    const plausibleItem = applyPlausibilityChecks({
      id: "single-temp",
      canonical_name: name_en,
      display_name_ar: name_ar,
      grams,
      state: "ready_to_eat",
      category: dbFood?.category || category,
      per_100g: createMacroNutrients(rawP100.calories, rawP100.protein_g, rawP100.carbs_g, rawP100.fat_g),
      source: dbFood ? "db_match" : "ai_estimate",
      confidence: "high",
      portion_assumed: !!parsed.portion_assumed,
      default_portion_g: dbFood?.default_portion_g,
      reference_unit_g: dbFood?.reference_unit_g,
    });

    const finalGrams = plausibleItem.grams;
    const derived = calculateItemMacros(plausibleItem.per_100g, finalGrams);

    return {
      name_ar,
      name_en,
      category: plausibleItem.category,
      grams: finalGrams,
      per100g: {
        calories: plausibleItem.per_100g.calories,
        protein: plausibleItem.per_100g.protein_g,
        carbs: plausibleItem.per_100g.carbs_g,
        fat: plausibleItem.per_100g.fat_g,
      },
      calories: derived.calories,
      protein: derived.protein_g,
      carbs: derived.carbs_g,
      fat: derived.fat_g,
      cooking_state: parsed.cooking_state,
      reference_unit_g: dbFood?.reference_unit_g,
      portion_assumed: plausibleItem.portion_assumed,
      plausibility_warning: plausibleItem.plausibility_warning,
      notes: parsed.notes,
    };
  }
}
