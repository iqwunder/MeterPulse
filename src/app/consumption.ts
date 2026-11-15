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