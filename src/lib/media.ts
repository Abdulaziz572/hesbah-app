import type { MediaPayload } from "./ai/types";

/** Longest allowed image side after compression (keeps payloads far below Vercel's 4.5 MB limit). */
export const MAX_IMAGE_DIMENSION = 1024;
export const IMAGE_JPEG_QUALITY = 0.8;

/** Convert a Blob to a bare base64 string (no `data:` prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** Decode an image honoring EXIF orientation, preferring createImageBitmap. */
async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unsupported image format"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Resize an image so its longest side is <= MAX_IMAGE_DIMENSION and re-encode it as
 * JPEG (quality 0.8) using an HTML5 canvas. Returns bare base64 ready for the API.
 */
export async function compressImage(file: Blob): Promise<MediaPayload> {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = decoded;
    if (!width || !height) throw new Error("Invalid image dimensions");

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    // JPEG has no alpha: paint white so transparent PNGs/screenshots don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.source, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image compression failed"))),
        "image/jpeg",
        IMAGE_JPEG_QUALITY,
      ),
    );
    return { mimeType: "image/jpeg", base64: await blobToBase64(blob) };
  } finally {
    decoded.release();
  }
}

/** Build a data URL for previewing a payload (nothing to revoke, unlike object URLs). */
export const toDataUrl = (m: MediaPayload) => `data:${m.mimeType};base64,${m.base64}`;
