"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme, type Theme } from "@/src/context/ThemeContext";
import {
  ACTIVITY_MULTIPLIERS,
  GOAL_ADJUSTMENTS,
  MIN_DAILY_CALORIES,
  STAT_LIMITS,
  caloriesFromMacros,
  calculateDailyTargets,
  defaultProfile,
  getCachedUserProfile,
  getUserProfile,
  saveUserProfile,
  type ActivityLevel,
  type DailyTargets,
  type Gender,
  type GoalType,
  type UserProfile,
} from "@/src/lib/nutrition";

/* ------------------------------------------------------------------ */
/* Copy & options                                                      */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "ذكر" },
  { value: "female", label: "أنثى" },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; icon: string }[] = [
  { value: "sedentary", label: "خامل", hint: "عمل مكتبي وحركة قليلة بدون تمارين", icon: "chair" },
  { value: "light", label: "نشاط خفيف", hint: "تمارين خفيفة 1–3 أيام في الأسبوع", icon: "directions_walk" },
  { value: "moderate", label: "نشاط متوسط", hint: "تمارين معتدلة 3–5 أيام في الأسبوع", icon: "directions_run" },
  { value: "active", label: "نشيط جداً", hint: "تمارين قوية 6–7 أيام في الأسبوع", icon: "exercise" },
];

const GOAL_OPTIONS: { value: GoalType; label: string; hint: string; icon: string }[] = [
  { value: "lose", label: "خسارة وزن", hint: "عجز 500 سعرة", icon: "trending_down" },
  { value: "maintain", label: "المحافظة على الوزن", hint: "بدون تعديل", icon: "balance" },
  { value: "gain", label: "زيادة وزن وعضل", hint: "فائض 300 سعرة", icon: "trending_up" },
];

const GOAL_RECEIPT_LABEL: Record<GoalType, string> = {
  lose: "عجز لخسارة الوزن",
  maintain: "تعديل الهدف",
  gain: "فائض لبناء العضل",
};

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "فاتح", icon: "light_mode" },
  { value: "dark", label: "داكن", icon: "dark_mode" },
  { value: "system", label: "تلقائي", icon: "brightness_auto" },
];

const CUSTOM_LIMITS = {
  target_calories: { min: 800, max: 6000, step: 50 },
  target_protein_g: { min: 0, max: 500, step: 5 },
  target_carbs_g: { min: 0, max: 800, step: 5 },
  target_fat_g: { min: 0, max: 300, step: 5 },
} as const;

const COMPARE_KEYS: (keyof UserProfile)[] = [
  "gender",
  "age",
  "height_cm",
  "weight_kg",
  "activity_level",
  "goal_type",
  "target_calories",
  "target_protein_g",
  "target_carbs_g",
  "target_fat_g",
  "is_custom_targets",
];

const sameProfile = (a: UserProfile, b: UserProfile) => COMPARE_KEYS.every((k) => a[k] === b[k]);

