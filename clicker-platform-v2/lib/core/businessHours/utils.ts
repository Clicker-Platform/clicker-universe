import { DaySchedule, TimeRange } from '../types';

/**
 * Helper to convert "HH:MM" string to minutes from midnight
 */
function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Helper to check if a specific time (in minutes) is within a range
 */
function isWithinRange(minutes: number, range: TimeRange): boolean {
    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    return minutes >= start && minutes < end;
}

/**
 * Checks if the business is open at a specific Date/Time.
 */
export function isBusinessOpen(date: Date, schedule: DaySchedule[]): boolean {
    if (!schedule || schedule.length === 0) return true; // Default to open if no schedule defined (backward compatibility)

    const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const dayConfig = schedule.find(d => d.dayOfWeek === dayOfWeek);

    // If no config for this day, assume closed or open? 
    // Usually explicit configuration is better. Let's assume closed if missing from strict schedule.
    if (!dayConfig || !dayConfig.isOpen) return false;

    const currentMinutes = date.getHours() * 60 + date.getMinutes();

    // Must be within at least one 'hours' window
    const inHours = dayConfig.hours.some(range => isWithinRange(currentMinutes, range));
    if (!inHours) return false;

    // Must NOT be within any 'break' window
    if (dayConfig.breaks && dayConfig.breaks.length > 0) {
        const inBreak = dayConfig.breaks.some(range => isWithinRange(currentMinutes, range));
        if (inBreak) return false;
    }

    return true;
}

/**
 * Returns the valid operating windows for a given date.
 * Subtracts breaks from open hours.
 */
export function getOperatingWindows(date: Date, schedule: DaySchedule[]): TimeRange[] {
    if (!schedule) return [];

    const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const dayConfig = schedule.find(d => d.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.isOpen || !dayConfig.hours) return [];

    // If no breaks, just return the hours
    if (!dayConfig.breaks || dayConfig.breaks.length === 0) {
        return dayConfig.hours;
    }

    // Flatten logic: Subtract breaks from hours
    // This can get complex (split one range into two).
    // For MVP, let's assume simple cases or implement a subtraction algorithm.

    let windows: { start: number, end: number }[] = dayConfig.hours.map(h => ({
        start: toMinutes(h.start),
        end: toMinutes(h.end)
    }));

    const breaks = dayConfig.breaks.map(b => ({
        start: toMinutes(b.start),
        end: toMinutes(b.end)
    }));

    // Subtract breaks
    for (const brk of breaks) {
        const newWindows: { start: number, end: number }[] = [];
        for (const window of windows) {
            // Case 1: Break is outside window -> Keep window
            if (brk.end <= window.start || brk.start >= window.end) {
                newWindows.push(window);
                continue;
            }

            // Case 2: Break is inside window -> Split window
            if (brk.start > window.start) {
                newWindows.push({ start: window.start, end: brk.start });
            }
            if (brk.end < window.end) {
                newWindows.push({ start: brk.end, end: window.end });
            }
        }
        windows = newWindows;
    }

    // Convert back to strings
    return windows.sort((a, b) => a.start - b.start).map(w => ({
        start: toTimeStr(w.start),
        end: toTimeStr(w.end)
    }));
}

function toTimeStr(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
