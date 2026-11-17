import type { Reading, Utility } from './meter-api.service';

const millisecondsPerDay = 86_400_000;

export interface UsageInterval {
    utility: Utility;
    from: string;
    to: string;
    consumption: number;
    days: number;
}

export interface UsageSummary {
    consumption: number;
    days: number;
    perDay: number | null;
}

export function createUsageIntervals(readings: Reading[]): UsageInterval[] {
    const intervals: UsageInterval[] = [];

    for (const utility of ['electricity', 'gas', 'water'] as const) {
        const readingsByDate = new Map<string, Reading>();
        const sorted = readings
            .filter((reading) => reading.utility === utility)
            .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id - right.id);

        for (const reading of sorted) {
            readingsByDate.set(reading.recordedAt.slice(0, 10), reading);
        }

        const datedReadings = [...readingsByDate.values()];
        for (let index = 1; index < datedReadings.length; index += 1) {
            const previous = datedReadings[index - 1];
            const current = datedReadings[index];
            const from = previous.recordedAt.slice(0, 10);
            const to = current.recordedAt.slice(0, 10);
            const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / millisecondsPerDay;
            if (days <= 0) continue;

            const previousValue = Number(previous.value);
            const currentValue = Number(current.value);
            if (currentValue < previousValue) continue;

            intervals.push({
                utility,
                from,
                to,
                consumption: currentValue - previousValue,
                days,
            });
        }
    }

    return intervals;
}

export function bucketUsageByDate(
    intervals: UsageInterval[],
    period: 'month' | 'year',
): Map<string, UsageSummary> {
    const buckets = new Map<string, { consumption: number; days: number }>();

    for (const interval of intervals) {
        let cursor = Date.parse(`${interval.from}T00:00:00Z`);
        const end = Date.parse(`${interval.to}T00:00:00Z`);

        while (cursor < end) {
            const date = new Date(cursor);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const key = period === 'year'
                ? String(year)
                : `${year}-${String(month + 1).padStart(2, '0')}`;
            const nextBoundary = period === 'year'
                ? Date.UTC(year + 1, 0, 1)
                : Date.UTC(year, month + 1, 1);
            const segmentEnd = Math.min(end, nextBoundary);
            const segmentDays = (segmentEnd - cursor) / millisecondsPerDay;
            const bucket = buckets.get(key) ?? { consumption: 0, days: 0 };

            bucket.consumption += interval.consumption * segmentDays / interval.days;
            bucket.days += segmentDays;
            buckets.set(key, bucket);
            cursor = segmentEnd;
        }
    }

    return new Map([...buckets].map(([key, bucket]) => [key, {
        ...bucket,
        perDay: bucket.days > 0 ? bucket.consumption / bucket.days : null,
    }]));
}

export function summarizeUsage(
    intervals: UsageInterval[],
    utility: Utility,
    year?: number,
): UsageSummary {
    const selected = intervals.filter((interval) => interval.utility === utility);
    if (year !== undefined) {
        return bucketUsageByDate(selected, 'year').get(String(year)) ?? { consumption: 0, days: 0, perDay: null };
    }

    const consumption = selected.reduce((total, interval) => total + interval.consumption, 0);
    const days = selected.reduce((total, interval) => total + interval.days, 0);
    return { consumption, days, perDay: days > 0 ? consumption / days : null };
}

export function summarizeUsageSinceFirstReading(
    readings: Reading[],
    intervals: UsageInterval[],
    utility: Utility,
    year: number,
): UsageSummary {
    const firstReadingDate = readings
        .filter((reading) => reading.utility === utility && reading.recordedAt.startsWith(String(year)))
        .map((reading) => reading.recordedAt.slice(0, 10))
        .sort()[0];

    if (!firstReadingDate) return { consumption: 0, days: 0, perDay: null };

    const sinceFirstReading = intervals.filter((interval) =>
        interval.utility === utility && interval.from >= firstReadingDate,
    );
    return bucketUsageByDate(sinceFirstReading, 'year').get(String(year))
        ?? { consumption: 0, days: 0, perDay: null };
}

export function summarizeUsageSinceMeterReset(
    readings: Reading[],
    intervals: UsageInterval[],
    utility: Utility,
): UsageSummary {
    const sortedReadings = readings
        .filter((reading) => reading.utility === utility)
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id - right.id);
    const baseline = [...sortedReadings].reverse().find((reading) => Number(reading.value) === 0)
        ?? sortedReadings[0];

    if (!baseline) return { consumption: 0, days: 0, perDay: null };

    const startDate = baseline.recordedAt.slice(0, 10);
    const selected = intervals.filter((interval) => interval.utility === utility && interval.from >= startDate);
    const consumption = selected.reduce((total, interval) => total + interval.consumption, 0);
    const days = selected.reduce((total, interval) => total + interval.days, 0);
    return { consumption, days, perDay: days > 0 ? consumption / days : null };
}

export function averageUsageByReadingDate(readings: Reading[], utility: Utility): Map<string, number | null> {
    const readingsByDate = new Map<string, Reading>();
    const sortedReadings = readings
        .filter((reading) => reading.utility === utility)
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id - right.id);

    for (const reading of sortedReadings) {
        readingsByDate.set(reading.recordedAt.slice(0, 10), reading);
    }

    const averages = new Map<string, number | null>();
    let previous: Reading | undefined;
    let consumption = 0;
    let days = 0;

    for (const current of readingsByDate.values()) {
        const date = current.recordedAt.slice(0, 10);
        if (Number(current.value) === 0) {
            consumption = 0;
            days = 0;
            averages.set(date, null);
            previous = current;
            continue;
        }

        if (previous) {
            const previousDate = previous.recordedAt.slice(0, 10);
            const intervalDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previousDate}T00:00:00Z`))
                / millisecondsPerDay;
            const previousValue = Number(previous.value);
            const currentValue = Number(current.value);

            if (intervalDays > 0 && currentValue >= previousValue) {
                consumption += currentValue - previousValue;
                days += intervalDays;
            }
        }

        averages.set(date, days > 0 ? consumption / days : null);
        previous = current;
    }

    return averages;
}