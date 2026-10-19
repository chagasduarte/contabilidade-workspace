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
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { ProjecaoMensal } from '@contabilidade/models';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
);

const MONTH_LABELS: readonly string[] = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

@Component({
  selector: 'app-fluxo-caixa-chart',
  imports: [],
  templateUrl: './fluxo-caixa-chart.html',
  styleUrl: './fluxo-caixa-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FluxoCaixaChart implements AfterViewInit, OnDestroy {
  @ViewChild('cashFlowChart')
  private cashFlowCanvas?: ElementRef<HTMLCanvasElement>;

  readonly projecao = input<ProjecaoMensal[]>([]);

  readonly chartSeries = computed(() => {
    const lista = this.projecao();
    const entradas = new Array<number>(12).fill(0);
    const saidas = new Array<number>(12).fill(0);
    const progressao = new Array<number>(12).fill(0);

    for (const item of lista) {
      const idx = Number(item.mes) - 1;
      if (idx >= 0 && idx < 12) {
        entradas[idx] = Number(item.soma_entrada || 0);
        saidas[idx] = Number(item.soma_saida || 0);
        progressao[idx] = Number(item.saldo_acumulado || 0);
      }
    }

    return { entradas, saidas, progressao };
  });

  private readonly platformId = inject(PLATFORM_ID);
  private chart?: Chart<'bar' | 'line', number[], string>;

  constructor() {
    effect(() => {
      const { entradas, saidas, progressao } = this.chartSeries();
      if (this.chart) {
        this.chart.data.datasets[0].data = entradas;
        this.chart.data.datasets[1].data = saidas;
        this.chart.data.datasets[2].data = progressao;
        this.chart.update();
      }
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.cashFlowCanvas) {
      return;
    }

    const canvas = this.cashFlowCanvas.nativeElement;
    const browserWindow = canvas.ownerDocument.defaultView;
    if (
      !browserWindow ||
      typeof browserWindow.CanvasRenderingContext2D === 'undefined'
    ) {
      return;
    }

    const currency = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

    const { entradas, saidas, progressao } = this.chartSeries();

    this.chart = new Chart<'bar' | 'line', number[], string>(canvas, {
      type: 'bar',
      data: {
        labels: [...MONTH_LABELS],
        datasets: [
          {
            type: 'bar',
            label: 'Entradas',
            data: entradas,
            backgroundColor: '#56b68b',
            borderRadius: 3,
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          },
          {
            type: 'bar',
            label: 'Saídas',
            data: saidas,
            backgroundColor: '#f06a5b',
            borderRadius: 3,
            barPercentage: 0.82,
            categoryPercentage: 0.72,
          },
          {
            type: 'line',
            label: 'Progressão',
            data: progressao,
            borderColor: '#9fd2ff',
            backgroundColor: '#9fd2ff',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label ?? 'Valor';
                const amount = context.parsed.y;
                return amount === null
                  ? label
                  : `${label}: ${currency.format(amount)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            border: {
              color: 'rgba(255, 255, 255, 0.12)',
            },
            ticks: {
              color: '#aeb4c0',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#aeb4c0',
              callback: (value) => currency.format(Number(value)),
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.09)',
            },
            border: {
              display: false,
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
