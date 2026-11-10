"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme, type Theme } from "@/src/context/ThemeContext";
import { localDateString } from "@/src/lib/dates";
import { fetchMealsForDay } from "@/src/lib/meals";
import { queryKeys, invalidateUserProfile } from "@/src/lib/queryKeys";
import {
  ACTIVITY_MULTIPLIERS,
  MIN_DAILY_CALORIES,
  STAT_LIMITS,
  caloriesFromMacros,
  calculateDailyTargets,
  calculateWeightEMA,
  defaultProfile,
  estimateDailyWeightChangeKg,
  estimateGoalDate,
  estimateWeeksToGoal,
  getCachedUserProfile,
  getCachedWeightLogs,
  getUserProfile,
  getWeightLogs,
  logDailyWeight,
  maxSafeWeeklyPace,
  saveUserProfile,
  sumMacros,
  type ActivityLevel,
  type DailyTargets,
  type DietStyle,
  type Gender,
  type GoalType,
  type UserProfile,
} from "@/src/lib/nutrition";

/* ------------------------------------------------------------------ */
/* Copy & options                                                      */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtKg = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

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
  { value: "lose", label: "خسارة وزن", hint: "عجز سعرات ذكي", icon: "trending_down" },
  { value: "maintain", label: "المحافظة على الوزن", hint: "بدون تعديل", icon: "balance" },
  { value: "gain", label: "زيادة وزن وعضل", hint: "فائض سعرات ذكي", icon: "trending_up" },
];

const PACE_OPTIONS: {
  value: number;
  emoji: string;
  title: string;
  subtitle: string;
  recommended?: boolean;
}[] = [
  { value: 0.25, emoji: "🐢", title: "هادئة", subtitle: "0.25 كجم/أسبوع" },
  { value: 0.5, emoji: "⚖️", title: "متوازنة", subtitle: "0.50 كجم/أسبوع", recommended: true },
  { value: 0.75, emoji: "⚡", title: "سريعة", subtitle: "0.75 كجم/أسبوع" },
  { value: 1.0, emoji: "🔥", title: "مكثفة", subtitle: "1.00 كجم/أسبوع" },
];

