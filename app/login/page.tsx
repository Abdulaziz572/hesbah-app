"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function translateError(errStr: string): string {
    const s = errStr.toLowerCase();
    if (s.includes("invalid login credentials") || s.includes("invalid_grant")) {
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
    }
    if (s.includes("user already registered")) {
      return "هذا البريد مسجل مسبقاً، تفضل بتسجيل الدخول";
    }
    if (s.includes("password should be at least")) {
      return "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل";
    }
    if (s.includes("email rate limit exceeded") || s.includes("over_email_send_rate_limit")) {
      return "تم تجاوز حد إرسال الرسائل، يرجى الانتظار قليلاً";
    }
    return errStr || "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل");
        return;
      }
      if (password !== confirmPassword) {
        setError("كلمتا المرور غير متطابقتين");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInErr) {
          setError(translateError(signInErr.message));
          return;
        }

        if (data.session) {
          router.replace("/");
        }
      } else {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpErr) {
          setError(translateError(signUpErr.message));
          return;
        }

        if (data.session) {
          // If auto-confirm is enabled in Supabase, user gets instant session
          router.replace("/");
        } else if (data.user) {
          // Email confirmation is required
          setSuccessMessage("تم إنشاء الحساب بنجاح! تفضل بتسجيل الدخول أو تحقق من بريدك إذا طُلب التفعيل.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الاتصال بالخادم";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary-fixed flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-primary text-[36px]">nutrition</span>
          </div>
          <h1 className="text-[26px] font-bold text-on-surface">حسبة</h1>
          <p className="text-[14px] text-on-surface-variant">
            سجّل وجباتك بذكاء وتتبّع سعراتك بدقة متناهية
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
          {/* Mode Tabs */}
          <div className="flex bg-surface-container-low p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              إنشاء حساب
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-[13px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-[13px] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-email" className="text-[13px] font-semibold text-on-surface">
                البريد الإلكتروني
              </label>
              <div className="relative flex items-center">
                <input
                  id="auth-email"
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 px-4 ps-11 rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:bg-surface-container-lowest text-[15px] text-on-surface outline-none transition-colors"
                />
                <span className="material-symbols-outlined absolute start-3 text-[20px] text-on-surface-variant pointer-events-none">
                  mail
                </span>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-password" className="text-[13px] font-semibold text-on-surface">
                كلمة المرور
              </label>
              <div className="relative flex items-center">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 ps-11 pe-11 rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:bg-surface-container-lowest text-[15px] text-on-surface outline-none transition-colors"
                />
                <span className="material-symbols-outlined absolute start-3 text-[20px] text-on-surface-variant pointer-events-none">
                  lock
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-3 text-on-surface-variant hover:text-on-surface transition-colors flex items-center"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm Password (signup only) */}
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-confirm-password" className="text-[13px] font-semibold text-on-surface">
                  تأكيد كلمة المرور
                </label>
                <div className="relative flex items-center">
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 ps-11 rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:bg-surface-container-lowest text-[15px] text-on-surface outline-none transition-colors"
                  />
                  <span className="material-symbols-outlined absolute start-3 text-[20px] text-on-surface-variant pointer-events-none">
                    lock_reset
                  </span>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-primary/20 transition-all disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === "login" ? "جارٍ تسجيل الدخول..." : "جارٍ إنشاء الحساب..."}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    {mode === "login" ? "login" : "person_add"}
                  </span>
                  <span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-on-surface-variant">
          حسبة • تطبيق تتبع التغذية بالذكاء الاصطناعي
        </p>
      </div>
    </div>
  );
}
