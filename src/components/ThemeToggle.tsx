"use client";

import { useTheme } from "@/src/context/ThemeContext";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-primary flex items-center justify-center transition-all active:scale-90"
    >
      <span className="material-symbols-outlined text-[20px]" suppressHydrationWarning>
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