const DIET_STYLE_OPTIONS: {
  value: DietStyle;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    value: "balanced",
    title: "متوازن",
    subtitle: "بروتين 1.6 جم/كجم • دهون 30%",
    icon: "balance",
  },
  {
    value: "high_protein",
    title: "عالي البروتين",
    subtitle: "بروتين 2.0 جم/كجم • دهون 25%",
    icon: "fitness_center",
  },
  {
    value: "low_carb",
    title: "قليل الكارب",
    subtitle: "بروتين 2.0 جم/كجم • دهون 40%",
    icon: "grain",
  },
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
  "target_weight_kg",
  "weekly_pace_kg",
  "diet_style",
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
  const [touched, setTouched] = useState(false);
  const touchedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<{ id: number; synced: boolean } | null>(null);

  const [subView, setSubView] = useState<"menu" | "calculator">("menu");

  const openCalculator = useCallback(() => {
    setSubView("calculator");
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("view", "calculator");
        window.history.pushState({ subView: "calculator" }, "", url.toString());
      } catch {}
    }
  }, []);

  const closeCalculator = useCallback(() => {
    setSubView("menu");
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("view") === "calculator") {
          url.searchParams.delete("view");
          window.history.replaceState({ subView: "menu" }, "", url.toString());
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("view") === "calculator") {
        setSubView("calculator");
      }
    }

    const onPopState = () => {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("view") === "calculator") {
        setSubView("calculator");
      } else {
        setSubView("menu");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Allow Escape key to return to settings menu
  useEffect(() => {
    if (subView !== "calculator") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCalculator();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [subView, closeCalculator]);

  const queryClient = useQueryClient();

  // Fetch the authoritative profile with TanStack Query (Supabase → localStorage fallback).
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getUserProfile(userId),
    enabled: !!userId,
    initialData: () => (userId ? getCachedUserProfile(userId) ?? undefined : undefined),
  });

  // Weight logs query for EMA trend & goal projection
  const { data: weightLogs = [] } = useQuery({
    queryKey: queryKeys.weightLogs(userId),
    queryFn: () => getWeightLogs(userId),
    enabled: !!userId,
    initialData: () => (userId ? getCachedWeightLogs(userId) : []),
  });

  // Today's meals query for dynamic daily calorie deficit & expected weight loss insight
  const todayDate = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => localDateString(todayDate), [todayDate]);
  const { data: todayMeals = [] } = useQuery({
    queryKey: queryKeys.meals(userId, todayDateKey),
    queryFn: () => fetchMealsForDay(todayDate, userId),
    enabled: !!userId,
  });

  const [weightInputOpen, setWeightInputOpen] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightNotice, setWeightNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profileData && !touchedRef.current) {
      setSaved(profileData);
      setForm(profileData);
    }
  }, [profileData]);

  const update = useCallback((patch: Partial<UserProfile>) => {
    touchedRef.current = true;
    setTouched(true);
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const maxSafePace = useMemo(() => maxSafeWeeklyPace(form.weight_kg), [form.weight_kg]);

  const effectiveTargetWeight = useMemo(() => {
    if (form.target_weight_kg != null && Number.isFinite(form.target_weight_kg)) {
      return form.target_weight_kg;
    }
    if (form.goal_type === "lose") {
      return Math.max(STAT_LIMITS.weight_kg.min, Math.round((form.weight_kg - 5) * 10) / 10);
    }
    if (form.goal_type === "gain") {
      return Math.min(STAT_LIMITS.weight_kg.max, Math.round((form.weight_kg + 5) * 10) / 10);
    }
    return form.weight_kg;
  }, [form.target_weight_kg, form.goal_type, form.weight_kg]);

  const effectivePace = useMemo(() => {
    const raw = form.weekly_pace_kg ?? 0.5;
    if (form.goal_type === "lose") {
      return Math.min(raw, maxSafePace);
    }
    return raw;
  }, [form.weekly_pace_kg, form.goal_type, maxSafePace]);

  const calc = useMemo(
    () =>
      calculateDailyTargets({
        gender: form.gender,
        age: form.age,
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        activity_level: form.activity_level,
        goal_type: form.goal_type,
        target_weight_kg: form.goal_type === "maintain" ? null : effectiveTargetWeight,
        weekly_pace_kg: effectivePace,
        diet_style: form.diet_style ?? "balanced",
      }),
    [
      form.gender,
      form.age,
      form.height_cm,
      form.weight_kg,
      form.activity_level,
      form.goal_type,
      effectiveTargetWeight,
      effectivePace,
      form.diet_style,
    ],
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

  const effective: UserProfile = {
    ...form,
    target_weight_kg: form.goal_type === "maintain" ? null : effectiveTargetWeight,
    weekly_pace_kg: effectivePace,
    diet_style: form.diet_style ?? "balanced",
    ...targets,
  };
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
    try {
      await logDailyWeight(userId, effective.weight_kg);
    } catch {
      // ignore
    }
    setForm(res.profile);
    setSaved(res.profile);
    touchedRef.current = false;
    setTouched(false);
    setSaving(false);
    setToast({ id: Date.now(), synced: res.synced });
    await invalidateUserProfile(queryClient, userId);
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

  // EMA weight trend & daily projection math for the Profile Weight Tracker card
  const emaData = useMemo(() => calculateWeightEMA(weightLogs), [weightLogs]);
  const currentWeightKg = emaData.latest_weight_kg ?? form.weight_kg;
  const emaWeightKg = emaData.ema_kg ?? currentWeightKg;
  const targetWeightKg =
    form.goal_type === "maintain" ? null : (form.target_weight_kg ?? effectiveTargetWeight);
  const todayTotals = useMemo(
    () => sumMacros(todayMeals.map((m) => m.totals)),
    [todayMeals],
  );
  const dailyDeficit = Math.round(calc.tdee - todayTotals.calories);
  const expectedDailyChangeKg = useMemo(
    () => estimateDailyWeightChangeKg(calc.tdee, todayTotals.calories),
    [calc.tdee, todayTotals.calories],
  );
  const expectedWeeklyChangeKg = Number((Math.abs(expectedDailyChangeKg) * 7).toFixed(2));

  const weightProgressPct = useMemo(() => {
    if (targetWeightKg == null) return 0;
    const startWeight = emaData.points.length > 0 ? emaData.points[0].weight_kg : currentWeightKg;
    const totalSpan = Math.abs(startWeight - targetWeightKg);
    const remaining = Math.abs(emaWeightKg - targetWeightKg);
    if (remaining <= 0.05) return 100;
    if (totalSpan <= 0.1) return 12;
    const completed = Math.max(0, totalSpan - remaining);
    return Math.min(100, Math.max(8, Math.round((completed / totalSpan) * 100)));
  }, [targetWeightKg, emaData.points, currentWeightKg, emaWeightKg]);

  function openWeightLogger() {
    setWeightDraft(String(currentWeightKg));
    setWeightInputOpen((v) => !v);
  }

  async function handleSaveDailyWeight(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const normalized = toLatinNumber(weightDraft);
    const parsed = parseFloat(normalized);
    if (
      !Number.isFinite(parsed) ||
      parsed < STAT_LIMITS.weight_kg.min ||
      parsed > STAT_LIMITS.weight_kg.max
    ) {
      return;
    }
    const rounded = Math.round(parsed * 10) / 10;
    setWeightSaving(true);
    try {
      await logDailyWeight(userId, rounded, todayDateKey);
      const updatedProfile = getCachedUserProfile(userId);
      if (updatedProfile) {
        setForm(updatedProfile);
        setSaved(updatedProfile);
      } else {
        setForm((prev) => ({ ...prev, weight_kg: rounded }));
      }
      await invalidateUserProfile(queryClient, userId);
      setWeightInputOpen(false);
      setWeightNotice(`تم تسجيل وزن اليوم (${rounded.toFixed(1)} كجم) وتحديث خط الاتجاه ✓`);
      window.setTimeout(() => setWeightNotice(null), 3500);
    } finally {
      setWeightSaving(false);
    }
  }

  return (
    <div className="max-w-md w-full mx-auto min-h-screen flex flex-col pb-28">
      <header className="h-16 px-4 flex items-center justify-between sticky top-0 z-10 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        {subView === "menu" ? (
          <div className="flex flex-col">
            <h1 className="text-[18px] font-bold text-on-surface leading-tight">حسابي</h1>
            <span className="text-[12px] text-on-surface-variant">بياناتك وأهدافك وإعدادات التطبيق</span>
          </div>
        ) : (
          <>
            <button
              id="profile-back-to-menu"
              type="button"
              onClick={closeCalculator}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-95 transition-all text-[13px] font-semibold ${focusRing}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] rtl:rotate-180">
                arrow_back
              </span>
              <span>رجوع للإعدادات</span>
            </button>
            <div className="flex flex-col text-end">
              <h1 className="text-[16px] font-bold text-on-surface leading-tight">حساب السعرات والأهداف</h1>
              <span className="text-[11px] text-on-surface-variant">معادلة ميفلين-سانت جور</span>
            </div>
          </>
        )}
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
        {profileLoading ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="جارٍ تحميل ملفك الشخصي…">
            <div className="h-56 rounded-[20px] bg-surface-container animate-pulse" />
            <div className="h-72 rounded-[20px] bg-surface-container animate-pulse" />
          </div>
        ) : subView === "menu" ? (
          /* ================================================================ */
          /* MAIN SETTINGS MENU VIEW                                          */
          /* ================================================================ */
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* ---------- Calorie & Target Calculation Navigation Card ---------- */}
            <section aria-labelledby={`${uid}-menu-targets`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-menu-targets`}>الأهداف والتغذية</SectionHeading>

              <button
                id="open-calculator-btn"
                type="button"
                onClick={openCalculator}
                className={`${card} p-4 text-start flex flex-col gap-3 group hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer ${focusRing}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-on-primary"
                    >
                      <span className="material-symbols-outlined text-[24px]">calculate</span>
                    </span>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-[16px] font-bold text-on-surface group-hover:text-primary transition-colors">
                        حساب السعرات والأهداف اليومية
                      </h3>
                      <p className="text-[13px] text-on-surface-variant truncate mt-0.5">
                        هدفك الحالي: {fmt(targets.target_calories)} سعرة يومياً • اضغط للتعديل
                      </p>
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className="w-9 h-9 shrink-0 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  </span>
                </div>

                {/* Badges / summary */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/20 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-semibold tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {fmt(targets.target_calories)} سعرة
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-medium">
                    {form.goal_type === "lose"
                      ? "خسارة وزن"
                      : form.goal_type === "gain"
                        ? "زيادة وزن وعضل"
                        : "المحافظة على الوزن"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-[11px] ms-auto">
                    بروتين {targets.target_protein_g}جم • كارب {targets.target_carbs_g}جم • دهون {targets.target_fat_g}جم
                  </span>
                </div>
              </button>

              {/* ---------- Smart Weight Tracker & Daily Projection Card ---------- */}
              <div
                aria-label="متتبع الوزن والتوقع اليومي"
                className={`${card} p-4 flex flex-col gap-3 mt-1`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-10 h-10 shrink-0 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[20px]">monitoring</span>
                    </span>
                    <div className="flex flex-col">
                      <h3 className="text-[15px] font-bold text-on-surface leading-tight">
                        متتبع الوزن والتوقع اليومي
                      </h3>
                      <span className="text-[11px] text-on-surface-variant">
                        خط الاتجاه يخفي تذبذب الماء والأملاح
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openWeightLogger}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary text-[12px] font-bold transition-colors active:scale-95 shrink-0 ${focusRing}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {weightInputOpen ? "close" : "add"}
                    </span>
                    <span>{weightInputOpen ? "إغلاق" : "+ سجل وزن اليوم"}</span>
                  </button>
                </div>

                {weightNotice && (
                  <div
                    role="status"
                    className="p-2.5 rounded-xl bg-primary-fixed text-on-primary-fixed text-[12px] font-semibold flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      check_circle
                    </span>
                    <span>{weightNotice}</span>
                  </div>
                )}

                {/* Inline quick weight logger */}
                {weightInputOpen && (
                  <form
                    onSubmit={handleSaveDailyWeight}
                    className="flex items-center gap-2 p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 animate-fade-in"
                  >
                    <label htmlFor="profile-quick-weight-input" className="text-[13px] font-semibold text-on-surface ps-1">
                      وزن اليوم:
                    </label>
                    <div className="flex items-center gap-1 ms-auto" dir="ltr">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(weightDraft) || currentWeightKg;
                          setWeightDraft((Math.round((cur - 0.1) * 10) / 10).toFixed(1));
                        }}
                        aria-label="إنقاص 0.1 كجم"
                        className="w-8 h-8 rounded-lg bg-surface-container-lowest dark:bg-surface-container-high text-on-surface flex items-center justify-center shadow-sm active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <input
                        id="profile-quick-weight-input"
                        type="text"
                        inputMode="decimal"
                        value={weightDraft}
                        onChange={(e) => setWeightDraft(e.target.value)}
                        className="w-16 h-8 text-center font-bold text-[15px] tabular-nums bg-surface-container-lowest dark:bg-surface-container-high text-on-surface rounded-lg border border-outline-variant/40 focus-visible:outline-2 focus-visible:outline-primary"
                      />
                      <span className="text-[11px] text-on-surface-variant">كجم</span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = parseFloat(weightDraft) || currentWeightKg;
                          setWeightDraft((Math.round((cur + 0.1) * 10) / 10).toFixed(1));
                        }}
                        aria-label="زيادة 0.1 كجم"
                        className="w-8 h-8 rounded-lg bg-surface-container-lowest dark:bg-surface-container-high text-on-surface flex items-center justify-center shadow-sm active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={weightSaving}
                      className="h-8 px-3.5 rounded-xl bg-primary text-on-primary text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-60"
                    >
                      {weightSaving ? "..." : "حفظ"}
                    </button>
                  </form>
                )}

                {/* Current Weight vs EMA Trend */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col gap-0.5">
                    <span className="text-[11px] text-on-surface-variant">الوزن الحالي</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[20px] font-bold tabular-nums text-on-surface">
                        {currentWeightKg.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">كجم</span>
                    </div>
                  </div>
                  <div
                    className="p-3 rounded-2xl bg-primary-fixed/30 dark:bg-primary-fixed/20 border border-primary/20 flex flex-col gap-0.5"
                    title="خط الاتجاه يخفي تذبذب الماء والأملاح"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-primary">خط الاتجاه الحقيقي (EMA)</span>
                      {emaData.points.length > 1 && emaData.trend_7d_kg !== 0 && (
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                            emaData.trend_7d_kg < 0
                              ? "bg-primary/15 text-primary"
                              : "bg-tertiary-container/40 text-on-surface"
                          }`}
                        >
                          {emaData.trend_7d_kg > 0 ? `+${emaData.trend_7d_kg}` : emaData.trend_7d_kg} kg
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[20px] font-bold tabular-nums text-primary">
                        {emaWeightKg.toFixed(2)}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">كجم</span>
                    </div>
                  </div>
                </div>

                {/* Progress toward target_weight_kg */}
                {targetWeightKg != null ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-on-surface-variant">
                        الهدف: <strong className="text-on-surface tabular-nums">{targetWeightKg} كجم</strong>{" "}
                        (باقي {Math.abs(emaWeightKg - targetWeightKg).toFixed(1)} كجم)
                      </span>
                      {Math.abs(emaWeightKg - targetWeightKg) > 0.05 && (
                        <span className="text-[11px] text-primary font-semibold">
                          الوصول المتوقع:{" "}
                          {new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short" }).format(
                            estimateGoalDate(emaWeightKg, targetWeightKg, effectivePace),
                          )}{" "}
                          (~{estimateWeeksToGoal(emaWeightKg, targetWeightKg, effectivePace)} أسبوع)
                        </span>
                      )}
                    </div>
                    <div
                      className="w-full h-2 rounded-full bg-surface-container overflow-hidden"
                      role="progressbar"
                      aria-label="التقدم نحو الوزن المستهدف"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={weightProgressPct}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${weightProgressPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openCalculator}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-[12px] text-on-surface-variant transition-colors cursor-pointer ${focusRing}`}
                  >
                    <span>حدد وزنك المستهدف وسرعة الوصول لحساب تاريخ تحقيق هدفك</span>
                    <span className="text-primary font-bold">ضبط الهدف ←</span>
                  </button>
                )}

                {/* Dynamic daily calorie deficit & expected weight loss insight */}
                <div className="flex items-start gap-2 pt-2 border-t border-outline-variant/20 text-[12px]">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                    insights
                  </span>
                  <p className="text-on-surface-variant leading-relaxed">
                    {todayTotals.calories === 0 ? (
                      <span>سجّل وجباتك اليوم لحساب عجزك وتوقع نزول وزنك اليومي والأسبوعي.</span>
                    ) : dailyDeficit >= 0 ? (
                      <span>
                        بناءً على سعراتك اليوم، عجزك{" "}
                        <strong className="text-on-surface tabular-nums">{fmt(dailyDeficit)}</strong> سعرة (توقع نزول{" "}
                        <strong className="text-primary tabular-nums">~{expectedWeeklyChangeKg} كجم</strong> هذا الأسبوع •{" "}
                        <span className="tabular-nums" dir="ltr">
                          -{Math.abs(expectedDailyChangeKg).toFixed(3)} kg
                        </span>{" "}
                        اليوم)
                      </span>
                    ) : (
                      <span>
                        بناءً على سعراتك اليوم، فائضك{" "}
                        <strong className="text-on-surface tabular-nums">{fmt(Math.abs(dailyDeficit))}</strong> سعرة (توقع زيادة{" "}
                        <strong className="text-tertiary tabular-nums">~{expectedWeeklyChangeKg} كجم</strong> هذا الأسبوع)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </section>

          </div>
        ) : (
          /* ================================================================ */
          /* CALORIE & BODY STATS CALCULATOR SUB-VIEW                         */
          /* ================================================================ */
          <div className="flex flex-col gap-6 animate-fade-in">
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
                          onChange={() => {
                            const nextGoal = o.value;
                            let nextTarget = form.target_weight_kg;
                            if (nextGoal === "lose" && (nextTarget == null || nextTarget >= form.weight_kg)) {
                              nextTarget = Math.max(
                                STAT_LIMITS.weight_kg.min,
                                Math.round((form.weight_kg - 5) * 10) / 10,
                              );
                            } else if (
                              nextGoal === "gain" &&
                              (nextTarget == null || nextTarget <= form.weight_kg)
                            ) {
                              nextTarget = Math.min(
                                STAT_LIMITS.weight_kg.max,
                                Math.round((form.weight_kg + 5) * 10) / 10,
                              );
                            }
                            update({ goal_type: nextGoal, target_weight_kg: nextTarget });
                          }}
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

              {/* Target Weight & Weekly Pace (when goal is lose or gain) */}
              {(form.goal_type === "lose" || form.goal_type === "gain") && (
                <div className="flex flex-col gap-4 mt-3 animate-fade-in">
                  {/* Target weight stepper + motivating badge */}
                  <div className={`${card} p-3 flex flex-col gap-2`}>
                    <NumberStepper
                      id={`${uid}-target-weight`}
                      name="target_weight_kg"
                      label="الوزن المستهدف (كجم)"
                      unit="كجم"
                      value={effectiveTargetWeight}
                      min={STAT_LIMITS.weight_kg.min}
                      max={STAT_LIMITS.weight_kg.max}
                      step={0.5}
                      decimals={1}
                      onChange={(n) => update({ target_weight_kg: n })}
                    />
                    <div className="px-3 pb-1 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/60 dark:bg-primary-fixed/40 text-on-primary-fixed text-[12px] font-semibold">
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary">
                          flag
                        </span>
                        <span>
                          باقي لك{" "}
                          <strong className="tabular-nums">
                            {fmtKg(Math.abs(form.weight_kg - effectiveTargetWeight))}
                          </strong>{" "}
                          كجم للوصول لهدفك
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Weekly pace selector cards */}
                  <fieldset className="flex flex-col gap-2 min-w-0">
                    <legend className="text-[13px] font-semibold text-on-surface-variant px-1 mb-1">
                      سرعة الوصول للهدف
                    </legend>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PACE_OPTIONS.map((p) => {
                        const exceedsSafe = form.goal_type === "lose" && p.value > maxSafePace;
                        const checked = Math.abs(effectivePace - p.value) < 0.01;
                        return (
                          <label
                            key={p.value}
                            aria-disabled={exceedsSafe}
                            className={`relative flex flex-col gap-1 p-3.5 rounded-2xl border select-none transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                              exceedsSafe
                                ? "opacity-45 cursor-not-allowed border-outline-variant/25 bg-surface-container-low"
                                : checked
                                  ? "cursor-pointer border-primary bg-primary-fixed/35 dark:bg-primary-fixed/50 shadow-sm"
                                  : "cursor-pointer border-outline-variant/40 bg-surface-container-lowest hover:border-primary/30"
                            }`}
                          >
                            <input
                              type="radio"
                              name="weekly_pace_kg"
                              value={p.value}
                              disabled={exceedsSafe}
                              checked={checked}
                              onChange={() => {
                                if (!exceedsSafe) update({ weekly_pace_kg: p.value });
                              }}
                              className="sr-only"
                            />
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="flex items-center gap-1.5 text-[14px] font-bold text-on-surface">
                                <span aria-hidden="true">{p.emoji}</span>
                                <span>{p.title}</span>
                              </span>
                              {p.recommended && !exceedsSafe && (
                                <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                                  موصى به
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] text-on-surface-variant tabular-nums">
                              {p.subtitle}
                            </span>
                            {exceedsSafe && (
                              <span className="text-[10px] text-error font-medium mt-0.5">
                                يتجاوز الحد الآمن لوزنك (~1% أسبوعياً)
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Immediate Expected Duration & Goal Date Banner */}
                    {Math.abs(form.weight_kg - effectiveTargetWeight) > 0.05 && (
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/25 text-[12px]">
                        <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">
                            event_available
                          </span>
                          <span>
                            الوصول المتوقع خلال ~
                            {estimateWeeksToGoal(form.weight_kg, effectiveTargetWeight, effectivePace)} أسابيع
                          </span>
                        </span>
                        <span className="text-on-surface-variant">
                          ({new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(
                            estimateGoalDate(form.weight_kg, effectiveTargetWeight, effectivePace),
                          )})
                        </span>
                      </div>
                    )}
                    {form.goal_type === "lose" && maxSafePace < 1.0 && (
                      <p className="text-[11px] text-on-surface-variant px-1">
                        ملاحظة: لحماية الكتلة العضلية وصحتك، الحد الآمن للنزول لوزنك الحالي هو{" "}
                        <span className="font-semibold tabular-nums">{maxSafePace.toFixed(2)} كجم/أسبوع</span>.
                      </p>
                    )}
                  </fieldset>
                </div>
              )}

              {/* Diet style selector cards */}
              <fieldset className="flex flex-col gap-2 mt-3 min-w-0">
                <legend className="text-[13px] font-semibold text-on-surface-variant px-1 mb-2">
                  نظام توزيع الأكل
                </legend>
                <div className="flex flex-col gap-2">
                  {DIET_STYLE_OPTIONS.map((d) => {
                    const checked = (form.diet_style ?? "balanced") === d.value;
                    return (
                      <label
                        key={d.value}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer select-none transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                          checked
                            ? "border-primary bg-primary-fixed/35 dark:bg-primary-fixed/50 shadow-sm"
                            : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="diet_style"
                          value={d.value}
                          checked={checked}
                          onChange={() => update({ diet_style: d.value })}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-low text-on-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{d.icon}</span>
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="text-[14px] font-bold text-on-surface">{d.title}</span>
                          <span className="text-[12px] text-on-surface-variant">{d.subtitle}</span>
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
                      value={fmt(Math.abs(calc.adjustment))}
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
                    رُفع الهدف إلى الحد الأدنى الآمن ({fmt(calc.minCalories)} سعرة).
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
          </div>
        )}

        {subView === "menu" && (
          <>
            {/* ---------- App Settings (Theme) ---------- */}
            <section aria-labelledby={`${uid}-app`} className="flex flex-col gap-2">
              <SectionHeading id={`${uid}-app`}>إعدادات التطبيق</SectionHeading>
              <div className={`${card} p-4 flex flex-col gap-2`}>
                <span aria-hidden="true" className="text-[15px] text-on-surface">
                  المظهر
                </span>
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
          </>
        )}
      </main>
    </div>
  );
}
