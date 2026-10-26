// card-details.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
} from 'ionicons/icons';
import { CardInvoice, CreateTransactionDto } from './card.model';
import { CardService } from './card.service';

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
  private readonly fb = inject(FormBuilder);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  readonly cardId = signal<string | null>(null);

  // Re-exporta signals do serviço
  readonly cartaoDetalhes = this.cardService.cartaoSelecionado;
  readonly faturaDetalhes = this.cardService.faturaSelecionada;
  readonly loading = this.cardService.loading;
  readonly error = this.cardService.error;

  // Lista de faturas ordenadas e índice de navegação
  readonly faturas = signal<CardInvoice[]>([]);
  readonly indiceFaturaAtual = signal<number>(0);

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

  // Computado: fatura ativa selecionada no carrossel
  readonly faturaAtiva = computed<CardInvoice | null>(() => {
    const list = this.faturas();
    const idx = this.indiceFaturaAtual();
    return list[idx] || null;
  });

  // Computado: título do mês da fatura (ex: "Outubro 2026")
  readonly tituloFaturaAtiva = computed(() => {
    const fat = this.faturaAtiva();
    if (!fat) return 'Fatura';
    const nomeMes = MESES_NOME[fat.mes_referencia - 1] || `Mês ${fat.mes_referencia}`;
    return `${nomeMes} ${fat.ano_referencia}`;
  });

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
    });

    this.inicializarFormCompra();
  }

  ngOnInit(): void {
    const targetId = this.id || this.route.snapshot.paramMap.get('id');
    if (targetId) {
      this.cardId.set(targetId);
      this.carregarDados(targetId);
    }
  }

  private inicializarFormCompra(): void {
    const hojeIso = new Date().toISOString().substring(0, 10);
    this.compraForm = this.fb.group({
      descricao: ['', [Validators.required, Validators.minLength(2)]],
      valor_total: [null, [Validators.required, Validators.min(0.01)]],
      quantidade_parcelas: [1, [Validators.required, Validators.min(1), Validators.max(36)]],
      data_compra: [hojeIso, [Validators.required]],
    });
  }

  carregarDados(id?: string): void {
    const targetId = id || this.cardId();
    if (!targetId) return;

    this.cardService.obterCartaoPorId(targetId).subscribe({
      next: (detalhes) => {
        const listaFaturas = detalhes.faturas ?? [];
        this.faturas.set(listaFaturas);

        if (listaFaturas.length > 0) {
          // Seleciona a fatura aberta ou a do mês atual
          const hoje = new Date();
          const mesAtual = hoje.getMonth() + 1;
          const anoAtual = hoje.getFullYear();

          let idx = listaFaturas.findIndex(
            (f) => f.mes_referencia === mesAtual && f.ano_referencia === anoAtual
          );
          if (idx === -1) {
            idx = listaFaturas.findIndex((f) => f.status === 'OPEN');
          }
          if (idx === -1) {
            idx = listaFaturas.length - 1;
          }

          this.indiceFaturaAtual.set(Math.max(0, idx));
          this.carregarDetalhesFaturaAtual();
        }
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

  navegarFatura(direcao: number): void {
    const novoIdx = this.indiceFaturaAtual() + direcao;
    if (novoIdx >= 0 && novoIdx < this.faturas().length) {
      this.indiceFaturaAtual.set(novoIdx);
      this.carregarDetalhesFaturaAtual();
    }
  }

  private carregarDetalhesFaturaAtual(): void {
    const fatura = this.faturaAtiva();
    if (fatura) {
      this.cardService.obterDetalhesFatura(fatura.id).subscribe();
    }
  }

  // --- Ações de Nova Compra ---
  abrirModalNovaCompra(): void {
    this.compraForm.reset({
      descricao: '',
      valor_total: null,
      quantidade_parcelas: 1,
      data_compra: new Date().toISOString().substring(0, 10),
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

    const payload: CreateTransactionDto = {
      cartao_id: cId,
      descricao: val.descricao.trim(),
      valor_total: valor,
      quantidade_parcelas: parcelas,
      data_compra: val.data_compra,
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

