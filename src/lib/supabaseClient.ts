import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");

if (!rawUrl || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

/**
 * supabase-js wants the bare project origin (https://<ref>.supabase.co).
 * A trailing path such as /rest/v1/ or /dashboard/... produces
 * "Invalid path specified in request URL", so keep only the origin.
 */
let url: string;
try {
  const parsed = new URL(rawUrl);
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    console.warn(
      `[supabase] NEXT_PUBLIC_SUPABASE_URL contains a path ("${parsed.pathname}"); using origin only.`,
    );
  }
  url = parsed.origin;
} catch {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL is not a valid URL (expected https://<project-ref>.supabase.co).`,
  );
}

export const supabase = createClient(url, anonKey);
