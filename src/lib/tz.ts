/**
 * Timezone helpers tuned for restaurants in a single IANA zone (default
 * Asia/Ho_Chi_Minh, which has no DST). For zones that observe DST the
 * computed offset here is still correct because `tzOffsetMinutes` reads the
 * offset for the specific instant passed in.
 *
 * All DB timestamps are stored in UTC; we only translate to the tenant's
 * local calendar when computing day/hour buckets or "start of today".
 */

export const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

/** Minutes east of UTC for the given tz at the given instant. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const utcFmt = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzFmt = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  return (tzFmt.getTime() - utcFmt.getTime()) / 60000;
}

/** Start of the day containing `date` in the given tz, returned as a UTC Date. */
export function tzDayStart(date: Date, tz: string): Date {
  const offset = tzOffsetMinutes(date, tz);
  const shifted = new Date(date.getTime() + offset * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offset * 60000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * Resolve a preset range into {from, to} UTC bounds interpreted in tenant tz.
 * `to` is exclusive (start of the next day after the inclusive end).
 */
export function resolveRange(
  preset: "TODAY" | "WEEK" | "MONTH" | "CUSTOM",
  tz: string,
  customFrom?: string | null,
  customTo?: string | null,
): { from: Date; to: Date } {
  const now = new Date();
  const todayStart = tzDayStart(now, tz);
  const tomorrowStart = addDays(todayStart, 1);
  switch (preset) {
    case "TODAY":
      return { from: todayStart, to: tomorrowStart };
    case "WEEK":
      return { from: addDays(todayStart, -6), to: tomorrowStart };
    case "MONTH":
      return { from: addDays(todayStart, -29), to: tomorrowStart };
    case "CUSTOM": {
      const from = customFrom ? tzDayStart(new Date(customFrom), tz) : todayStart;
      const to = customTo
        ? addDays(tzDayStart(new Date(customTo), tz), 1)
        : tomorrowStart;
      return { from, to };
    }
  }
}
