/** Get end of current day in UTC */
export function getEndOfDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
}

/** Get end of current month in UTC */
export function getEndOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** Check if a date has passed */
export function isExpired(date: string | Date | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}

/** Add days to a date */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Safe ISO string conversion */
export function toISOString(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toISOString();
}

/** Parse date string safely */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
