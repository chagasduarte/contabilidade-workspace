import {
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  addOutline,
  cardOutline,
  checkmarkCircleOutline,
  createOutline,
  trashOutline,
  ellipsisVertical,
  repeatOutline,
  cashOutline,
  pieChartOutline,
} from 'ionicons/icons';
import {
  DashboardDespesaItem,
  ExtratoFiltros,
  Transacao,
} from '@contabilidade/models';
import { TransacaoService } from '../../core/services/transacao.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import { PlanejamentoService } from '../../core/services/planejamento.service';
import { rotuloCategoria } from '../../core/utils/categoria-label';
import { mensagemErroHttp } from '../../core/utils/http-error';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';
import { TransactionModal } from '../../components/modals/transaction-modal/transaction-modal';

registerLocaleData(localePt, 'pt-BR');

export type OrigemItemView = 'CONTA' | 'CARTAO' | 'PLANEJADO' | 'EMPRESTIMO';
export type FiltroTipoLancamento = 'todos' | 'entrada' | 'saida';
export type FiltroStatusLancamento = 'todos' | 'pendente' | 'pago';

export interface TransactionViewItem {
  id: number | string;
  date: string;
  description: string;
  category: string;
  type: 'Entrada' | 'Saída';
  amount: number;
  status: 'Recebido' | 'Pago' | 'Pendente';
  origem: OrigemItemView;
  badgeLabel?: string;
  isCard?: boolean;
  cardLabel?: string;
  cardId?: string;
  loanId?: string;
  targetId?: string;
  isRecorrente?: boolean;
  isReadOnly?: boolean;
  raw: Transacao;
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
    DecimalPipe,
    RouterLink,
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly alertController = inject(AlertController, { optional: true });
  private readonly toastController = inject(ToastController, { optional: true });
  private readonly actionSheetController = inject(ActionSheetController, { optional: true });

  readonly transacaoService = inject(TransacaoService);
  readonly dashboardService = inject(DashboardService);
  readonly headerState = inject(HeaderStateService);
  private readonly categoriaService = inject(CategoriaService);
  readonly plannedTransactionService = inject(PlannedTransactionService, { optional: true });
  readonly planejamentoService = inject(PlanejamentoService, { optional: true });

  readonly modalNovaTransacaoAberto = signal<boolean>(false);
  readonly itemEmEdicao = signal<Transacao | null>(null);

  readonly filtroTipo = signal<FiltroTipoLancamento>('todos');
  readonly filtroStatus = signal<FiltroStatusLancamento>('todos');
  readonly hoje = new Date().toISOString().substring(0, 10);

  readonly periodoLabel = computed<string>(() => {
    const mesIdx = this.dashboardService.mes() - 1;
    const nomeMes = MESES_PT[mesIdx] ?? 'Mês';
    return `${nomeMes} ${this.dashboardService.ano()}`;
  });

  private readonly nomesCategorias = computed(
    () => new Map(this.categoriaService.categorias().map((c) => [c.id, c.nome]))
  );

