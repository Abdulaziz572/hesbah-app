import MealFlow from "@/src/components/MealFlow";

export default async function AddMealPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { date } = await searchParams;
  // Optional ?date=YYYY-MM-DD: log a missed meal on a past day picked in the Diary calendar.
  return <MealFlow targetDateKey={typeof date === "string" ? date : undefined} />;
}
