"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import BottomNav from "@/src/components/BottomNav";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if (!user && !isAuthPage) {
      router.replace("/login");
    } else if (user && isAuthPage) {
      router.replace("/");
    }
  }, [user, loading, isAuthPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center animate-pulse shadow-sm">
          <span className="material-symbols-outlined text-primary text-[32px]">nutrition</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[18px] font-bold text-on-surface">حسبة</span>
          <span className="text-[12px] text-on-surface-variant">متتبع التغذية الذكي</span>
        </div>
      </div>
    );
  }

  // Prevent flicker of protected content before redirect
  if (!user && !isAuthPage) {
    return null;
  }

  // Prevent flicker of login page if already authenticated
  if (user && isAuthPage) {
    return null;
  }

  return (
    <>
      {children}
      {user && !isAuthPage && <BottomNav />}
    </>
  );
}
