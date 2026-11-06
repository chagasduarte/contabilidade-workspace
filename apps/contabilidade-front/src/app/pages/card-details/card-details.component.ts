// card-details.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  Input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { Subcategoria } from '@contabilidade/models';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  AlertController,
  ToastController,
  LoadingController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  walletOutline,
  calendarOutline,
  chevronBackOutline,
  chevronForwardOutline,
  addOutline,
  checkmarkCircleOutline,
  timeOutline,
  alertCircleOutline,
  cashOutline,
  refreshOutline,
  pricetagOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  receiptOutline,
  closeOutline,
  checkmarkOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { CardInvoice, CreateTransactionDto, InvoiceItem } from './card.model';
import { CardService } from './card.service';
import { ParcelamentoService } from '../../core/services/parcelamento.service';
import { mensagemErroHttp } from '../../core/utils/http-error';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';

const MESES_NOME = [
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
  selector: 'app-card-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonBackButton,
    IonIcon,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardContent,
    IonProgressBar,
    IonList,
    IonLabel,
    IonBadge,
    IonChip,
    IonSpinner,
    IonFab,
    IonFabButton,
    MonthSelector,
  ],
  templateUrl: './card-details.component.html',
  styleUrl: './card-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailsComponent implements OnInit {
  @Input() id?: string;

  private readonly destroyRef = inject(DestroyRef);
  readonly subcategoriasCompra = signal<Subcategoria[]>([]);
  readonly erroSubcategorias = signal<string | null>(null);
  readonly carregandoSubcategorias = signal(false);

  private readonly route = inject(ActivatedRoute);
  readonly cardService = inject(CardService);
  readonly categoriaService = inject(CategoriaService);
  private readonly dashboardService = inject(DashboardService);
  private readonly headerState = inject(HeaderStateService);
  private readonly parcelamentoService = inject(ParcelamentoService);
  readonly itemEmEdicao = signal<InvoiceItem | null>(null);
  readonly removendoCompra = signal<string | null>(null);
  private subcategoriaEdicaoPendente: number | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  readonly cardId = signal<string | null>(null);

  readonly categoriasDespesa = computed(() =>
    this.categoriaService
      .categorias()
      .filter((c) => (c.tipo ?? 'despesa') === 'despesa')
  );

  private readonly nomesCategorias = computed(
    () => new Map(this.categoriaService.categorias().map((c) => [c.id, c.nome]))
  );

  // Re-exporta signals do serviço
  readonly cartaoDetalhes = this.cardService.cartaoSelecionado;
  readonly faturaDetalhes = this.cardService.faturaSelecionada;
  readonly loading = this.cardService.loading;
  readonly error = this.cardService.error;

  // Faturas do cartão; o mês exibido é o mês global (o mesmo do seletor do cabeçalho)
  readonly faturas = signal<CardInvoice[]>([]);
  readonly mes = this.dashboardService.mes;
  readonly ano = this.dashboardService.ano;

  // Modal de Nova Compra
  readonly modalNovaCompraAberto = signal<boolean>(false);
  readonly salvandoCompra = signal<boolean>(false);
  compraForm!: FormGroup;

  // Computado: percentual de limite consumido
  readonly percentualLimite = computed(() => {
    const c = this.cartaoDetalhes();
    if (!c || c.limite_total <= 0) return 0;
    const ratio = c.limite_comprometido / c.limite_total;
    return Math.min(1, Math.max(0, ratio));
  });

  /**
   * Fatura que vence no mês selecionado ("fatura de novembro" = a que vence em novembro),
   * mesmo critério de Lançamentos, Contas a Pagar e do dashboard.
   */
  readonly faturaAtiva = computed<CardInvoice | null>(() => {
    const alvo = `${this.ano()}-${String(this.mes()).padStart(2, '0')}`;
    return (
      this.faturas().find((f) => String(f.data_vencimento).substring(0, 7) === alvo) ??
      this.faturas().find(
        (f) => Number(f.ano_referencia) === this.ano() && Number(f.mes_referencia) === this.mes()
      ) ??
      null
    );
  });

  /** Itens só da fatura ativa: evita mostrar os da fatura anterior enquanto a nova carrega. */
  readonly detalhesFaturaAtiva = computed(() => {
    const det = this.faturaDetalhes();
    const fat = this.faturaAtiva();
    return det && fat && det.fatura.id === fat.id ? det : null;
  });

  // Computado: título do mês selecionado (ex: "Outubro 2026")
  readonly tituloFaturaAtiva = computed(
    () => `${MESES_NOME[this.mes() - 1] ?? `Mês ${this.mes()}`} ${this.ano()}`
  );

  // Computado: melhor dia de compra (dia seguinte ao fechamento)
  readonly melhorDiaCompra = computed(() => {
    const c = this.cartaoDetalhes()?.cartao;
    if (!c) return 1;
    let dia = c.dia_fechamento + 1;
    if (dia > 31) dia = 1;
    return dia;
  });

  constructor() {
    addIcons({
      cardOutline,
      walletOutline,
      calendarOutline,
      chevronBackOutline,
      chevronForwardOutline,
      addOutline,
      checkmarkCircleOutline,
      timeOutline,
      alertCircleOutline,
      cashOutline,
      refreshOutline,
      pricetagOutline,
      shieldCheckmarkOutline,
      sparklesOutline,
      receiptOutline,
      closeOutline,
      checkmarkOutline,
      createOutline,
      trashOutline,
    });

    this.inicializarFormCompra();

    // Seletor de mês do cabeçalho
    effect(() => {
      const ano = this.headerState.selectedYear();
      const mes = this.headerState.selectedMonth();
      untracked(() => {
        if (ano !== this.ano() || mes !== this.mes()) {
          this.ano.set(ano);
          this.mes.set(mes);
          this.carregarDetalhesFaturaAtual();
        }
      });
    });
  }

  ngOnInit(): void {
    this.headerState.setYear(this.ano());
    this.headerState.setMonth(this.mes());

    const targetId = this.id || this.route.snapshot.paramMap.get('id');
    if (targetId) {
      this.cardId.set(targetId);
      this.carregarDados(targetId);
    }
    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
    }
  }

  private inicializarFormCompra(): void {
    const hojeIso = new Date().toISOString().substring(0, 10);
    this.compraForm = this.fb.group({
      descricao: ['', [Validators.required, Validators.minLength(2)]],
      valor_total: [null, [Validators.required, Validators.min(0.01)]],
      quantidade_parcelas: [1, [Validators.required, Validators.min(1), Validators.max(36)]],
      data_compra: [hojeIso, [Validators.required]],
      categoria_id: [null],
      subcategoria_id: [{ value: null, disabled: true }],
    });
    this.compraForm.get('categoria_id')?.valueChanges.pipe(
      tap((categoriaId) => {
        this.carregandoSubcategorias.set(categoriaId != null);
        if (Number(categoriaId) !== this.itemEmEdicao()?.categoria_id) this.subcategoriaEdicaoPendente = null;
        this.compraForm.get('subcategoria_id')?.reset(null);
        this.compraForm.get('subcategoria_id')?.disable();
        this.subcategoriasCompra.set([]);
        this.erroSubcategorias.set(null);
      }),
      switchMap((categoriaId) => categoriaId == null ? of([]) :
        this.categoriaService.listarSubcategorias(Number(categoriaId)).pipe(
          catchError(() => {
            this.erroSubcategorias.set('Não foi possível carregar as subcategorias. Selecione a categoria novamente para tentar.');
            return of([]);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((subs) => {
      this.carregandoSubcategorias.set(false);
      this.subcategoriasCompra.set(subs);
      if (subs.length > 0) this.compraForm.get('subcategoria_id')?.enable();
      if (subs.some(sub => sub.id === this.subcategoriaEdicaoPendente)) {
        this.compraForm.get('subcategoria_id')?.setValue(this.subcategoriaEdicaoPendente);
      }
      this.subcategoriaEdicaoPendente = null;
    });
  }

  carregarDados(id?: string): void {
    const targetId = id || this.cardId();
    if (!targetId) return;

    this.cardService.obterCartaoPorId(targetId).subscribe({
      next: (detalhes) => {
        this.faturas.set(detalhes.faturas ?? []);
        this.carregarDetalhesFaturaAtual();
      },
    });
  }

  handleRefresh(event: CustomEvent): void {
    const targetId = this.cardId();
    if (!targetId) {
      (event.target as HTMLIonRefresherElement).complete();
      return;
    }

    this.cardService.obterCartaoPorId(targetId).subscribe({
      next: (detalhes) => {
        const listaFaturas = detalhes.faturas ?? [];
        this.faturas.set(listaFaturas);
        this.carregarDetalhesFaturaAtual();
        (event.target as HTMLIonRefresherElement).complete();
      },
      error: () => {
        (event.target as HTMLIonRefresherElement).complete();
      },
    });
  }

  /** Seleciona diretamente um mês (1..12) pelo componente MonthSelector. */
  selecionarMes(novoMes: number): void {
    if (novoMes < 1 || novoMes > 12) return;
    this.mes.set(novoMes);
    this.headerState.setMonth(novoMes);
    this.carregarDetalhesFaturaAtual();
  }

  /** Avança ou volta um mês, mantendo o seletor do cabeçalho sincronizado. */
  navegarMes(direcao: 1 | -1): void {
    let mes = this.mes() + direcao;
    let ano = this.ano();
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    } else if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    this.mes.set(mes);
    this.ano.set(ano);
    this.headerState.setYear(ano);
    this.headerState.setMonth(mes);
    this.carregarDetalhesFaturaAtual();
  }

  private carregarDetalhesFaturaAtual(): void {
    const fatura = this.faturaAtiva();
    if (fatura) {
      this.cardService.obterDetalhesFatura(fatura.id).subscribe({ error: () => undefined });
    }
  }

  // --- Ações de Nova Compra ---
  abrirModalNovaCompra(): void {
    if (this.salvandoCompra() || this.removendoCompra()) return;
    this.itemEmEdicao.set(null);
    this.subcategoriaEdicaoPendente = null;
    this.compraForm.get('valor_total')?.enable();
    this.compraForm.get('quantidade_parcelas')?.enable();
    this.compraForm.get('data_compra')?.enable();
    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
    }
    this.compraForm.reset({
      descricao: '',
      valor_total: null,
      quantidade_parcelas: 1,
      data_compra: new Date().toISOString().substring(0, 10),
      categoria_id: null,
      subcategoria_id: null,
    });
    this.modalNovaCompraAberto.set(true);
  }

  editarDespesa(item: InvoiceItem): void {
    if (this.salvandoCompra() || this.removendoCompra()) return;
    this.abrirModalNovaCompra();
    this.itemEmEdicao.set(item);
    this.subcategoriaEdicaoPendente = item.subcategoria_id ?? null;
    this.compraForm.patchValue({
      descricao: item.descricao, valor_total: item.valor_parcela,
      quantidade_parcelas: item.quantidade_parcelas ?? 1,
      data_compra: String(item.data_compra ?? '').substring(0, 10),
      categoria_id: item.categoria_id ?? null,
    });
    this.compraForm.get('quantidade_parcelas')?.disable();
    this.compraForm.get('data_compra')?.disable();
    const fatura = this.detalhesFaturaAtiva()?.fatura;
    if (fatura?.status === 'PAID' || Number(fatura?.valor_pago) > 0) this.compraForm.get('valor_total')?.disable();
  }

  fecharModalNovaCompra(): void {
    if (this.salvandoCompra()) return;
    this.modalNovaCompraAberto.set(false);
    this.itemEmEdicao.set(null);
  }

  async removerDespesa(item: InvoiceItem): Promise<void> {
    if (this.removendoCompra() || this.salvandoCompra()) return;
    this.removendoCompra.set(item.transacao_id);
    try {
      const alert = await this.alertController.create({
        header: 'Excluir despesa do cartão?', subHeader: item.descricao,
        message: `A compra inteira e todas as suas ${item.quantidade_parcelas ?? 1} parcela(s) serão excluídas definitivamente, inclusive as já pagas. Deseja continuar?`,
        buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Excluir compra', role: 'confirm' }],
      });
      await alert.present();
      if ((await alert.onDidDismiss()).role !== 'confirm') return;
      await firstValueFrom(this.parcelamentoService.excluir('cartao', item.transacao_id));
      this.cardService.faturaSelecionada.set(null);
      this.carregarDados();
      const toast = await this.toastController.create({ message: 'Compra e parcelas excluídas.', duration: 3000, color: 'success' });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({ message: mensagemErroHttp(error, 'Erro ao excluir despesa.'), duration: 4000, color: 'danger' });
      await toast.present();
    } finally {
      this.removendoCompra.set(null);
    }
  }

  async salvarNovaCompra(): Promise<void> {
    if (this.salvandoCompra() || this.removendoCompra()) return;
    if (this.carregandoSubcategorias() || this.erroSubcategorias()) return;
    if (this.compraForm.invalid) { this.compraForm.markAllAsTouched(); return; }
    const cId = this.cardId();
    if (!cId) return;
    const val = this.compraForm.getRawValue();
    const valor = Number(val.valor_total);
    const item = this.itemEmEdicao();
    const cartao = this.cartaoDetalhes();
    if (cartao && valor - (item?.valor_parcela ?? 0) > cartao.limite_disponivel) {
      const toast = await this.toastController.create({ message: 'Limite insuficiente para este valor.', duration: 3500, color: 'danger' });
      await toast.present();
      return;
    }
    const categoriaId = val.categoria_id == null || val.categoria_id === '' ? null : Number(val.categoria_id);
    const subcategoriaId = this.subcategoriasCompra().some(sub => sub.id === Number(val.subcategoria_id))
      ? Number(val.subcategoria_id) : null;
    const payload: CreateTransactionDto = {
      cartao_id: cId, descricao: val.descricao.trim(), valor_total: valor,
      quantidade_parcelas: Number(val.quantidade_parcelas), data_compra: val.data_compra,
      categoria_id: categoriaId, subcategoria_id: subcategoriaId,
    };
    this.salvandoCompra.set(true);
    let loading: HTMLIonLoadingElement | undefined;
    try {
      loading = await this.loadingController.create({ message: 'Salvando despesa...', spinner: 'crescent' });
      await loading.present();
      if (item) {
        await firstValueFrom(this.cardService.atualizarItem(item.id, {
          descricao: payload.descricao, valor_parcela: valor,
          categoria_id: categoriaId, subcategoria_id: subcategoriaId,
        }));
      } else {
        await firstValueFrom(this.cardService.lancarTransacao(payload));
      }
      this.modalNovaCompraAberto.set(false);
      this.itemEmEdicao.set(null);
      this.carregarDados();
      const toast = await this.toastController.create({ message: item ? 'Despesa atualizada.' : 'Compra registrada com sucesso!', duration: 3000, color: 'success' });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({ message: mensagemErroHttp(error, 'Erro ao salvar despesa.'), duration: 4000, color: 'danger' });
      await toast.present();
    } finally {
      await loading?.dismiss();
      this.salvandoCompra.set(false);
    }
  }

  // --- Ação de Pagamento de Fatura ---
  async abrirConfirmacaoPagamento(fatura: CardInvoice): Promise<void> {
    const totalFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(fatura.total_fatura ?? 0);

    const alert = await this.alertController.create({
      header: 'Pagar Fatura',
      subHeader: `${this.tituloFaturaAtiva()} - Total: ${totalFormatado}`,
      message:
        'Deseja confirmar a liquidação desta fatura? O limite disponível do seu cartão será recomposto imediatamente.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Confirmar Pagamento',
          role: 'confirm',
          handler: () => {
            this.executarPagamentoFatura(fatura);
          },
        },
      ],
    });

    await alert.present();
  }

  private async executarPagamentoFatura(fatura: CardInvoice): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Liquidando fatura...',
      spinner: 'crescent',
    });
    await loading.present();

    this.cardService.pagarFatura(fatura.id).subscribe({
      next: async () => {
        await loading.dismiss();

        const toast = await this.toastController.create({
          message: 'Fatura quitada com sucesso! Seu limite foi restabelecido.',
          duration: 3500,
          color: 'success',
          position: 'top',
        });
        await toast.present();

        this.carregarDados();
      },
      error: async (err: unknown) => {
        await loading.dismiss();
        const msg = err instanceof Error ? err.message : 'Erro ao pagar fatura.';
        const toast = await this.toastController.create({
          message: msg,
          duration: 4000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  obterNomeCategoria(item: InvoiceItem): string | null {
    if (item.categoria_nome) return item.categoria_nome;
    if (item.categoria_id != null) {
      return this.nomesCategorias().get(Number(item.categoria_id)) ?? null;
    }
    return null;
  }

  obterCorStatus(status: string): string {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'OPEN':
        return 'primary';
      case 'CLOSED':
        return 'warning';
      case 'OVERDUE':
        return 'danger';
      default:
        return 'medium';
    }
  }

  obterLabelStatus(status: string): string {
    switch (status) {
      case 'PAID':
        return 'Fatura Paga';
      case 'OPEN':
        return 'Fatura Aberta';
      case 'CLOSED':
        return 'Fatura Fechada';
      case 'OVERDUE':
        return 'Vencida';
      default:
        return status;
    }
  }
}

