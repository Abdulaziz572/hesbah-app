import { NextResponse } from "next/server";
import { MealParser } from "../../../src/lib/ai/MealParser";

const TEST_INPUT = "أكلت نص حبة دجاج شواية مع صحن رز بخاري صغير، وشربت بيبسي دايت";

export async function GET() {
  try {
    const draft = await MealParser.parseText(TEST_INPUT);
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[test-ai] MealParser failed:", error);
    return NextResponse.json(
      { error: "Failed to parse meal", details: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Field 'text' is required" }, { status: 400 });
  }
  try {
    const draft = await MealParser.parseText(text.trim());
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[test-ai] MealParser failed:", error);
    return NextResponse.json(
      { error: "Failed to parse meal", details: message },
      { status: 500 },
    );
  }
}
