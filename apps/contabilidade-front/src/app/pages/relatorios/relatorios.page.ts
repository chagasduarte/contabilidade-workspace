import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  barChartOutline,
  cardOutline,
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  closeOutline,
  pieChartOutline,
  pricetagOutline,
  receiptOutline,
  refreshOutline,
  trendingDownOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Subject, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Transacao } from '@contabilidade/models';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';

Chart.register(
  DoughnutController,
  BarController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
);

export type PeriodoTipo = 'mes' | 'ano' | 'customizado';
export type TipoRelatorio = 'saida' | 'entrada';

/** Chave usada para lançamentos sem categoria (permite filtrar por eles também). */
export const SEM_CATEGORIA = 0;

export interface CategoriaRelatorioItem {
  chave: number;
  categoria_nome: string;
  total: number;
  percentual: number;
  cor: string;
  icone: string;
  quantidadeTransacoes: number;
  subcategorias: { nome: string; total: number; percentual: number }[];
}

interface Intervalo {
  inicio: string;
  fim: string;
}

const PALETA_CORES = [
  '#60a5fa',
  '#4ade80',
  '#fbbf24',
  '#c084fc',
  '#f87171',
  '#38bdf8',
  '#fb923c',
  '#f472b6',
  '#a3e635',
  '#2dd4bf',
];
const COR_SEM_CATEGORIA = '#94a3b8';
const COR_OUTROS = '#64748b';

/** Fatias do doughnut antes de agrupar o restante em "Outros". */
const MAX_FATIAS = 7;
/** Acima disso, o período customizado é agrupado por mês em vez de por dia. */
const MAX_DIAS_SERIE_DIARIA = 62;
const PAGINA_TRANSACOES = 15;

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dataExtenso = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIso(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((parseIso(fim).getTime() - parseIso(inicio).getTime()) / 86_400_000) + 1;
}

/** Mesma regra do agrupamento da API: compras no cartão contam pela data da fatura. */
function dataReferencia(t: Transacao): string {
  return ((t.cartaoid ? t.pagamento || t.data : t.data) ?? '').substring(0, 10);
}

function valorDe(t: Transacao): number {
  return Number(t.valor || 0);
}

