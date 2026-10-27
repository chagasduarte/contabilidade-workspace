// card-details.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
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
} from 'ionicons/icons';
import { CardInvoice, CreateTransactionDto, InvoiceItem } from './card.model';
import { CardService } from './card.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { HeaderStateService } from '@org/shared-ui-navigation';

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
  ],
  templateUrl: './card-details.component.html',
  styleUrl: './card-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailsComponent implements OnInit {
  @Input() id?: string;

  private readonly route = inject(ActivatedRoute);
  readonly cardService = inject(CardService);
  readonly categoriaService = inject(CategoriaService);
  private readonly dashboardService = inject(DashboardService);
  private readonly headerState = inject(HeaderStateService);
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
      this.faturas().find((f) => String(f.data_vencimento).substring(0, 7) === alvo) ?? null
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
    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
    }
    this.compraForm.reset({
      descricao: '',
      valor_total: null,
      quantidade_parcelas: 1,
      data_compra: new Date().toISOString().substring(0, 10),
      categoria_id: null,
    });
    this.modalNovaCompraAberto.set(true);
  }

  fecharModalNovaCompra(): void {
    this.modalNovaCompraAberto.set(false);
  }

  async salvarNovaCompra(): Promise<void> {
    if (this.compraForm.invalid) {
      this.compraForm.markAllAsTouched();
      return;
    }

    const cId = this.cardId();
    if (!cId) return;

    const val = this.compraForm.getRawValue();
    const valor = Number(val.valor_total);
    const parcelas = Number(val.quantidade_parcelas);

    const cartao = this.cartaoDetalhes();
    if (cartao && valor > cartao.limite_disponivel) {
      const toast = await this.toastController.create({
        message: `Limite insuficiente! Disponível: R$ ${cartao.limite_disponivel.toFixed(2)}`,
        duration: 3500,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Processando compra no cartão...',
      spinner: 'crescent',
    });
    await loading.present();

    const categoriaId =
      val.categoria_id != null && val.categoria_id !== ''
        ? Number(val.categoria_id)
        : null;

    const payload: CreateTransactionDto = {
      cartao_id: cId,
      descricao: val.descricao.trim(),
      valor_total: valor,
      quantidade_parcelas: parcelas,
      data_compra: val.data_compra,
      categoria_id: categoriaId,
    };

    this.cardService.lancarTransacao(payload).subscribe({
      next: async () => {
        await loading.dismiss();
        this.fecharModalNovaCompra();

        const toast = await this.toastController.create({
          message: parcelas > 1
            ? `Compra parcelada em ${parcelas}x registrada com sucesso!`
            : 'Compra à vista registrada com sucesso!',
          duration: 3000,
          color: 'success',
          position: 'top',
        });
        await toast.present();

        this.carregarDados();
      },
      error: async (err: unknown) => {
        await loading.dismiss();
        const msg = err instanceof Error ? err.message : 'Erro ao processar compra.';
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

