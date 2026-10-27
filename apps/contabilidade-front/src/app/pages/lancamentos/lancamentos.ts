import {
  CurrencyPipe,
  DatePipe,
  isPlatformBrowser,
  registerLocaleData,
} from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  addOutline,
} from 'ionicons/icons';
import { TransacaoService } from '../../core/services/transacao.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { rotuloCategoria } from '../../core/utils/categoria-label';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';
import { TransactionModal } from '../../components/modals/transaction-modal/transaction-modal';

registerLocaleData(localePt, 'pt-BR');

export interface TransactionViewItem {
  id: number | string;
  date: string;
  description: string;
  category: string;
  type: 'Entrada' | 'Saída';
  amount: number;
  status: 'Recebido' | 'Pago' | 'Pendente';
}

const MESES_PT: readonly string[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

@Component({
  selector: 'app-lancamentos',
  imports: [
    CurrencyPipe,
    DatePipe,
    IonButton,
    IonContent,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSpinner,
    MonthSelector,
    TransactionModal,
  ],
  templateUrl: './lancamentos.html',
  styleUrl: './lancamentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Lancamentos implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  readonly transacaoService = inject(TransacaoService);
  readonly dashboardService = inject(DashboardService);
  readonly headerState = inject(HeaderStateService);
  private readonly categoriaService = inject(CategoriaService);

  readonly modalNovaTransacaoAberto = signal<boolean>(false);

  readonly periodoLabel = computed<string>(() => {
    const mesIdx = this.dashboardService.mes() - 1;
    const nomeMes = MESES_PT[mesIdx] ?? 'Mês';
    return `${nomeMes} ${this.dashboardService.ano()}`;
  });

  private readonly nomesCategorias = computed(
    () => new Map(this.categoriaService.categorias().map((c) => [c.id, c.nome]))
  );

  /** Todos os lançamentos carregados (sem filtro de busca). */
  private readonly todasTransacoes = computed<TransactionViewItem[]>(() => {
    const nomes = this.nomesCategorias();
    return this.transacaoService.extrato().map((item) => {
      const isIncome = item.tipo === 'entrada';
      const isPending = item.status === 'pendente';

      return {
        id: item.id,
        date: item.data,
        description: item.descricao,
        category: rotuloCategoria(item, nomes),
        type: (isIncome ? 'Entrada' : 'Saída') as 'Entrada' | 'Saída',
        amount: Number(item.valor || 0),
        status: (isPending ? 'Pendente' : isIncome ? 'Recebido' : 'Pago') as
          | 'Recebido'
          | 'Pago'
          | 'Pendente',
      };
    });
  });

  readonly transactions = computed<TransactionViewItem[]>(() => {
    const term = this.headerState.searchTerm().trim().toLowerCase();
    const raw = this.todasTransacoes();

    if (!term) {
      return raw;
    }

    return raw.filter(
      (t) =>
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term)
    );
  });

  readonly temMaisPaginas = computed<boolean>(() => this.transacaoService.nextCursor() != null);

  /**
   * Totais do mês. Usa `totais` da API quando disponível; senão soma o que já foi
   * carregado. Nesse caso, com mais páginas pendentes, o resumo é parcial.
   */
  readonly totaisParciais = computed<boolean>(
    () => !this.transacaoService.totaisExtrato() && this.temMaisPaginas()
  );

  readonly monthlyIncome = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.entradas ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Entrada')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyExpenses = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.saidas ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Saída')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly pendingCount = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.pendentes ??
      this.todasTransacoes().filter((t) => t.status === 'Pendente').length
  );

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      refreshOutline,
      addOutline,
    });

    effect(() => {
      const year = this.headerState.selectedYear();
      if (year !== this.dashboardService.ano()) {
        this.dashboardService.ano.set(year);
        if (isPlatformBrowser(this.platformId)) {
          this.carregarExtrato();
        }
      }
    });

    // Régua de meses do header mobile
    effect(() => {
      const month = this.headerState.selectedMonth();
      if (month !== untracked(this.dashboardService.mes)) {
        this.dashboardService.mes.set(month);
        if (isPlatformBrowser(this.platformId)) {
          this.carregarExtrato();
        }
      }
    });
  }

  ngOnInit(): void {
    this.headerState.setYear(this.dashboardService.ano());
    this.headerState.setMonth(this.dashboardService.mes());
    if (isPlatformBrowser(this.platformId)) {
      this.carregarExtrato();
      if (this.categoriaService.categorias().length === 0) {
        this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
      }
    }
  }

  carregarExtrato(): void {
    this.transacaoService
      .carregarExtratoPaginado(this.dashboardService.mes(), this.dashboardService.ano())
      .subscribe({
        error: (err: unknown) => {
          console.error('Falha ao carregar extrato:', err);
        },
      });
  }

  /** Disparado pelo ion-infinite-scroll (ou pelo botão "Carregar mais"). */
  carregarMais(event?: Event): void {
    const cursor = this.transacaoService.nextCursor();
    const concluir = () =>
      (event?.target as HTMLIonInfiniteScrollElement | undefined)?.complete?.();

    if (!cursor || this.transacaoService.carregandoMais()) {
      concluir();
      return;
    }

    this.transacaoService
      .carregarExtratoPaginado(this.dashboardService.mes(), this.dashboardService.ano(), cursor)
      .subscribe({
        next: concluir,
        error: (err: unknown) => {
          console.error('Falha ao carregar mais lançamentos:', err);
          concluir();
        },
      });
  }

  mesAnterior(): void {
    let mes = this.dashboardService.mes() - 1;
    let ano = this.dashboardService.ano();
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    }
    this.dashboardService.mes.set(mes);
    this.dashboardService.ano.set(ano);
    this.headerState.setYear(ano);
    this.headerState.setMonth(mes);
    this.carregarExtrato();
  }

  proximoMes(): void {
    let mes = this.dashboardService.mes() + 1;
    let ano = this.dashboardService.ano();
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    this.dashboardService.mes.set(mes);
    this.dashboardService.ano.set(ano);
    this.headerState.setYear(ano);
    this.headerState.setMonth(mes);
    this.carregarExtrato();
  }

  selecionarMes(novoMes: number): void {
    if (novoMes >= 1 && novoMes <= 12 && novoMes !== this.dashboardService.mes()) {
      this.dashboardService.mes.set(novoMes);
      this.headerState.setMonth(novoMes);
      this.carregarExtrato();
    }
  }

  abrirModalNovaTransacao(): void {
    this.modalNovaTransacaoAberto.set(true);
  }

  fecharModalNovaTransacao(): void {
    this.modalNovaTransacaoAberto.set(false);
  }

  onTransacaoCriada(): void {
    this.carregarExtrato();
  }
}