@Component({
  selector: 'app-relatorios-page',
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    MonthSelector,
  ],
  templateUrl: './relatorios.page.html',
  styleUrl: './relatorios.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatoriosPage implements OnInit {
  private readonly transacaoService = inject(TransacaoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly dashboardService = inject(DashboardService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly doughnutCanvas = viewChild<ElementRef<HTMLCanvasElement>>('doughnutCanvas');
  private readonly timelineCanvas = viewChild<ElementRef<HTMLCanvasElement>>('timelineCanvas');
  private doughnutChart?: Chart<'doughnut', number[], string>;
  private timelineChart?: Chart<'bar', number[], string>;

  private readonly recarregar$ = new Subject<{ concluir?: () => void }>();

  readonly periodos: readonly { valor: PeriodoTipo; rotulo: string }[] = [
    { valor: 'mes', rotulo: 'Mês' },
    { valor: 'ano', rotulo: 'Ano' },
    { valor: 'customizado', rotulo: 'Período' },
  ];

  // Filtros
  readonly tipo =signal<TipoRelatorio>('saida');
  readonly periodoTipo = signal<PeriodoTipo>('mes');
  // O relatório abre no mesmo mês que o usuário está vendo no restante do app
  readonly mes = signal<number>(this.dashboardService.mes());
  readonly ano = signal<number>(this.dashboardService.ano());
  readonly inicioRascunho = signal<string>(isoLocal(new Date(Date.now() - 29 * 86_400_000)));
  readonly fimRascunho = signal<string>(isoLocal(new Date()));
  private readonly intervaloCustom = signal<Intervalo>({
    inicio: this.inicioRascunho(),
    fim: this.fimRascunho(),
  });
  readonly categoriaSelecionadaChave = signal<number | null>(null);
  readonly limiteTransacoes = signal(PAGINA_TRANSACOES);

  // Estado
  readonly loading = signal(false);
  readonly carregouUmaVez = signal(false);
  readonly erro = signal<string | null>(null);
  private readonly extrato = signal<Transacao[]>([]);

  readonly rascunhoValido = computed(() => {
    const inicio = this.inicioRascunho();
    const fim = this.fimRascunho();
    return !!inicio && !!fim && inicio <= fim;
  });

  readonly rascunhoAlterado = computed(() => {
    const aplicado = this.intervaloCustom();
    return aplicado.inicio !== this.inicioRascunho() || aplicado.fim !== this.fimRascunho();
  });

  readonly intervalo = computed<Intervalo>(() => {
    const ano = this.ano();
    switch (this.periodoTipo()) {
      case 'mes': {
        const mes = this.mes();
        return { inicio: isoLocal(new Date(ano, mes - 1, 1)), fim: isoLocal(new Date(ano, mes, 0)) };
      }
      case 'ano':
        return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
      default:
        return this.intervaloCustom();
    }
  });

  readonly rotuloPeriodo = computed(() => {
    const { inicio, fim } = this.intervalo();
    switch (this.periodoTipo()) {
      case 'mes':
        return `${MESES_CURTOS[this.mes() - 1]} ${this.ano()}`;
      case 'ano':
        return String(this.ano());
      default:
        return `${dataExtenso.format(parseIso(inicio))} – ${dataExtenso.format(parseIso(fim))}`;
    }
  });

  readonly textos = computed(() =>
    this.tipo() === 'saida'
      ? { total: 'Total gasto', categoria: 'Maior gasto', maior: 'Maior despesa', serie: 'Gastos' }
      : { total: 'Total recebido', categoria: 'Maior fonte', maior: 'Maior receita', serie: 'Receitas' }
  );

  /** Única fonte de dados: todos os números da tela batem com a lista de lançamentos. */
  readonly transacoes = computed(() => {
    const tipo = this.tipo();
    const { inicio, fim } = this.intervalo();
    const filtrarData = this.periodoTipo() === 'customizado';
    return this.extrato()
      .filter((t) => (tipo === 'saida' ? t.tipo !== 'entrada' : t.tipo === 'entrada'))
      .filter((t) => {
        if (!filtrarData) return true;
        const d = dataReferencia(t);
        return d >= inicio && d <= fim;
      });
  });

  readonly dadosCategorias = computed<CategoriaRelatorioItem[]>(() => {
    const cadastradas = new Map(this.categoriaService.categorias().map((c) => [c.id, c]));
    const grupos = new Map<
      number,
      { nome: string; total: number; quantidade: number; subs: Map<string, number> }
    >();

    for (const t of this.transacoes()) {
      const chave = t.idcategoria ?? SEM_CATEGORIA;
      let grupo = grupos.get(chave);
      if (!grupo) {
        const nome =
          t.categoria_nome ||
          cadastradas.get(chave)?.nome ||
          (chave === SEM_CATEGORIA ? 'Sem categoria' : `Categoria #${chave}`);
        grupo = { nome, total: 0, quantidade: 0, subs: new Map() };
        grupos.set(chave, grupo);
      }
      const valor = valorDe(t);
      grupo.total += valor;
      grupo.quantidade++;
      const sub = t.subcategoria_nome || 'Sem subcategoria';
      grupo.subs.set(sub, (grupo.subs.get(sub) ?? 0) + valor);
    }

    const totalGeral = Array.from(grupos.values()).reduce((acc, g) => acc + g.total, 0);

    return Array.from(grupos.entries())
      .map(([chave, g]) => {
        const cadastrada = cadastradas.get(chave);
        return {
          chave,
          categoria_nome: g.nome,
          total: g.total,
          percentual: totalGeral > 0 ? (g.total / totalGeral) * 100 : 0,
          // Cor fixa por categoria: não muda ao trocar de período
          cor:
            cadastrada?.cor ||
            (chave === SEM_CATEGORIA ? COR_SEM_CATEGORIA : PALETA_CORES[chave % PALETA_CORES.length]),
          icone: cadastrada?.icone || 'pricetag-outline',
          quantidadeTransacoes: g.quantidade,
          subcategorias: Array.from(g.subs.entries())
            .map(([nome, total]) => ({
              nome,
              total,
              percentual: g.total > 0 ? (total / g.total) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total),
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  readonly totalGeral = computed(() => this.transacoes().reduce((acc, t) => acc + valorDe(t), 0));

  readonly totalPendente = computed(() =>
    this.transacoes()
      .filter((t) => t.status !== 'pago')
      .reduce((acc, t) => acc + valorDe(t), 0)
  );

  readonly maiorCategoria = computed(() => this.dadosCategorias()[0] ?? null);

  readonly maiorTransacao = computed(() =>
    this.transacoes().reduce<Transacao | null>(
      (maior, t) => (!maior || valorDe(t) > valorDe(maior) ? t : maior),
      null
    )
  );

  /** Média por dia (ou por mês no anual), considerando só os dias já decorridos do período. */
  readonly media = computed(() => {
    const { inicio, fim } = this.intervalo();
    const hoje = isoLocal(new Date());
    const fimEfetivo = fim > hoje && inicio <= hoje ? hoje : fim;
    if (this.periodoTipo() === 'ano') {
      const meses = fimEfetivo === fim ? 12 : parseIso(fimEfetivo).getMonth() + 1;
      return { valor: this.totalGeral() / meses, unidade: 'mês' };
    }
    return { valor: this.totalGeral() / Math.max(1, diasEntre(inicio, fimEfetivo)), unidade: 'dia' };
  });

  readonly categoriaSelecionada = computed(() => {
    const chave = this.categoriaSelecionadaChave();
    return chave === null ? null : (this.dadosCategorias().find((c) => c.chave === chave) ?? null);
  });

  readonly transacoesFiltradas = computed(() => {
    const chave = this.categoriaSelecionadaChave();
    const lista =
      chave === null
        ? this.transacoes()
        : this.transacoes().filter((t) => (t.idcategoria ?? SEM_CATEGORIA) === chave);
    return [...lista].sort((a, b) => dataReferencia(b).localeCompare(dataReferencia(a)));
  });

  readonly transacoesVisiveis = computed(() =>
    this.transacoesFiltradas().slice(0, this.limiteTransacoes())
  );

  readonly agrupaPorMes = computed(() => {
    const { inicio, fim } = this.intervalo();
    return this.periodoTipo() === 'ano' || diasEntre(inicio, fim) > MAX_DIAS_SERIE_DIARIA;
  });

  /** Série temporal com todos os dias/meses do período (inclusive os zerados). */
  readonly evolucao = computed(() => {
    const { inicio, fim } = this.intervalo();
    const porMes = this.agrupaPorMes();
    const chaveDe = (iso: string) => (porMes ? iso.substring(0, 7) : iso);

    const buckets = new Map<string, number>();
    const cursor = parseIso(inicio);
    const limite = parseIso(fim);
    while (cursor <= limite) {
      buckets.set(chaveDe(isoLocal(cursor)), 0);
      if (porMes) cursor.setMonth(cursor.getMonth() + 1, 1);
      else cursor.setDate(cursor.getDate() + 1);
    }

    for (const t of this.transacoesFiltradas()) {
      const data = dataReferencia(t);
      if (!data) continue;
      const chave = chaveDe(data);
      buckets.set(chave, (buckets.get(chave) ?? 0) + valorDe(t));
    }

    const ordenadas = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const anos = new Set(ordenadas.map(([k]) => k.substring(0, 4)));
    return {
      labels: ordenadas.map(([k]) => {
        const [a, m, d] = k.split('-');
        if (porMes) return anos.size > 1 ? `${MESES_CURTOS[+m - 1]}/${a.slice(2)}` : MESES_CURTOS[+m - 1];
        return `${d}/${m}`;
      }),
      valores: ordenadas.map(([, v]) => v),
    };
  });

  readonly temDadosEvolucao = computed(() => this.evolucao().valores.some((v) => v > 0));

  constructor() {
    addIcons({
      alertCircleOutline,
      barChartOutline,
      cardOutline,
      chevronBackOutline,
      chevronDownOutline,
      chevronForwardOutline,
      closeOutline,
      pieChartOutline,
      pricetagOutline,
      receiptOutline,
      refreshOutline,
      trendingDownOutline,
      trendingUpOutline,
    });

    // switchMap descarta respostas antigas quando o usuário troca de período rapidamente
    this.recarregar$
      .pipe(
        switchMap(({ concluir }) => {
          this.loading.set(true);
          this.erro.set(null);
          const { mes, ano } = this.parametrosExtrato();
          return this.transacaoService.carregarExtrato(mes, ano, 0).pipe(
            tap((lista) => {
              this.extrato.set(lista ?? []);
              this.carregouUmaVez.set(true);
            }),
            catchError(() => {
              this.erro.set('Não foi possível carregar os dados do relatório.');
              return of(null);
            }),
            finalize(() => {
              this.loading.set(false);
              concluir?.();
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe();

    // Os canvas ficam dentro de @if: (re)cria o gráfico sempre que o elemento muda
    effect(() => {
      const canvas = this.doughnutCanvas()?.nativeElement;
      const cats = this.dadosCategorias();
      untracked(() => this.renderizarDoughnut(canvas, cats));
    });

    effect(() => {
      const canvas = this.timelineCanvas()?.nativeElement;
      const evolucao = this.evolucao();
      const tipo = this.tipo();
      untracked(() => this.renderizarTimeline(canvas, evolucao, tipo));
    });

    this.destroyRef.onDestroy(() => {
      this.doughnutChart?.destroy();
      this.timelineChart?.destroy();
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.carregarDados();
    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
    }
  }

  carregarDados(): void {
    this.recarregar$.next({});
  }

  recarregar(event: Event): void {
    this.recarregar$.next({
      concluir: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  onTipo(event: CustomEvent): void {
    const valor = event.detail.value as TipoRelatorio | undefined;
    if (valor && valor !== this.tipo()) {
      // Entradas e saídas vêm do mesmo extrato: trocar o tipo não precisa de nova requisição
      this.tipo.set(valor);
      this.limparSelecao();
    }
  }

  selecionarPeriodo(tipo: PeriodoTipo): void {
    if (tipo === this.periodoTipo()) return;
    this.periodoTipo.set(tipo);
    this.limparSelecao();
    this.carregarDados();
  }

  selecionarMes(mes: number): void {
    this.mes.set(mes);
    this.aoMudarPeriodo();
  }

  deslocarMes(delta: number): void {
    const d = new Date(this.ano(), this.mes() - 1 + delta, 1);
    this.ano.set(d.getFullYear());
    this.mes.set(d.getMonth() + 1);
    this.aoMudarPeriodo();
  }

  deslocarAno(delta: number): void {
    this.ano.update((a) => a + delta);
    this.aoMudarPeriodo();
  }

  aplicarPreset(dias: number): void {
    const fim = new Date();
    this.inicioRascunho.set(isoLocal(new Date(fim.getTime() - (dias - 1) * 86_400_000)));
    this.fimRascunho.set(isoLocal(fim));
    this.aplicarIntervalo();
  }

  aplicarIntervalo(): void {
    if (!this.rascunhoValido()) return;
    this.intervaloCustom.set({ inicio: this.inicioRascunho(), fim: this.fimRascunho() });
    this.aoMudarPeriodo();
  }

  alternarCategoria(chave: number): void {
    this.categoriaSelecionadaChave.update((atual) => (atual === chave ? null : chave));
    this.limiteTransacoes.set(PAGINA_TRANSACOES);
  }

  limparSelecao(): void {
    this.categoriaSelecionadaChave.set(null);
    this.limiteTransacoes.set(PAGINA_TRANSACOES);
  }

  mostrarMais(): void {
    this.limiteTransacoes.update((l) => l + PAGINA_TRANSACOES * 2);
  }

  formatarMoeda(valor: number | string | null | undefined): string {
    return moeda.format(Number(valor) || 0);
  }

  formatarData(t: Transacao): string {
    const data = dataReferencia(t);
    return data ? dataExtenso.format(parseIso(data)) : '—';
  }

  ehSaida(t: Transacao): boolean {
    return t.tipo !== 'entrada';
  }

  private aoMudarPeriodo(): void {
    this.limparSelecao();
    this.carregarDados();
  }

  /** Busca o menor recorte possível na API; o período customizado é refinado no cliente. */
  private parametrosExtrato(): { mes?: number; ano?: number } {
    switch (this.periodoTipo()) {
      case 'mes':
        return { mes: this.mes(), ano: this.ano() };
      case 'ano':
        return { ano: this.ano() };
      default: {
        const { inicio, fim } = this.intervaloCustom();
        const [anoInicio, mesInicio] = inicio.split('-').map(Number);
        const [anoFim, mesFim] = fim.split('-').map(Number);
        if (anoInicio !== anoFim) return {};
        return mesInicio === mesFim ? { mes: mesInicio, ano: anoInicio } : { ano: anoInicio };
      }
    }
  }

  private podeDesenhar(canvas?: HTMLCanvasElement): canvas is HTMLCanvasElement {
    return (
      !!canvas &&
      isPlatformBrowser(this.platformId) &&
      typeof canvas.ownerDocument?.defaultView?.CanvasRenderingContext2D !== 'undefined'
    );
  }

  private renderizarDoughnut(canvas: HTMLCanvasElement | undefined, cats: CategoriaRelatorioItem[]): void {
    if (this.doughnutChart && this.doughnutChart.canvas !== canvas) {
      this.doughnutChart.destroy();
      this.doughnutChart = undefined;
    }
    if (!this.podeDesenhar(canvas)) return;

    const principais = cats.slice(0, MAX_FATIAS);
    const resto = cats.slice(MAX_FATIAS);
    const fatias = resto.length
      ? [
          ...principais,
          { chave: -1, categoria_nome: `Outras (${resto.length})`, total: resto.reduce((a, c) => a + c.total, 0), cor: COR_OUTROS },
        ]
      : principais;

    const labels = fatias.map((c) => c.categoria_nome);
    const valores = fatias.map((c) => c.total);
    const cores = fatias.map((c) => c.cor);

    if (this.doughnutChart) {
      this.doughnutChart.data.labels = labels;
      this.doughnutChart.data.datasets[0].data = valores;
      this.doughnutChart.data.datasets[0].backgroundColor = cores;
      this.doughnutChart.update();
      return;
    }

    try {
      this.doughnutChart = new Chart<'doughnut', number[], string>(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: valores,
              backgroundColor: cores,
              borderWidth: 2,
              borderColor: '#171d23',
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          onClick: (_evt, elementos) => {
            const indice = elementos[0]?.index;
            const chave = indice !== undefined ? fatias[indice]?.chave : undefined;
            if (chave !== undefined && chave >= 0) this.alternarCategoria(chave);
          },
          onHover: (evt, elementos) => {
            const alvo = evt.native?.target as HTMLElement | undefined;
            if (alvo) alvo.style.cursor = elementos.length ? 'pointer' : 'default';
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = this.totalGeral();
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                  return ` ${this.formatarMoeda(ctx.parsed)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    } catch {
      // Ambiente headless / jsdom sem canvas nativo
    }
  }

  private renderizarTimeline(
    canvas: HTMLCanvasElement | undefined,
    evolucao: { labels: string[]; valores: number[] },
    tipo: TipoRelatorio
  ): void {
    if (this.timelineChart && this.timelineChart.canvas !== canvas) {
      this.timelineChart.destroy();
      this.timelineChart = undefined;
    }
    if (!this.podeDesenhar(canvas)) return;

    const cor = tipo === 'saida' ? '#f87171' : '#4ade80';
    const fundo = tipo === 'saida' ? 'rgba(248, 113, 113, 0.75)' : 'rgba(74, 222, 128, 0.75)';

    if (this.timelineChart) {
      const ds = this.timelineChart.data.datasets[0];
      this.timelineChart.data.labels = evolucao.labels;
      ds.data = evolucao.valores;
      ds.backgroundColor = fundo;
      ds.hoverBackgroundColor = cor;
      this.timelineChart.update();
      return;
    }

    try {
      this.timelineChart = new Chart<'bar', number[], string>(canvas, {
        type: 'bar',
        data: {
          labels: evolucao.labels,
          datasets: [
            {
              data: evolucao.valores,
              backgroundColor: fundo,
              hoverBackgroundColor: cor,
              borderRadius: 4,
              barPercentage: 0.75,
              categoryPercentage: 0.9,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                label: (ctx) => ` ${this.textos().serie}: ${this.formatarMoeda(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#8fa0b1', autoSkip: true, maxRotation: 0, autoSkipPadding: 8 },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: 'rgba(255, 255, 255, 0.06)' },
              ticks: {
                color: '#8fa0b1',
                maxTicksLimit: 5,
                callback: (val) => moedaCompacta.format(Number(val)),
              },
            },
          },
        },
      });
    } catch {
      // Ambiente headless / jsdom sem canvas nativo
    }
  }
}
