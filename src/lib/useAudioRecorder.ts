"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaPayload } from "./ai/types";
import { blobToBase64 } from "./media";

/** Hard cap so a forgotten recording can't blow past the serverless payload limit. */
export const MAX_RECORDING_SECONDS = 120;

/** Prefer formats Gemini accepts; Safari only does mp4, Chrome/Firefox webm/ogg. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export type RecorderErrorCode = "unsupported" | "denied" | "no-device" | "failed" | "empty";

export class RecorderError extends Error {
  constructor(public code: RecorderErrorCode) {
    super(code);
  }
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((p: MediaPayload | null) => void) | null>(null);
  const discardRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, []);

  /** Ends the recording; resolves with the audio (or null when cancelled). */
  const stop = useCallback(
    (discard = false): Promise<MediaPayload | null> =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          cleanup();
          resolve(null);
          return;
        }
        discardRef.current = discard;
        resolveRef.current = resolve;
        recorder.stop(); // onstop finishes the job
      }),
    [cleanup],
  );

  const start = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      throw new RecorderError("unsupported");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") throw new RecorderError("denied");
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new RecorderError("no-device");
      }
      throw new RecorderError("failed");
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      throw new RecorderError("failed");
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = async () => {
      const resolve = resolveRef.current;
      resolveRef.current = null;
      const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const discard = discardRef.current;
      cleanup();
      if (!resolve) return;
      if (discard || blob.size === 0) {
        resolve(null);
        return;
      }
      try {
        resolve({ mimeType: type, base64: await blobToBase64(blob) });
      } catch {
        resolve(null);
      }
    };

    recorder.start();
    setElapsed(0);
    setRecording(true);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
  }, [cleanup]);

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      discardRef.current = true;
      resolveRef.current = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { recording, elapsed, start, stop };
}
