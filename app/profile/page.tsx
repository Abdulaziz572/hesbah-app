import type { Metadata } from "next";
import ProfileSettings from "@/src/components/ProfileSettings";

export const metadata: Metadata = {
  title: "حسابي | حسبة",
  description: "اضبط بيانات جسمك وهدفك لحساب سعراتك ومغذياتك اليومية، وغيّر مظهر التطبيق.",
};

// AuthGuard + BottomNav are applied globally in app/layout.tsx.
export default function ProfilePage() {
  return <ProfileSettings />;
}
