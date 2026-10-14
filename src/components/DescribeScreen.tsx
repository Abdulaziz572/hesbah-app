"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MealInput, MediaPayload } from "@/src/lib/ai/types";
import { compressImage, toDataUrl } from "@/src/lib/media";
import {
  MAX_RECORDING_SECONDS,
  RecorderError,
  useAudioRecorder,
} from "@/src/lib/useAudioRecorder";

const EXAMPLE = "أكلت نص حبة دجاج شواية مع صحن رز بخاري صغير، وشربت بيبسي دايت";

interface Props {
  onAnalyze: (input: MealInput) => void | Promise<void>;
  loading: boolean;
  error: string | null;
}

const fmtTime = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const RECORDER_ERRORS: Record<string, string> = {
  unsupported: "متصفحك لا يدعم التسجيل الصوتي. جرّب الكتابة أو إرفاق صورة.",
  denied: "تم رفض الوصول إلى الميكروفون. فعّل الإذن من إعدادات المتصفح ثم حاول مجدداً.",
  "no-device": "لم يتم العثور على ميكروفون في جهازك.",
  failed: "تعذّر بدء التسجيل. حاول مرة أخرى.",
};

export default function DescribeScreen({ onAnalyze, loading, error }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<MediaPayload | null>(null);
  const [audio, setAudio] = useState<{ payload: MediaPayload; secs: number } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { recording, elapsed, start, stop } = useAudioRecorder();
  const stopGuard = useRef(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const busy = loading || preparing || compressing;
  const hasInput = text.trim().length > 0 || !!image || !!audio;
  const canSubmit = hasInput && !busy && !recording;

  // ---------- Image: camera / gallery / clipboard ----------
  const attachImage = useCallback(async (file: Blob) => {
    setLocalError(null);
    setCompressing(true);
    try {
      setImage(await compressImage(file));
    } catch (e) {
      console.error(e);
      setLocalError("تعذّر قراءة الصورة. جرّب صورة أخرى بصيغة JPG أو PNG.");
    } finally {
      setCompressing(false);
    }
  }, []);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (file) void attachImage(file);
  }

  // Paste a screenshot / copied photo anywhere on the screen.
  useEffect(() => {
    if (loading || preparing || recording) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === "file" && i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void attachImage(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loading, preparing, recording, attachImage]);

  // ---------- Voice ----------
  async function startRecording() {
    setLocalError(null);
    try {
      await start();
    } catch (e) {
      setLocalError(RECORDER_ERRORS[e instanceof RecorderError ? e.code : "failed"]);
    }
  }

  const stopAndAnalyze = useCallback(async () => {
    if (stopGuard.current) return;
    stopGuard.current = true;
    setPreparing(true);
    try {
      const secs = elapsed;
      const payload = await stop();
      if (!payload) {
        setLocalError("لم يتم التقاط أي صوت. حاول التسجيل مرة أخرى.");
        return;
      }
      // Kept attached so the user can retry if the analysis fails.
      setAudio({ payload, secs });
      await onAnalyze({
        text: text.trim() || undefined,
        audio: payload,
        image: image ?? undefined,
      });
    } finally {
      setPreparing(false);
      stopGuard.current = false;
    }
  }, [elapsed, stop, onAnalyze, text, image]);

  async function cancelRecording() {
    await stop(true);
  }

  // Safety cap: finish and analyze automatically at the max length.
  useEffect(() => {
    if (recording && elapsed >= MAX_RECORDING_SECONDS) void stopAndAnalyze();
  }, [recording, elapsed, stopAndAnalyze]);

  // ---------- Submit ----------
  function submit() {
    setLocalError(null);
    return onAnalyze({
      text: text.trim() || undefined,
      audio: audio?.payload,
      image: image ?? undefined,
    });
  }

  const shownError = localError ?? error;

  return (
    <section className="flex flex-col gap-4 w-full" aria-labelledby="describe-title">
      <div className="flex flex-col gap-1 px-1">
        <h1 id="describe-title" className="text-[28px] leading-[34px] font-bold text-on-surface">
          اكتب، تحدّث أو صوّر
        </h1>
        <p className="text-[13px] text-on-surface-variant">
          اكتب مكونات وجبتك، أو سجّل صوتك بالعامية، أو أرفق صورة للصحن، وسنحلّلها لك.
        </p>
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-[20px] shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-md shadow-secondary/20">
            <span className="material-symbols-outlined text-[20px]">restaurant</span>
          </div>
          <span className="text-[15px] font-bold text-on-surface">ماذا أكلت؟</span>
        </div>

        {/* Attached image preview */}
        {(image || compressing) && (
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-surface-container-low">
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toDataUrl(image)}
                  alt="الصورة المرفقة"
                  className="w-20 h-20 rounded-xl object-cover shadow-sm"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-on-surface">صورة مرفقة</span>
                  <span className="text-[11px] text-on-surface-variant">
                    أضف ملاحظة بالأسفل إن أردت (مثال: أكلت نص الصحن فقط)
                  </span>
                </div>
                <button
                  id="remove-image-btn"
                  type="button"
                  onClick={() => setImage(null)}
                  disabled={busy}
                  aria-label="إزالة الصورة"
                  className="w-9 h-9 shrink-0 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 text-[13px] text-on-surface-variant">
                <span
                  className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
                  aria-hidden
                />
                <span>جاري تجهيز الصورة…</span>
              </div>
            )}
          </div>
        )}

        {/* Attached voice note (kept so a failed analysis can be retried) */}
        {audio && !recording && (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
            </div>
            <div className="flex-1 flex flex-col">
              <span className="text-[13px] font-semibold text-on-surface">تسجيل صوتي مرفق</span>
              <span className="text-[11px] text-on-surface-variant">
                المدة {fmtTime(audio.secs)}
              </span>
            </div>
            <button
              id="remove-audio-btn"
              type="button"
              onClick={() => setAudio(null)}
              disabled={busy}
              aria-label="إزالة التسجيل الصوتي"
              className="w-9 h-9 shrink-0 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        <textarea
          id="meal-text"
          dir="rtl"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || recording}
          rows={image || audio ? 3 : 5}
          placeholder={
            image
              ? "ملاحظة اختيارية على الصورة، مثال: أكلت نص هذا الصحن فقط…"
              : "مثال: أكلت صحن كبسة دجاج وشربت قهوة عربية…"
          }
          className="w-full resize-none rounded-xl bg-surface-container-low p-3 text-[16px] leading-6 text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        />

        {recording ? (
          /* Recording state */
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 p-3.5 rounded-2xl bg-error-container text-on-error-container"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex w-4 h-4 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-60 animate-ping" />
                <span className="relative inline-flex w-4 h-4 rounded-full bg-error" />
              </span>
              <div className="flex-1 flex flex-col">
                <span className="text-[14px] font-bold">جاري التسجيل…</span>
                <span className="text-[11px] opacity-80">
                  تحدّث بالعامية عمّا أكلته وكمياته
                </span>
              </div>
              <span
                id="recording-timer"
                dir="ltr"
                className="text-[20px] font-bold tabular-nums"
              >
                {fmtTime(elapsed)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="cancel-recording-btn"
                type="button"
                onClick={() => void cancelRecording()}
                disabled={preparing}
                className="h-11 px-4 rounded-xl bg-surface-container-lowest/70 text-on-error-container text-[14px] font-semibold active:scale-95 transition-transform disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                id="stop-recording-btn"
                type="button"
                onClick={() => void stopAndAnalyze()}
                disabled={preparing}
                className="flex-1 h-11 rounded-xl bg-error text-white text-[14px] font-bold flex items-center justify-center gap-2 shadow-md shadow-error/30 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                <span>إيقاف وتحليل</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button
                id="mic-btn"
                type="button"
                onClick={() => void startRecording()}
                disabled={busy}
                className="h-16 rounded-2xl bg-secondary text-on-secondary flex flex-col items-center justify-center gap-0.5 shadow-md shadow-secondary/20 active:scale-95 transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[24px]">mic</span>
                <span className="text-[12px] font-semibold">تسجيل صوتي</span>
              </button>
              <button
                id="camera-btn"
                type="button"
                onClick={() => cameraInput.current?.click()}
                disabled={busy}
                className="h-16 rounded-2xl bg-surface-container-low text-primary flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                <span className="text-[12px] font-semibold">التقاط صورة</span>
              </button>
              <button
                id="gallery-btn"
                type="button"
                onClick={() => galleryInput.current?.click()}
                disabled={busy}
                className="h-16 rounded-2xl bg-surface-container-low text-primary flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
                <span className="text-[12px] font-semibold">من المعرض</span>
              </button>
            </div>

            <input
              ref={cameraInput}
              id="camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickFile}
              className="hidden"
            />
            <input
              ref={galleryInput}
              id="gallery-input"
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setText(EXAMPLE)}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary-container/10 text-secondary text-[12px] font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                <span>جرّب مثالاً</span>
              </button>
              <span className="text-[11px] text-outline">يمكنك لصق صورة مباشرة (Ctrl+V)</span>
            </div>
          </>
        )}
      </div>

      {shownError && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-error-container text-on-error-container text-[13px]"
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{shownError}</span>
        </div>
      )}

      <button
        id="analyze-btn"
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
      >
        {loading || preparing ? (
          <>
            <span
              className="w-5 h-5 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
              aria-hidden
            />
            <span>جاري التحليل…</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            <span>Analyze · حلّل الوجبة</span>
          </>
        )}
      </button>
    </section>
  );
}
