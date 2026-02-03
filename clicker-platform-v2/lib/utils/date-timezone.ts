
import { toZonedTime, format as formatZoned, fromZonedTime } from 'date-fns-tz';

export const RESTAURANT_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns a Date object representing the current time in the restaurant's timezone.
 */
export function getRestaurantDate(date?: Date | string | number): Date {
    const d = date ? new Date(date) : new Date();
    return toZonedTime(d, RESTAURANT_TIMEZONE);
}

/**
 * Formats a date string specifically for the restaurant's timezone.
 */
export function formatRestaurantDate(date: Date, formatStr: string): string {
    return formatZoned(date, formatStr, { timeZone: RESTAURANT_TIMEZONE });
}

/**
 * Helper to get the start of the "Business Day" in the Restaurant's timezone.
 * Returns a Date object (absolute timestamp) that corresponds to startHour:00 on the correct business day.
 */
export function getBusinessDayStart(date: Date, startHour: number): Date {
    // 1. Get the "Wall Clock" time parts in the target timezone
    // We use formatZoned to extract exact Y-M-D H components as they appear on a clock in Jakarta
    const zonedParts = formatZoned(date, 'yyyy-MM-dd-H', { timeZone: RESTAURANT_TIMEZONE }).split('-');

    let year = parseInt(zonedParts[0]);
    let month = parseInt(zonedParts[1]); // 1-12
    let day = parseInt(zonedParts[2]);
    const hour = parseInt(zonedParts[3]);

    // 2. Adjust for business day logic
    // If it's 2 AM and start hour is 4 AM, this belongs to the *previous* calendar day's business shift.
    if (hour < startHour) {
        // Decrement day. We can rely on JS Date auto-correction if we do it carefully,
        // but cleaner to just subtract 24h from the final timestamp OR just shift the date params.
        const prev = new Date(year, month - 1, day - 1); // JS Date Month is 0-indexed
        year = prev.getFullYear();
        month = prev.getMonth() + 1;
        day = prev.getDate();
    }

    // 3. Construct the "Start Time" string for that business day
    // Format: "YYYY-MM-DD HH:00:00"
    const startString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(startHour).padStart(2, '0')}:00:00`;

    // 4. Convert this Wall Time back to a proper UTC Timestamp
    return fromZonedTime(startString, RESTAURANT_TIMEZONE);
}
