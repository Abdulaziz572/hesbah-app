"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "اليوميات", icon: "book_2" },
  { href: "/add", label: "إضافة وجبة", icon: "add_circle" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 inset-x-0 z-20 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/40 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="max-w-md mx-auto flex">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-16 text-[12px] font-semibold transition-colors ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span
                  className={`px-5 py-1 rounded-full transition-colors ${active ? "bg-primary-fixed" : ""}`}
                >
                  <span
                    className="material-symbols-outlined text-[24px]"
                    style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}` }}
                  >
                    {t.icon}
                  </span>
                </span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
