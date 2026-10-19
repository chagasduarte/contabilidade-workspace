import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ArcElement, Chart, PieController, Tooltip } from 'chart.js';

Chart.register(PieController, ArcElement, Tooltip);

@Component({
  selector: 'app-receitas-despesas-chart',
  imports: [],
  templateUrl: './receitas-despesas-chart.html',
  styleUrl: './receitas-despesas-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceitasDespesasChart implements AfterViewInit, OnDestroy {
  @ViewChild('monthlyBalanceChart')
  private monthlyBalanceCanvas?: ElementRef<HTMLCanvasElement>;

  readonly revenues = input<number>(0);
  readonly expenses = input<number>(0);
  readonly accumulatedBalance = input<number>(0);

  readonly monthlySurplus = computed<number>(
    () => this.revenues() - this.expenses()
  );

  readonly cashBalance = computed<number>(() => this.accumulatedBalance());

  readonly previousSurplus = computed<number>(
    () => this.cashBalance() - this.monthlySurplus()
  );

  readonly commitmentPercentage = computed<number>(() => {
    const rev = this.revenues();
    const exp = this.expenses();
    if (rev <= 0) {
      return exp > 0 ? 100 : 0;
    }
    return (exp / rev) * 100;
  });

  private readonly platformId = inject(PLATFORM_ID);
  private chart?: Chart<'pie', number[], string>;

  constructor() {
    effect(() => {
      const exp = Math.max(0, this.expenses());
      const surplus = Math.max(0, this.monthlySurplus());

      if (this.chart) {
        this.chart.data.datasets[0].data = [exp, surplus];
        this.chart.update();
      }
    });
  }

  formatPercentage(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.monthlyBalanceCanvas) {
      return;
    }

    const canvas = this.monthlyBalanceCanvas.nativeElement;
    const browserWindow = canvas.ownerDocument.defaultView;
    if (
      !browserWindow ||
      typeof browserWindow.CanvasRenderingContext2D === 'undefined'
    ) {
      return;
    }

    const exp = Math.max(0, this.expenses());
    const surplus = Math.max(0, this.monthlySurplus());

    this.chart = new Chart<'pie', number[], string>(canvas, {
      type: 'pie',
      data: {
        labels: ['Despesas', 'Sobra deste mês'],
        datasets: [
          {
            data: [exp, surplus],
            backgroundColor: ['#4b9da3', '#83bd78'],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        rotation: -0.5 * Math.PI,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const amount = context.parsed;
                const total = Math.max(1, this.revenues());
                const percentage = (amount / total) * 100;
                return `${context.label}: ${this.formatCurrency(amount)} (${percentage.toFixed(2)}%)`;
              },
            },
          },
        },
      },
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
