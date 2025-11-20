/**
 * Get current date/time in IST
 * Returns a Date object where the UTC time has been shifted by IST offset
 * This allows using getHours(), getMinutes(), etc. to get IST values
 * while still being compatible with database timestamp comparisons
 */
export function getIstDate(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds
  return new Date(now.getTime() + istOffset);
}

/**
 * Get IST date components (year, month, day, hour, minute) from a UTC Date
 * Use this for generating period IDs or displaying IST time
 */
export function getIstComponents(date: Date = new Date()) {
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    day: istDate.getUTCDate(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    timestamp: istDate.getTime()
  };
}