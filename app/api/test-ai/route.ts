import { NextResponse } from "next/server";
import { MealParser } from "../../../src/lib/ai/MealParser";
import type { MediaPayload } from "../../../src/lib/ai/types";

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

// Vercel serverless request bodies are capped at 4.5 MB; leave headroom for JSON overhead.
const MAX_BODY_BYTES = 4_200_000;
// Base64 chars per media payload (~3 MB of base64 each is already generous after compression).
const MAX_AUDIO_B64 = 3_500_000;
const MAX_IMAGE_B64 = 3_000_000;

// Long audio/vision requests can take a while; give the function room on Vercel.
export const maxDuration = 60;

function parseMedia(
  value: unknown,
  kind: "audio" | "image",
): { media?: MediaPayload; error?: string; status?: number } {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object") return { error: `Field '${kind}' is invalid`, status: 400 };
  const { mimeType, base64 } = value as Partial<MediaPayload>;
  if (typeof mimeType !== "string" || typeof base64 !== "string" || !base64) {
    return { error: `Field '${kind}' must be { mimeType, base64 }`, status: 400 };
  }
  if (!mimeType.toLowerCase().startsWith(`${kind}/`)) {
    return { error: `Field '${kind}.mimeType' must be ${kind}/*`, status: 400 };
  }
  if (base64.length > (kind === "audio" ? MAX_AUDIO_B64 : MAX_IMAGE_B64)) {
    return { error: `The ${kind} is too large. Please use a shorter/smaller one.`, status: 413 };
  }
  return { media: { mimeType, base64 } };
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Handle single-item AI re-prompting or single-item creation
  if (body.action === "reparse_item") {
    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : typeof body.text === "string"
        ? body.text.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "يجب تقديم وصف أو تعديل للمكون (prompt)" },
        { status: 400 },
      );
    }

    const currentItem =
      body.item && typeof body.item === "object"
        ? (body.item as import("../../../src/lib/ai/types").SingleItemInput)
        : null;

    try {
      const result = await MealParser.reparseSingleItem(currentItem, prompt);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reparse item";
      console.error("[test-ai] reparseSingleItem failed:", error);
      return NextResponse.json(
        { error: "تعذّر تعديل المكون بالذكاء الاصطناعي", details: message },
        { status: 500 },
      );
    }
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const audio = parseMedia(body.audio, "audio");
  if (audio.error) return NextResponse.json({ error: audio.error }, { status: audio.status });
  const image = parseMedia(body.image, "image");
  if (image.error) return NextResponse.json({ error: image.error }, { status: image.status });

  if (!text && !audio.media && !image.media) {
    return NextResponse.json(
      { error: "Provide at least one of 'text', 'audio' or 'image'" },
      { status: 400 },
    );
  }

  try {
    const draft = await MealParser.parseMealInput({
      text,
      audio: audio.media,
      image: image.media,
    });
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
