

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date). */
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Noon on the given YYYY-MM-DD, safe from DST edges. */
export const parseDateKey = (key: string) => new Date(`${key}T12:00:00`);

export function daysAgo(count: number, from = new Date()): Date {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - count);
  return date;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const shortDate = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;