/** Accept Arabic-Indic digits and the Arabic decimal separator from mobile keyboards. */
const toLatinNumber = (s: string) =>
  s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u066B,]/g, ".");

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string; icon?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const idx = options.findIndex((o) => o.value === value);
  const n = options.length;
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div
        className="relative grid p-0.5 rounded-[10px] bg-surface-container-high dark:bg-surface-container-low"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {idx >= 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 bottom-0.5 rounded-lg bg-surface-container-lowest dark:bg-surface-container-highest shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{
              insetInlineStart: 2,
              width: `calc((100% - 4px) / ${n})`,
              transform: `translateX(${-idx * 100}%)`,
            }}
          />
        )}
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={`relative z-[1] flex items-center justify-center gap-1.5 h-10 rounded-lg cursor-pointer select-none text-[14px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                checked ? "text-on-surface font-semibold" : "text-on-surface-variant"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.icon && (
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  {o.icon}
                </span>
              )}
              <span className="truncate">{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function NumberStepper({
  id,
  name,
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  decimals = 0,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  onChange: (n: number) => void;
}) {
  // Raw text while focused so the field can be cleared and retyped freely.
  const [text, setText] = useState<string | null>(null);
  const factor = 10 ** decimals;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * factor) / factor));

  const btn =
    "w-10 h-10 rounded-lg bg-surface-container-lowest dark:bg-surface-container-high text-on-surface flex items-center justify-center shadow-sm active:scale-90 transition-transform disabled:opacity-40 disabled:active:scale-100 " +
    focusRing;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 min-h-[60px]">
      <label htmlFor={id} className="text-[15px] text-on-surface min-w-0">
        {label}
      </label>
      <div className="flex items-center gap-1 bg-surface-container-low rounded-xl p-1 shrink-0">
        <button
          type="button"
          aria-label={`إنقاص ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
          className={btn}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            remove
          </span>
        </button>
        <div className="flex items-baseline justify-center gap-1 w-[76px]" dir="ltr">
          <input
            id={id}
            name={name}
            type="text"
            inputMode={decimals > 0 ? "decimal" : "numeric"}
            autoComplete="off"
            aria-describedby={`${id}-unit`}
            value={text ?? String(value)}
            onFocus={(e) => {
              setText(String(value));
              e.target.select();
            }}
            onChange={(e) => {
              const raw = toLatinNumber(e.target.value);
              setText(raw);
              const n = parseFloat(raw);
              if (Number.isFinite(n) && n >= min && n <= max) onChange(clamp(n));
            }}
            onBlur={() => {
              const n = parseFloat(text ?? "");
              if (Number.isFinite(n)) onChange(clamp(n));
              setText(null);
            }}
            className="w-12 text-center font-bold text-[17px] tabular-nums text-on-surface bg-transparent rounded-md focus-visible:outline-2 focus-visible:outline-primary"
          />
          <span id={`${id}-unit`} className="text-[12px] text-on-surface-variant">
            {unit}
          </span>
        </div>
        <button
          type="button"
          aria-label={`زيادة ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
          className={btn}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            add
          </span>
        </button>
      </div>
    </div>
  );
}

function Switch({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col min-w-0">
        <label htmlFor={id} className="text-[15px] font-semibold text-on-surface cursor-pointer">
          {label}
        </label>
        <span id={`${id}-desc`} className="text-[12px] text-on-surface-variant">
          {description}
        </span>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-[52px] h-8 rounded-full transition-colors ${focusRing} ${
          checked ? "bg-primary" : "bg-surface-container-highest"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 start-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            checked ? "-translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[13px] font-semibold text-on-surface-variant px-1 scroll-mt-20">
      {children}
    </h2>
  );
}

const card =
  "bg-surface-container-lowest rounded-[20px] border border-outline-variant/25 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.02)]";

/** Hairline separator indented from the inline start, iOS inset-grouped style. */
const rowDivider =
  "relative before:content-[''] before:absolute before:top-0 before:start-4 before:end-0 before:h-px before:bg-outline-variant/30";

/* ------------------------------------------------------------------ */
/* Calculation receipt                                                 */
/* ------------------------------------------------------------------ */

function ReceiptLine({
  label,
  op,
  value,
  strong,
}: {
  label: string;
  op?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className={`text-[13px] ${strong ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}>
        {label}
      </span>
      <span
        dir="ltr"
        className={`tabular-nums text-[14px] ${strong ? "font-bold text-on-surface" : "font-semibold text-on-surface"}`}
      >
        {op && <span className="text-on-surface-variant me-1">{op}</span>}
        {value}
      </span>
    </div>
  );
}

