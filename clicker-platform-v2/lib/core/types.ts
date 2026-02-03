
export interface TimeRange {
    start: string; // "09:00"
    end: string;   // "17:00"
}

export interface DaySchedule {
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
    isOpen: boolean;
    hours: TimeRange[];
    breaks?: TimeRange[]; // Optional
}
