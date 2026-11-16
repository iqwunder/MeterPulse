import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  bucketUsageByDate,
  createUsageIntervals,
  summarizeUsage,
  summarizeUsageSinceFirstReading,
} from './consumption';
import { MeterApiService, Reading, Utility } from './meter-api.service';

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
  protected readonly loading = signal(true);
  protected readonly apiError = signal('');
  protected readonly notice = signal('');
  protected readonly dialogOpen = signal(false);
  protected readonly helpOpen = signal(false);
  protected readonly showAllReadings = signal(false);
  protected readonly period = signal<Period>('all');
  protected readonly selectedUtility = signal<Utility>('electricity');
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
  protected readonly periodReadings = computed(() => this.period() === 'year'
    ? this.readings().filter((reading) => reading.recordedAt.startsWith(String(this.selectedYear())))
    : this.readings());
  protected readonly summaries = computed(() => utilities.map((utility) => {
    const entries = this.currentYearReadings().filter((reading) => reading.utility === utility);
    const usage = summarizeUsageSinceFirstReading(
      this.readings(),
      this.usageIntervals(),
      utility,
      this.currentYear,
    );
    return {
      utility,
      total: usage.consumption,
      averagePerDay: usage.perDay,
      count: entries.length,
    };
  }));
  protected readonly dailyUsageStats = computed(() => utilities.map((utility) => ({
    utility,
    total: summarizeUsage(this.usageIntervals(), utility),
    years: this.recordedYears().map((year) => ({ year, ...summarizeUsage(this.usageIntervals(), utility, year) })),
  })));
  protected readonly visibleReadings = computed(() => {
    const sorted = [...this.readings()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return this.showAllReadings() ? sorted : sorted.slice(0, 6);
  });
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
  protected readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#78817c' } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#e8ece8' }, ticks: { color: '#78817c' } },
    },
  };

  protected newUtility: Utility = 'electricity';
  protected newValue: number | string | null = '';
  protected newDate = this.today();
  protected saving = false;

  constructor() {
    this.loadReadings();
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
    this.helpOpen.set(true);
  }

  protected showDashboard(): void {
    this.helpOpen.set(false);
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

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
