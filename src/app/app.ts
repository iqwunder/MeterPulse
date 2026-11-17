import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  averageUsageByReadingDate,
  bucketUsageByDate,
  createUsageIntervals,
  summarizeUsage,
  summarizeUsageSinceFirstReading,
  summarizeUsageSinceMeterReset,
} from './consumption';
import { MeterApiService, PvReading, Reading, Utility } from './meter-api.service';

type Period = 'all' | 'year';
const utilities: Utility[] = ['electricity', 'gas', 'water'];

@Component({
  imports: [CommonModule, FormsModule, BaseChartDirective],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './dashboard.html',
})
export class App {
  private readonly api = inject(MeterApiService);

  protected readonly utilities = utilities;
  protected readonly readings = signal<Reading[]>([]);
  protected readonly pvReadings = signal<PvReading[]>([]);
  protected readonly loading = signal(true);
  protected readonly pvLoading = signal(true);
  protected readonly apiError = signal('');
  protected readonly pvApiError = signal('');
  protected readonly notice = signal('');
  protected readonly pvNotice = signal('');
  protected readonly dialogOpen = signal(false);
  protected readonly helpOpen = signal(false);
  protected readonly readingsOpen = signal(false);
  protected readonly pvOpen = signal(false);
  protected readonly pvImporting = signal(false);
  protected readonly readingUtility = signal<Utility>('electricity');
  protected readonly period = signal<Period>('all');
  protected readonly selectedUtility = signal<Utility>('electricity');
  protected readonly selectedAnnualUtility = signal<Utility>('electricity');
  protected readonly currentYear = new Date().getFullYear();
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly years = computed(() => {
    const readingYears = this.readings().map((reading) => Number(reading.recordedAt.slice(0, 4)));
    return [...new Set([new Date().getFullYear(), ...readingYears])].sort((a, b) => b - a);
  });
  protected readonly recordedYears = computed(() => [...new Set(
    this.readings().map((reading) => Number(reading.recordedAt.slice(0, 4))),
  )].sort((a, b) => b - a));
  protected readonly usageIntervals = computed(() => createUsageIntervals(this.readings()));
  protected readonly currentYearReadings = computed(() => this.readings().filter(
    (reading) => reading.recordedAt.startsWith(String(this.currentYear)),
  ));
  protected readonly summaries = computed(() => utilities.map((utility) => {
    const entries = this.currentYearReadings().filter((reading) => reading.utility === utility);
    const intervals = this.usageIntervals();
    const usage = summarizeUsageSinceFirstReading(
      this.readings(),
      intervals,
      utility,
      this.currentYear,
    );
    const utilityReadings = this.readings().filter((reading) => reading.utility === utility);
    const averagePerDay = summarizeUsageSinceMeterReset(this.readings(), intervals, utility).perDay;
    const hasMeterReset = utilityReadings.some((reading) => Number(reading.value) === 0);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const nextYear = Date.UTC(this.currentYear + 1, 0, 1);
    const remainingDays = Math.max(0, (nextYear - today) / 86_400_000 - 1);
    const years = [...new Set(this.readings()
      .filter((reading) => reading.utility === utility)
      .map((reading) => Number(reading.recordedAt.slice(0, 4))))]
      .filter((year) => year < this.currentYear)
      .sort((left, right) => right - left)
      .map((year) => ({ year, total: summarizeUsage(intervals, utility, year).consumption }));

    return {
      utility,
      total: usage.consumption,
      averagePerDay,
      averageBasis: hasMeterReset ? 'Ø seit Zählerwechsel' : 'Ø Gesamtzeitraum',
      projectedYearEnd: averagePerDay === null ? null : usage.consumption + averagePerDay * remainingDays,
      count: entries.length,
      years,
    };
  }));
  protected readonly selectedReadingRows = computed(() => {
    const utility = this.readingUtility();
    const averages = averageUsageByReadingDate(this.readings(), utility);

    return this.readings()
      .filter((reading) => reading.utility === utility)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.id - left.id)
      .map((reading) => ({
        ...reading,
        averagePerDay: averages.get(reading.recordedAt.slice(0, 10)) ?? null,
      }));
  });
  protected readonly dailyUsageStats = computed(() => utilities.map((utility) => ({
    utility,
    total: summarizeUsage(this.usageIntervals(), utility),
    years: this.recordedYears().map((year) => ({ year, ...summarizeUsage(this.usageIntervals(), utility, year) })),
  })));
  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const monthlyUsage = bucketUsageByDate(
      this.usageIntervals().filter((interval) => interval.utility === this.selectedUtility()),
      'month',
    );

    const keys = this.period() === 'year'
      ? Array.from({ length: 12 }, (_, index) => `${this.selectedYear()}-${String(index + 1).padStart(2, '0')}`)
      : [...monthlyUsage.keys()].sort();
    const labels = keys.map((key) => {
      const date = new Date(`${key}-01T12:00:00`);
      return this.period() === 'year'
        ? new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(date)
        : new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(date);
    });

    return {
      labels,
      datasets: [{
        data: keys.map((key) => monthlyUsage.get(key)?.consumption ?? 0),
        label: this.utilityLabel(this.selectedUtility()),
        borderColor: '#187663',
        backgroundColor: 'rgba(24, 118, 99, 0.12)',
        pointBackgroundColor: '#f5a64a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
        fill: true,
        tension: 0.34,
      }],
    };
  });
  protected readonly annualChartHasData = computed(() =>
    this.readings().some((reading) => reading.utility === this.selectedAnnualUtility()),
  );
  protected readonly annualChartData = computed<ChartData<'line'>>(() => {
    const utility = this.selectedAnnualUtility();
    const readings = this.readings();
    const intervals = this.usageIntervals();
    const chartYears = [...new Set([
      this.currentYear,
      ...readings
        .filter((reading) => reading.utility === utility)
        .map((reading) => Number(reading.recordedAt.slice(0, 4))),
    ])].sort((left, right) => left - right);
    const currentYearUsage = this.summaries().find((summary) => summary.utility === utility);
    const actualValues = chartYears.map((year) => year === this.currentYear
      ? summarizeUsageSinceFirstReading(readings, intervals, utility, year).consumption
      : summarizeUsage(intervals, utility, year).consumption);
    return {
      labels: [...chartYears.map(String), `${this.currentYear} · Jahresende`],
      datasets: [
        {
          label: 'Jahresverbrauch',
          data: [...actualValues, null],
          borderColor: '#187663',
          backgroundColor: 'rgba(24, 118, 99, 0.10)',
          pointBackgroundColor: '#187663',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Hochrechnung Jahresende',
          data: [...chartYears.map((year, index) => year === this.currentYear ? actualValues[index] : null),
          currentYearUsage?.projectedYearEnd ?? null],
          borderColor: '#e7933d',
          backgroundColor: '#e7933d',
          pointBackgroundColor: '#e7933d',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: (context) => context.dataIndex === chartYears.length ? 6 : 3,
          pointHoverRadius: 7,
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          tension: 0,
        },
      ],
    };
  });
  protected readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#78817c' } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#e8ece8' }, ticks: { color: '#78817c' } },
    },
  };
  protected readonly annualChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: '#78817c', boxWidth: 9, boxHeight: 9, usePointStyle: true, font: { size: 10 } },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#78817c' } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#e8ece8' }, ticks: { color: '#78817c' } },
    },
  };
  protected readonly pvChartData = computed<ChartData<'line'>>(() => {
    const readings = [...this.pvReadings()].sort((left, right) => left.date.localeCompare(right.date));
    const series: Array<{
      key: keyof Pick<PvReading, 'generated' | 'consumed' | 'feedIn' | 'gridImport'>;
      label: string;
      color: string;
    }> = [
      { key: 'generated', label: 'Erzeugt', color: '#e7933d' },
      { key: 'consumed', label: 'Verbraucht', color: '#187663' },
      { key: 'feedIn', label: 'Einspeisung', color: '#4c79a5' },
      { key: 'gridImport', label: 'Netzbezug', color: '#bd5d4c' },
    ];

    return {
      labels: readings.map((reading) => this.formatDate(reading.date)),
      datasets: series.map(({ key, label, color }) => ({
        label,
        data: readings.map((reading) => Number(reading[key])),
        borderColor: color,
        backgroundColor: color,
        pointRadius: readings.length > 120 ? 0 : 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0.2,
        fill: false,
      })),
    };
  });
  protected readonly pvRecentReadings = computed(() =>
    [...this.pvReadings()].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 30),
  );
  protected readonly pvMetrics = computed(() => {
    const readings = this.pvReadings();
    const metrics = [
      { key: 'generated', label: 'Erzeugt', field: 'generated' },
      { key: 'consumed', label: 'Verbraucht', field: 'consumed' },
      { key: 'feed-in', label: 'Einspeisung', field: 'feedIn' },
      { key: 'grid-import', label: 'Netzbezug', field: 'gridImport' },
    ] as const;

    return metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      total: readings.reduce((sum, reading) => sum + Number(reading[metric.field]), 0),
    }));
  });
  protected readonly pvChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: '#78817c', boxWidth: 9, boxHeight: 9, usePointStyle: true, font: { size: 10 } },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#78817c', maxTicksLimit: 12 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#e8ece8' }, ticks: { color: '#78817c' } },
    },
  };

  protected newUtility: Utility = 'electricity';
  protected newValue: number | string | null = '';
  protected newDate = this.today();
  protected saving = false;

  constructor() {
    this.syncPageFromHash();
    this.loadReadings();
    this.loadPvReadings();
  }

  @HostListener('window:hashchange')
  protected syncPageFromHash(): void {
    this.readingsOpen.set(window.location.hash === '#readings');
    this.pvOpen.set(window.location.hash === '#pv');
    this.helpOpen.set(window.location.hash === '#help');
  }

  protected get unit(): string {
    return this.newUtility === 'electricity' ? 'kWh' : 'm³';
  }

  protected utilityLabel(utility: Utility): string {
    return utility === 'electricity' ? 'Strom' : utility === 'gas' ? 'Gas' : 'Wasser';
  }

  protected unitLabel(utility: Utility): string {
    return utility === 'electricity' ? 'kWh' : 'm³';
  }

  protected formatValue(value: number | string): string {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value));
  }

  protected formatDailyValue(value: number | null): string {
    return value === null ? '–' : this.formatValue(value);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(`${value.slice(0, 10)}T12:00:00`));
  }

  protected openDialog(): void {
    this.notice.set('');
    this.helpOpen.set(false);
    this.dialogOpen.set(true);
  }

  protected showHelp(): void {
    this.readingsOpen.set(false);
    this.pvOpen.set(false);
    this.helpOpen.set(true);
    if (window.location.hash !== '#help') window.location.hash = '#help';
  }

  protected showDashboard(): void {
    this.readingsOpen.set(false);
    this.pvOpen.set(false);
    this.helpOpen.set(false);
    if (window.location.hash !== '#overview') window.location.hash = '#overview';
  }

  protected showReadings(): void {
    this.helpOpen.set(false);
    this.pvOpen.set(false);
    this.readingsOpen.set(true);
    if (window.location.hash !== '#readings') window.location.hash = '#readings';
  }

  protected showPv(): void {
    this.helpOpen.set(false);
    this.readingsOpen.set(false);
    this.pvOpen.set(true);
    if (window.location.hash !== '#pv') window.location.hash = '#pv';
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }

  protected submitReading(event: SubmitEvent): void {
    event.preventDefault();
    const value = Number(this.newValue);
    if (this.saving || this.newValue === '' || this.newValue === null || !Number.isFinite(value) || value < 0) return;

    this.saving = true;
    this.api.addReading({
      utility: this.newUtility,
      value,
      unit: this.unit,
      recordedAt: this.newDate,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.dialogOpen.set(false);
        this.newValue = '';
        this.notice.set('Messwert wurde gespeichert.');
        this.loadReadings();
      },
      error: (error: Error) => {
        this.saving = false;
        this.apiError.set(error.message);
      },
    });
  }

  protected importCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.api.importCsv(file).subscribe({
      next: ({ imported }) => {
        this.notice.set(`${imported} Messwerte wurden importiert.`);
        this.apiError.set('');
        this.loadReadings();
      },
      error: (error: Error) => {
        this.apiError.set(error.message);
        input.value = '';
      },
      complete: () => { input.value = ''; },
    });
  }

  protected importPvCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.pvImporting.set(true);
    this.pvApiError.set('');
    this.api.importPvCsv(file).subscribe({
      next: ({ imported }) => {
        this.pvNotice.set(`${imported} PV-Tageswerte wurden importiert.`);
        this.loadPvReadings();
      },
      error: (error: Error) => {
        this.pvApiError.set(error.message);
        input.value = '';
        this.pvImporting.set(false);
      },
      complete: () => {
        input.value = '';
        this.pvImporting.set(false);
      },
    });
  }

  protected loadReadings(): void {
    this.loading.set(true);
    this.api.getReadings().subscribe({
      next: (readings) => {
        this.readings.set(readings);
        this.apiError.set('');
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.apiError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  protected loadPvReadings(): void {
    this.pvLoading.set(true);
    this.api.getPvReadings().subscribe({
      next: (readings) => {
        this.pvReadings.set(readings);
        this.pvApiError.set('');
        this.pvLoading.set(false);
      },
      error: (error: Error) => {
        this.pvApiError.set(error.message);
        this.pvLoading.set(false);
      },
    });
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