function MacroSplit({ targets }: { targets: DailyTargets }) {
  const parts = [
    { key: "p", label: "بروتين", g: targets.target_protein_g, kcal: targets.target_protein_g * 4, bar: "bg-secondary", text: "text-secondary" },
    { key: "c", label: "كربوهيدرات", g: targets.target_carbs_g, kcal: targets.target_carbs_g * 4, bar: "bg-tertiary", text: "text-tertiary" },
    { key: "f", label: "دهون", g: targets.target_fat_g, kcal: targets.target_fat_g * 9, bar: "bg-primary", text: "text-primary" },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-2.5 rounded-full overflow-hidden bg-surface-container gap-0.5"
        role="img"
        aria-label={parts
          .map((p) => `${p.label} ${total ? Math.round((p.kcal / total) * 100) : 0}٪`)
          .join("، ")}
      >
        {total > 0 &&
          parts.map((p) => (
            <span
              key={p.key}
              className={`${p.bar} h-full transition-[flex-grow] duration-300 motion-reduce:transition-none`}
              style={{ flexGrow: p.kcal, flexBasis: 0 }}
            />
          ))}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${p.bar}`} />
              {p.label}
            </dt>
            <dd className="flex items-baseline gap-1">
              <span className={`text-[20px] font-bold tabular-nums ${p.text}`}>{fmt(p.g)}</span>
              <span className="text-[12px] text-on-surface-variant">جم</span>
              <span className="text-[11px] text-outline tabular-nums ms-auto" dir="ltr">
                {total ? Math.round((p.kcal / total) * 100) : 0}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProfileSettings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, mounted } = useTheme();
  const userId = user?.id ?? "";
  const uid = useId();

  const [initialCached] = useState(() => (userId ? getCachedUserProfile(userId) : null));
  const [form, setForm] = useState<UserProfile>(() => initialCached ?? defaultProfile(userId));
  const [saved, setSaved] = useState<UserProfile | null>(initialCached);
  const [loaded, setLoaded] = useState(Boolean(initialCached));
  const [touched, setTouched] = useState(false);
  const touchedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<{ id: number; synced: boolean } | null>(null);

  // Fetch the authoritative profile (Supabase → localStorage fallback).
  useEffect(() => {
    if (!userId) return;
    const local = getCachedUserProfile(userId);
    if (local && !touchedRef.current) {
      setSaved(local);
      setForm(local);
      setLoaded(true);
    }
    let ignore = false;
    void (async () => {
      const p = await getUserProfile(userId);
      if (ignore) return;
      if (p) {
        setSaved(p);
        if (!touchedRef.current) setForm(p);
      }
      setLoaded(true);
    })();
    return () => {
      ignore = true;
    };
  }, [userId]);

  const update = useCallback((patch: Partial<UserProfile>) => {
    touchedRef.current = true;
    setTouched(true);
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const calc = useMemo(
    () =>
      calculateDailyTargets({
        gender: form.gender,
        age: form.age,
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        activity_level: form.activity_level,
        goal_type: form.goal_type,
      }),
    [form.gender, form.age, form.height_cm, form.weight_kg, form.activity_level, form.goal_type],
  );

  const targets: DailyTargets = form.is_custom_targets
    ? {
        target_calories: form.target_calories,
        target_protein_g: form.target_protein_g,
        target_carbs_g: form.target_carbs_g,
        target_fat_g: form.target_fat_g,
      }
    : {
        target_calories: calc.target_calories,
        target_protein_g: calc.target_protein_g,
        target_carbs_g: calc.target_carbs_g,
        target_fat_g: calc.target_fat_g,
      };

  const effective: UserProfile = { ...form, ...targets };
  const dirty = saved ? !sameProfile(effective, saved) : touched;

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function setCustom(on: boolean) {
    // Seed manual fields from the formula (switching on) or snap back to it (switching off).
    update({
      is_custom_targets: on,
      target_calories: calc.target_calories,
      target_protein_g: calc.target_protein_g,
      target_carbs_g: calc.target_carbs_g,
      target_fat_g: calc.target_fat_g,
    });
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const res = await saveUserProfile({ ...effective, user_id: userId });
    setForm(res.profile);
    setSaved(res.profile);
    touchedRef.current = false;
    setTouched(false);
    setSaving(false);
    setToast({ id: Date.now(), synced: res.synced });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const macroKcal = caloriesFromMacros(targets);
  const macroGap = macroKcal - targets.target_calories;
  const contact = user?.email || user?.phone || "";
  const initial = (user?.email?.[0] ?? "").toUpperCase();

  return (
    <div className="max-w-md w-full mx-auto min-h-screen flex flex-col pb-28">
      <header className="h-16 px-4 flex items-center sticky top-0 z-10 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="flex flex-col">
          <h1 className="text-[18px] font-bold text-on-surface leading-tight">حسابي</h1>
          <span className="text-[12px] text-on-surface-variant">بياناتك وأهدافك وإعدادات التطبيق</span>
        </div>
      </header>

      {/* Save confirmation */}
      <div
        role="status"
        aria-live="polite"
        className="fixed top-[72px] inset-x-0 z-30 px-4 pointer-events-none flex justify-center"
      >
        {toast && (
          <div
            key={toast.id}
            className="max-w-md w-full flex items-start gap-2.5 p-3.5 rounded-2xl bg-inverse-surface text-inverse-on-surface shadow-[0_12px_32px_-4px_rgba(15,23,42,0.25)] animate-[toast-in_220ms_ease-out] motion-reduce:animate-none"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary-fixed-dim">
              check_circle
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold">تم حفظ ملفك الشخصي وأهدافك بنجاح ✓</span>
              {!toast.synced && (
                <span className="text-[12px] opacity-80">
                  محفوظ على هذا الجهاز، وستتم مزامنته مع حسابك عند توفر الاتصال.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 px-4 pt-4 flex flex-col gap-6">
        {!loaded ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="جارٍ تحميل ملفك الشخصي…">
            <div className="h-56 rounded-[20px] bg-surface-container animate-pulse" />
            <div className="h-72 rounded-[20px] bg-surface-container animate-pulse" />
          </div>
        ) : (
          <>
            {/* ---------- Body stats & goal ---------- */}
            <section aria-labelledby={`${uid}-body`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-body`}>بيانات الجسم والهدف</SectionHeading>

              <div className={card}>
                <div className="p-4 pb-3 flex flex-col gap-2">
                  <span aria-hidden="true" className="text-[15px] text-on-surface">
                    الجنس
                  </span>
                  <Segmented
                    name="gender"
                    legend="الجنس"
                    options={GENDER_OPTIONS}
                    value={form.gender}
                    onChange={(v) => update({ gender: v })}
                  />
                </div>
                <div className={rowDivider}>
                  <NumberStepper
                    id={`${uid}-age`}
                    name="age"
                    label="العمر"
                    unit="سنة"
                    value={form.age}
                    min={STAT_LIMITS.age.min}
                    max={STAT_LIMITS.age.max}
                    onChange={(n) => update({ age: n })}
                  />
                </div>
                <div className={rowDivider}>
                  <NumberStepper
                    id={`${uid}-height`}
                    name="height_cm"
                    label="الطول"
                    unit="سم"
                    value={form.height_cm}
                    min={STAT_LIMITS.height_cm.min}
                    max={STAT_LIMITS.height_cm.max}
                    onChange={(n) => update({ height_cm: n })}
                  />
                </div>
                <div className={rowDivider}>
                  <NumberStepper
                    id={`${uid}-weight`}
                    name="weight_kg"
                    label="الوزن الحالي"
                    unit="كجم"
                    value={form.weight_kg}
                    min={STAT_LIMITS.weight_kg.min}
                    max={STAT_LIMITS.weight_kg.max}
                    step={0.5}
                    decimals={1}
                    onChange={(n) => update({ weight_kg: n })}
                  />
                </div>
              </div>

              {/* Activity level */}
              <fieldset className="flex flex-col gap-2 mt-3 min-w-0">
                <legend className="text-[13px] font-semibold text-on-surface-variant px-1 mb-2">
                  مستوى النشاط البدني
                </legend>
                <div className={card}>
                  {ACTIVITY_OPTIONS.map((o, i) => {
                    const checked = form.activity_level === o.value;
                    return (
                      <label
                        key={o.value}
                        className={`flex items-center gap-3 px-4 py-3 min-h-[64px] cursor-pointer select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary first:rounded-t-[20px] last:rounded-b-[20px] ${
                          i > 0 ? rowDivider : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="activity_level"
                          value={o.value}
                          checked={checked}
                          onChange={() => update({ activity_level: o.value })}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                            checked ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-low text-on-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px]">{o.icon}</span>
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className={`text-[15px] ${checked ? "font-semibold text-on-surface" : "text-on-surface"}`}>
                            {o.label}
                          </span>
                          <span className="text-[12px] text-on-surface-variant">{o.hint}</span>
                        </span>
                        <span dir="ltr" className="text-[12px] tabular-nums text-outline shrink-0">
                          ×{ACTIVITY_MULTIPLIERS[o.value]}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`w-[22px] h-[22px] shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                            checked ? "border-primary bg-primary text-on-primary" : "border-outline-variant"
                          }`}
                        >
                          {checked && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Goal */}
              <fieldset className="flex flex-col gap-2 mt-3 min-w-0">
                <legend className="text-[13px] font-semibold text-on-surface-variant px-1 mb-2">الهدف</legend>
                <div className="grid grid-cols-3 gap-2">
                  {GOAL_OPTIONS.map((o) => {
                    const checked = form.goal_type === o.value;
                    return (
                      <label
                        key={o.value}
                        className={`flex flex-col items-center text-center gap-1.5 px-2 py-3.5 rounded-2xl border cursor-pointer select-none transition-[background-color,border-color] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                          checked
                            ? "border-primary bg-primary-fixed/35 dark:bg-primary-fixed/50"
                            : "border-outline-variant/40 bg-surface-container-lowest"
                        }`}
                      >
                        <input
                          type="radio"
                          name="goal_type"
                          value={o.value}
                          checked={checked}
                          onChange={() => update({ goal_type: o.value })}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`material-symbols-outlined text-[26px] ${checked ? "text-primary" : "text-on-surface-variant"}`}
                        >
                          {o.icon}
                        </span>
                        <span className={`text-[13px] leading-[18px] text-on-surface ${checked ? "font-semibold" : ""}`}>
                          {o.label}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">{o.hint}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            {/* ---------- Daily targets: the calculation ---------- */}
            <section aria-labelledby={`${uid}-targets`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-targets`}>الأهداف اليومية</SectionHeading>

              <div className={`${card} p-4 flex flex-col gap-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <h3 className="text-[17px] font-bold text-on-surface">حسبتك اليومية</h3>
                    <span className="text-[12px] text-on-surface-variant">
                      {form.is_custom_targets ? "أهداف أدخلتها بنفسك" : "محسوبة بمعادلة Mifflin-St Jeor من بياناتك"}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold ${
                      form.is_custom_targets
                        ? "bg-tertiary-fixed text-on-tertiary-fixed"
                        : "bg-primary-fixed text-on-primary-fixed"
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                      {form.is_custom_targets ? "edit" : "calculate"}
                    </span>
                    {form.is_custom_targets ? "يدوي" : "تلقائي"}
                  </span>
                </div>

                {form.is_custom_targets ? (
                  <div className="rounded-2xl bg-surface-container-low -mx-1">
                    <NumberStepper
                      id={`${uid}-t-cal`}
                      name="target_calories"
                      label="السعرات"
                      unit="سعرة"
                      value={form.target_calories}
                      {...CUSTOM_LIMITS.target_calories}
                      onChange={(n) => update({ target_calories: n })}
                    />
                    <div className={rowDivider}>
                      <NumberStepper
                        id={`${uid}-t-p`}
                        name="target_protein_g"
                        label="بروتين"
                        unit="جم"
                        value={form.target_protein_g}
                        {...CUSTOM_LIMITS.target_protein_g}
                        onChange={(n) => update({ target_protein_g: n })}
                      />
                    </div>
                    <div className={rowDivider}>
                      <NumberStepper
                        id={`${uid}-t-c`}
                        name="target_carbs_g"
                        label="كربوهيدرات"
                        unit="جم"
                        value={form.target_carbs_g}
                        {...CUSTOM_LIMITS.target_carbs_g}
                        onChange={(n) => update({ target_carbs_g: n })}
                      />
                    </div>
                    <div className={rowDivider}>
                      <NumberStepper
                        id={`${uid}-t-f`}
                        name="target_fat_g"
                        label="دهون"
                        unit="جم"
                        value={form.target_fat_g}
                        {...CUSTOM_LIMITS.target_fat_g}
                        onChange={(n) => update({ target_fat_g: n })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-surface-container-low px-4 py-1 divide-y divide-dashed divide-outline-variant/50">
                    <ReceiptLine label="معدل الأيض الأساسي" value={fmt(calc.bmr)} />
                    <ReceiptLine label="معامل النشاط" op="×" value={String(calc.multiplier)} />
                    <ReceiptLine label="احتياجك للمحافظة على وزنك" op="=" value={fmt(calc.tdee)} />
                    <ReceiptLine
                      label={GOAL_RECEIPT_LABEL[form.goal_type]}
                      op={calc.adjustment < 0 ? "−" : calc.adjustment > 0 ? "+" : "±"}
                      value={fmt(Math.abs(GOAL_ADJUSTMENTS[form.goal_type]))}
                    />
                  </div>
                )}

                {/* Result */}
                <div className="flex items-end justify-between gap-3 border-t-2 border-on-surface/80 pt-3">
                  <span className="text-[14px] font-semibold text-on-surface pb-1.5">السعرات اليومية</span>
                  <span className="flex items-baseline gap-1.5" dir="ltr">
                    <span className="text-[40px] leading-[44px] font-bold tracking-tight tabular-nums text-primary">
                      {fmt(targets.target_calories)}
                    </span>
                    <span className="text-[13px] text-on-surface-variant">سعرة</span>
                  </span>
                </div>

                {!form.is_custom_targets && calc.clampedToMinimum && (
                  <p className="text-[12px] text-on-surface-variant -mt-2">
                    رُفع الهدف إلى الحد الأدنى الآمن ({fmt(MIN_DAILY_CALORIES)} سعرة).
                  </p>
                )}

                {form.is_custom_targets && (
                  <p
                    className={`text-[12px] -mt-2 ${Math.abs(macroGap) > 100 ? "text-tertiary" : "text-on-surface-variant"}`}
                  >
                    مجموع المغذيات يعادل {fmt(macroKcal)} سعرة
                    {Math.abs(macroGap) > 25 &&
                      (macroGap > 0
                        ? ` (أعلى من هدفك بـ ${fmt(macroGap)})`
                        : ` (أقل من هدفك بـ ${fmt(-macroGap)})`)}
                    {targets.target_calories < MIN_DAILY_CALORIES &&
                      `. هدفك أقل من الحد الآمن ${fmt(MIN_DAILY_CALORIES)} سعرة.`}
                  </p>
                )}

                <MacroSplit targets={targets} />

                <div className="flex flex-col gap-3 pt-3 border-t border-outline-variant/25">
                  <Switch
                    id={`${uid}-custom`}
                    checked={form.is_custom_targets}
                    onChange={setCustom}
                    label="تعديل الأهداف يدوياً"
                    description="أدخل السعرات والمغذيات بنفسك بدل المعادلة"
                  />
                  {form.is_custom_targets && (
                    <button
                      type="button"
                      onClick={() => setCustom(false)}
                      className={`self-start inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-surface-container-low text-primary text-[13px] font-semibold active:scale-95 transition-transform ${focusRing}`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                        restart_alt
                      </span>
                      إعادة الحساب التلقائي
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ---------- App settings ---------- */}
            <section aria-labelledby={`${uid}-app`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-app`}>إعدادات التطبيق</SectionHeading>
              <div className={`${card} p-4 flex flex-col gap-2`}>
                <span aria-hidden="true" className="text-[15px] text-on-surface">المظهر</span>
                <Segmented
                  name="theme"
                  legend="المظهر"
                  options={THEME_OPTIONS}
                  value={mounted ? theme : null}
                  onChange={setTheme}
                />
                <span className="text-[12px] text-on-surface-variant">
                  «تلقائي» يتبع إعداد جهازك.
                </span>
              </div>
            </section>

            {/* ---------- Account ---------- */}
            <section aria-labelledby={`${uid}-account`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-account`}>الحساب</SectionHeading>
              <div className={card}>
                <div className="flex items-center gap-3 p-4">
                  <span
                    aria-hidden="true"
                    className="w-11 h-11 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-[17px] font-bold"
                  >
                    {initial || <span className="material-symbols-outlined text-[22px]">person</span>}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-on-surface-variant">مسجّل الدخول بـ</span>
                    <span dir="ltr" className="text-[15px] font-semibold text-on-surface truncate text-end">
                      {contact || "—"}
                    </span>
                  </div>
                </div>
                <div className={`${rowDivider} p-2`}>
                  <button
                    id="profile-sign-out"
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-error text-[15px] font-semibold hover:bg-error-container/40 active:scale-[0.98] transition-[background-color,transform] disabled:opacity-60 ${focusRing}`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      logout
                    </span>
                    {signingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
                  </button>
                </div>
              </div>
            </section>

            {/* ---------- Sticky save bar (live result + action) ---------- */}
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10">
              <div className="flex items-center gap-3 p-2 ps-4 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14)]">
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[17px] font-bold text-on-surface tabular-nums">
                    {fmt(targets.target_calories)}{" "}
                    <span className="text-[12px] font-normal text-on-surface-variant">سعرة يومياً</span>
                  </span>
                  <span className={`text-[12px] truncate ${dirty ? "text-tertiary" : "text-on-surface-variant"}`}>
                    {dirty
                      ? "لديك تغييرات غير محفوظة"
                      : saved
                        ? "كل التغييرات محفوظة"
                        : "احفظ لتطبيق أهدافك على اليوميات"}
                  </span>
                </div>
                <button
                  id="profile-save"
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  aria-busy={saving}
                  className={`h-12 px-5 shrink-0 rounded-xl bg-primary text-on-primary text-[15px] font-semibold flex items-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-transform disabled:opacity-70 ${focusRing}`}
                >
                  {saving ? (
                    <span
                      aria-hidden="true"
                      className="w-4 h-4 rounded-full border-2 border-on-primary/40 border-t-on-primary animate-spin"
                    />
                  ) : (
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      check
                    </span>
                  )}
                  {saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
