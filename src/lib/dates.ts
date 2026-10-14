/** Local-timezone date helpers shared by the data layer and the Diary calendar UI. */

/** Week starts on Saturday (Saudi convention). 0 = Sunday … 6 = Saturday. */
export const WEEK_START_DAY = 6;

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the device's local timezone. */
export function localDateString(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD key into a local-midnight Date (null if malformed). */
export function parseDateKey(key: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return localDateString(d) === key ? d : null;
}

/** Local 00:00:00.000 of the given date. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local 23:59:59.999 of the given date. */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfWeek(d: Date): Date {
  const diff = (d.getDay() - WEEK_START_DAY + 7) % 7;
  return addDays(startOfDay(d), -diff);
}

export const isSameDay = (a: Date, b: Date) => localDateString(a) === localDateString(b);

/** Every day (local midnight) from start to end inclusive. */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export const AR_WEEKDAYS_SHORT = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

export function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric" }).format(d);
}

export function formatDayFull(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