  /** Todos os lançamentos carregados mapeados para exibição. */
  private readonly todasTransacoes = computed<TransactionViewItem[]>(() => {
    const nomes = this.nomesCategorias();
    return this.transacaoService.extrato().map((item) => {
      const isIncome = item.tipo === 'entrada';
      const isPending = item.status === 'pendente';

      const isCard =
        item.origem === 'CARTAO' ||
        item.source_type === 'CREDIT_CARD_ITEM' ||
        item.tipo === 'cartao';
      const isPlanned =
        !isCard &&
        (item.origem === 'PLANEJADO' ||
          item.origem === 'AVULSO' ||
          (item.source_type === 'PLANNED_TRANSACTION' && isPending));
      const isLoan =
        !isCard &&
        !isPlanned &&
        (item.origem === 'EMPRESTIMO' ||
          (item.source_type === 'LOAN_INSTALLMENT' && isPending));

      const origem: OrigemItemView = isCard
        ? 'CARTAO'
        : isPlanned
        ? 'PLANEJADO'
        : isLoan
        ? 'EMPRESTIMO'
        : 'CONTA';

      const isRecorrente = !!(
        item.is_recorrente ||
        item.parent_recurrence_id ||
        item.recorrencia === 'MENSAL'
      );

      const isSettledRecord =
        origem === 'CONTA' &&
        !isPending &&
        (item.source_type === 'PLANNED_TRANSACTION' ||
          item.source_type === 'LOAN_INSTALLMENT');

      let badgeLabel: string | undefined;
      if (isCard) {
        badgeLabel = item.origem_rotulo || 'Cartão';
      } else if (isPlanned) {
        badgeLabel = item.origem_rotulo || (isRecorrente ? 'Recorrente' : 'Avulso');
      } else if (isLoan) {
        badgeLabel = item.origem_rotulo ? `Empréstimo · ${item.origem_rotulo}` : 'Empréstimo';
      } else if (isSettledRecord) {
        badgeLabel =
          item.source_type === 'LOAN_INSTALLMENT' ? 'Empréstimo' : 'Conta efetivada';
      }

      const targetId = isPlanned
        ? String(item.target_id || item.source_id || String(item.id).replace(/^plan:/, ''))
        : isLoan
        ? String(item.target_id || String(item.id).replace(/^loan:/, ''))
        : String(item.id);

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
        origem,
        badgeLabel,
        isCard,
        cardLabel: isCard ? item.origem_rotulo || 'Cartão' : undefined,
        cardId: isCard && item.source_id ? String(item.source_id) : undefined,
        loanId: isLoan && item.source_id ? String(item.source_id) : undefined,
        targetId,
        isRecorrente,
        isReadOnly: isCard || isSettledRecord,
        raw: item,
      };
    });
  });

  readonly transactions = computed<TransactionViewItem[]>(() => {
    const term = this.headerState.searchTerm().trim().toLowerCase();
    const tipo = this.filtroTipo();
    const status = this.filtroStatus();

    return this.todasTransacoes().filter((t) => {
      if (tipo === 'entrada' && t.type !== 'Entrada') return false;
      if (tipo === 'saida' && t.type !== 'Saída') return false;
      if (status === 'pendente' && t.status !== 'Pendente') return false;
      if (status === 'pago' && t.status === 'Pendente') return false;

      if (!term) return true;
      return (
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        (t.cardLabel?.toLowerCase().includes(term) ?? false) ||
        (t.badgeLabel?.toLowerCase().includes(term) ?? false)
      );
    });
  });

  readonly temMaisPaginas = computed<boolean>(() => this.transacaoService.nextCursor() != null);

  readonly totaisParciais = computed<boolean>(
    () => !this.transacaoService.totaisExtrato() && this.temMaisPaginas()
  );

  readonly entradasPagas = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.entradas_pagas ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Entrada' && t.status !== 'Pendente')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly entradasPendentes = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.entradas_pendentes ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Entrada' && t.status === 'Pendente')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyIncome = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.entradas ??
      this.entradasPagas() + this.entradasPendentes()
  );

  readonly saidasPagas = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.saidas_pagas ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Saída' && t.status !== 'Pendente')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly saidasPendentes = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.saidas_pendentes ??
      this.todasTransacoes()
        .filter((t) => t.type === 'Saída' && t.status === 'Pendente')
        .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyExpenses = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.saidas ??
      this.saidasPagas() + this.saidasPendentes()
  );

  readonly pendingCount = computed<number>(
    () =>
      this.transacaoService.totaisExtrato()?.pendentes ??
      this.todasTransacoes().filter((t) => t.status === 'Pendente').length
  );

  /** Orçamento planejado de despesas do mês (GET /planejamento/resumo). */
  readonly orcamentoPlanejado = computed<number>(
    () => this.planejamentoService?.resumo?.()?.totais?.planejado ?? 0
  );

  readonly percentualOrcamento = computed<number | null>(() => {
    const plan = this.orcamentoPlanejado();
    if (!(plan > 0)) return null;
    return Math.min(100, Math.max(0, (this.saidasPagas() / plan) * 100));
  });

  /** Faturas de cartão abertas do mês (de GET /dashboard/resumo, sem somar nos totais). */
  readonly faturasCartaoAbertas = computed<DashboardDespesaItem[]>(() => {
    if (this.filtroTipo() === 'entrada' || this.filtroStatus() === 'pago') {
      return [];
    }
    const lista = this.dashboardService.despesas?.() ?? [];
    const vistas = new Set<string>();
    const resultado: DashboardDespesaItem[] = [];
    for (const item of lista) {
      if (item.origem === 'CARTAO' && item.status === 'pendente') {
        const chave = String(item.target_id || item.id);
        if (!vistas.has(chave)) {
          vistas.add(chave);
          resultado.push(item);
        }
      }
    }
    return resultado;
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      refreshOutline,
      addOutline,
      cardOutline,
      checkmarkCircleOutline,
      createOutline,
      trashOutline,
      ellipsisVertical,
      repeatOutline,
      cashOutline,
      pieChartOutline,
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
    const qp = this.route?.snapshot?.queryParamMap;
    if (qp) {
      this.sincronizarFiltrosDaUrl(qp.get('tipo'), qp.get('status'), false);
    }
    this.route?.queryParamMap?.subscribe((params) => {
      this.sincronizarFiltrosDaUrl(params.get('tipo'), params.get('status'), true);
    });

    this.headerState.setYear(this.dashboardService.ano());
    this.headerState.setMonth(this.dashboardService.mes());
    if (isPlatformBrowser(this.platformId)) {
      this.carregarExtrato();
      if (this.categoriaService.categorias().length === 0) {
        this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
      }
    }
  }

  private sincronizarFiltrosDaUrl(
    tipoParam: string | null,
    statusParam: string | null,
    recarregarSeMudou: boolean
  ): void {
    const novoTipo: FiltroTipoLancamento =
      tipoParam === 'entrada' || tipoParam === 'saida' ? tipoParam : 'todos';
    const novoStatus: FiltroStatusLancamento =
      statusParam === 'pendente' || statusParam === 'pago' ? statusParam : 'todos';

    const mudou = novoTipo !== this.filtroTipo() || novoStatus !== this.filtroStatus();
    this.filtroTipo.set(novoTipo);
    this.filtroStatus.set(novoStatus);

    if (mudou && recarregarSeMudou && isPlatformBrowser(this.platformId)) {
      this.carregarExtrato();
    }
  }

  private obterFiltrosApi(): ExtratoFiltros | undefined {
    const tipo = this.filtroTipo();
    const status = this.filtroStatus();
    if (tipo === 'todos' && status === 'todos') {
      return undefined;
    }
    const filtros: ExtratoFiltros = {};
    if (tipo !== 'todos') filtros.tipo = tipo;
    if (status !== 'todos') filtros.status = status;
    return filtros;
  }

  selecionarFiltroTipo(tipo: FiltroTipoLancamento): void {
    if (tipo === this.filtroTipo()) return;
    this.filtroTipo.set(tipo);
    this.atualizarQueryParamsUrl();
    this.carregarExtrato();
  }

  selecionarFiltroStatus(status: FiltroStatusLancamento): void {
    if (status === this.filtroStatus()) return;
    this.filtroStatus.set(status);
    this.atualizarQueryParamsUrl();
    this.carregarExtrato();
  }

  private atualizarQueryParamsUrl(): void {
    const tipo = this.filtroTipo();
    const status = this.filtroStatus();
    void this.router.navigate([], {
      relativeTo: this.route ?? undefined,
      queryParams: {
        tipo: tipo === 'todos' ? null : tipo,
        status: status === 'todos' ? null : status,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  carregarExtrato(): void {
    const mes = this.dashboardService.mes();
    const ano = this.dashboardService.ano();
    const filtros = this.obterFiltrosApi();

    const obs = filtros
      ? this.transacaoService.carregarExtratoPaginado(mes, ano, null, 50, filtros)
      : this.transacaoService.carregarExtratoPaginado(mes, ano);

    obs.subscribe({
      error: (err: unknown) => {
        console.error('Falha ao carregar extrato:', err);
      },
    });

    this.dashboardService.carregarResumo?.(mes, ano)?.subscribe({
      error: () => undefined,
    });

    this.planejamentoService?.carregarMes?.(mes, ano, 'despesa')?.subscribe({
      error: () => undefined,
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

    const mes = this.dashboardService.mes();
    const ano = this.dashboardService.ano();
    const filtros = this.obterFiltrosApi();

    const obs = filtros
      ? this.transacaoService.carregarExtratoPaginado(mes, ano, cursor, 50, filtros)
      : this.transacaoService.carregarExtratoPaginado(mes, ano, cursor);

    obs.subscribe({
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
    this.itemEmEdicao.set(null);
    this.modalNovaTransacaoAberto.set(true);
  }

  abrirEdicao(transaction: TransactionViewItem, event?: Event): void {
    event?.stopPropagation();
    if (transaction.isReadOnly) return;
    this.itemEmEdicao.set(transaction.raw);
    this.modalNovaTransacaoAberto.set(true);
  }

  fecharModalNovaTransacao(): void {
    this.modalNovaTransacaoAberto.set(false);
    this.itemEmEdicao.set(null);
  }

  onTransacaoCriada(): void {
    this.carregarExtrato();
  }

  abrirItemCartao(transaction: TransactionViewItem): void {
    if (transaction.isCard && transaction.cardId) {
      void this.router.navigate(['/cartoes', transaction.cardId]);
    } else if (transaction.origem === 'EMPRESTIMO' && transaction.loanId) {
      void this.router.navigate(['/emprestimos', transaction.loanId]);
    }
  }

  async efetivarItem(transaction: TransactionViewItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (transaction.status !== 'Pendente') return;

    if (transaction.origem === 'CONTA') {
      const idNum = Number(transaction.id);
      if (isNaN(idNum) || idNum <= 0) return;
      this.transacaoService.marcarComoPago(idNum).subscribe({
        next: () => {
          void this.avisar('Lançamento marcado como pago!', 'success');
          this.carregarExtrato();
        },
        error: (err: unknown) => {
          void this.avisar(mensagemErroHttp(err, 'Erro ao efetivar lançamento.'));
        },
      });
      return;
    }

    if (transaction.origem === 'PLANEJADO' && this.plannedTransactionService) {
      let valor = transaction.amount;
      let data = this.hoje;

      if (this.alertController) {
        const alert = await this.alertController.create({
          header: transaction.type === 'Entrada' ? 'Confirmar recebimento' : 'Confirmar pagamento',
          subHeader: transaction.description,
          inputs: [
            {
              name: 'valor',
              type: 'number',
              value: transaction.amount,
              min: 0.01,
              placeholder: 'Valor (R$)',
            },
            { name: 'data', type: 'date', value: this.hoje },
          ],
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Confirmar', role: 'confirm' },
          ],
        });
        await alert.present();
        const { role, data: alertData } = await alert.onDidDismiss<{
          values?: { valor?: string; data?: string };
        }>();
        if (role !== 'confirm') return;
        if (alertData?.values?.valor != null) {
          valor = Number(alertData.values.valor);
        }
        if (alertData?.values?.data) {
          data = alertData.values.data;
        }
      }

      if (!(valor > 0)) {
        await this.avisar('Informe um valor maior que zero.');
        return;
      }

      const targetId = String(transaction.targetId || transaction.id);
      this.plannedTransactionService
        .efetivar(targetId, {
          valor_pago: valor,
          data_pagamento: data,
          idcategoria: transaction.raw.idcategoria,
        })
        .subscribe({
          next: () => {
            void this.avisar(
              transaction.type === 'Entrada'
                ? 'Recebimento registrado com sucesso!'
                : 'Pagamento registrado com sucesso!',
              'success'
            );
            this.carregarExtrato();
          },
          error: (err: unknown) => {
            void this.avisar(mensagemErroHttp(err, 'Erro ao efetivar conta planejada.'));
          },
        });
      return;
    }

    if (transaction.origem === 'EMPRESTIMO') {
      let valor = transaction.amount;
      if (this.alertController) {
        const alert = await this.alertController.create({
          header: 'Pagar parcela de empréstimo',
          subHeader: transaction.description,
          inputs: [
            {
              name: 'valor',
              type: 'number',
              value: transaction.amount,
              min: 0.01,
              placeholder: 'Valor pago (R$)',
            },
          ],
          buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Confirmar', role: 'confirm' },
          ],
        });
        await alert.present();
        const { role, data: alertData } = await alert.onDidDismiss<{
          values?: { valor?: string };
        }>();
        if (role !== 'confirm') return;
        if (alertData?.values?.valor != null) {
          valor = Number(alertData.values.valor);
        }
      }

      const targetId = String(transaction.targetId || transaction.id);
      this.dashboardService.efetivarParcelaEmprestimo(targetId, valor).subscribe({
        next: () => {
          void this.avisar('Parcela de empréstimo paga com sucesso!', 'success');
          this.carregarExtrato();
        },
        error: (err: unknown) => {
          void this.avisar(mensagemErroHttp(err, 'Erro ao pagar parcela de empréstimo.'));
        },
      });
    }
  }

  async pularPlanejada(transaction: TransactionViewItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (transaction.origem !== 'PLANEJADO' || !this.plannedTransactionService) return;

    const ok = await this.confirmarAcao(
      'Pular este mês?',
      `"${transaction.description}" não será considerada neste mês. As próximas ocorrências continuam.`,
      'Pular'
    );
    if (!ok) return;

    const targetId = String(transaction.targetId || transaction.id);
    this.plannedTransactionService.pular(targetId).subscribe({
      next: () => {
        void this.avisar('Ocorrência pulada neste mês.', 'success');
        this.carregarExtrato();
      },
      error: (err: unknown) => {
        void this.avisar(mensagemErroHttp(err, 'Erro ao pular ocorrência.'));
      },
    });
  }

  async excluirOuCancelar(transaction: TransactionViewItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (transaction.isReadOnly) return;

    if (transaction.origem === 'PLANEJADO' && this.plannedTransactionService) {
      const ok = await this.confirmarAcao(
        'Cancelar conta?',
        `"${transaction.description}" deixará de aparecer como pendente.`,
        'Cancelar conta'
      );
      if (!ok) return;

      const targetId = String(transaction.targetId || transaction.id);
      this.plannedTransactionService.cancelar(targetId).subscribe({
        next: () => {
          void this.avisar('Conta planejada cancelada.', 'success');
          this.carregarExtrato();
        },
        error: (err: unknown) => {
          void this.avisar(mensagemErroHttp(err, 'Erro ao cancelar conta.'));
        },
      });
      return;
    }

    if (transaction.origem === 'CONTA') {
      const idNum = Number(transaction.id);
      if (isNaN(idNum) || idNum <= 0) return;

      const ok = await this.confirmarAcao(
        'Excluir lançamento?',
        `Deseja realmente excluir "${transaction.description}"?`,
        'Excluir'
      );
      if (!ok) return;

      this.transacaoService.excluirTransacao(idNum).subscribe({
        next: () => {
          void this.avisar('Lançamento excluído.', 'success');
          this.carregarExtrato();
        },
        error: (err: unknown) => {
          void this.avisar(mensagemErroHttp(err, 'Erro ao excluir lançamento.'));
        },
      });
    }
  }

  async abrirMenuAcoes(transaction: TransactionViewItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.actionSheetController || transaction.isReadOnly) return;

    const buttons: {
      text: string;
      role?: string;
      handler?: () => void;
    }[] = [];

    if (transaction.status === 'Pendente') {
      buttons.push({
        text: transaction.type === 'Entrada' ? 'Receber' : 'Pagar',
        handler: () => void this.efetivarItem(transaction),
      });
    }

    if (transaction.origem === 'CONTA' || transaction.origem === 'PLANEJADO') {
      buttons.push({
        text: 'Editar',
        handler: () => this.abrirEdicao(transaction),
      });
    }

    if (transaction.origem === 'PLANEJADO' && transaction.isRecorrente) {
      buttons.push({
        text: 'Pular este mês',
        handler: () => void this.pularPlanejada(transaction),
      });
    }

    if (transaction.origem === 'EMPRESTIMO' && transaction.loanId) {
      buttons.push({
        text: 'Ver contrato de empréstimo',
        handler: () => this.abrirItemCartao(transaction),
      });
    }

    if (transaction.origem === 'CONTA' || transaction.origem === 'PLANEJADO') {
      buttons.push({
        text: transaction.origem === 'PLANEJADO' ? 'Cancelar conta' : 'Excluir',
        role: 'destructive',
        handler: () => void this.excluirOuCancelar(transaction),
      });
    }

    buttons.push({ text: 'Fechar', role: 'cancel' });

    const sheet = await this.actionSheetController.create({
      header: transaction.description,
      buttons,
    });
    await sheet.present();
  }

  async pagarFatura(fatura: DashboardDespesaItem): Promise<void> {
    if (this.alertController) {
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(fatura.valor || 0));

      const alert = await this.alertController.create({
        header: 'Pagar fatura',
        subHeader: `${fatura.descricao} — ${valorFormatado}`,
        message: 'Deseja confirmar o pagamento desta fatura de cartão?',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Confirmar', role: 'confirm' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'confirm') return;
    }

    const faturaId = String(fatura.target_id || String(fatura.id).replace(/^card-/, ''));
    this.dashboardService.pagarFaturaCartao(faturaId, Number(fatura.valor)).subscribe({
      next: () => {
        void this.avisar('Fatura paga com sucesso!', 'success');
        this.carregarExtrato();
      },
      error: (err: unknown) => {
        void this.avisar(mensagemErroHttp(err, 'Erro ao pagar fatura.'));
      },
    });
  }

  private async confirmarAcao(
    header: string,
    message: string,
    acao: string
  ): Promise<boolean> {
    if (!this.alertController) return true;
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        { text: acao, role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  private async avisar(
    message: string,
    color: 'success' | 'danger' = 'danger'
  ): Promise<void> {
    if (!this.toastController) return;
    const toast = await this.toastController.create({
      message,
      color,
      duration: color === 'danger' ? 4000 : 2500,
      position: 'bottom',
    });
    await toast.present();
  }
}
