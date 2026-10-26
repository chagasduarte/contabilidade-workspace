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
import { firstValueFrom } from 'rxjs';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
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
  cashOutline,
  walletOutline,
  trendingDownOutline,
  sparklesOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  timeOutline,
  calendarOutline,
  arrowForwardOutline,
  flashOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  receiptOutline,
  pieChartOutline,
  businessOutline,
  alertCircleOutline,
  ribbonOutline,
} from 'ionicons/icons';
import {
  LoanInstallment,
  PaymentPayload,
} from './loan.model';
import { LoanService } from './loan.service';

@Component({
  selector: 'app-loan-details',
  standalone: true,
  imports: [
    CommonModule,
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
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonProgressBar,
    IonList,
    IonLabel,
    IonBadge,
    IonChip,
    IonSpinner,
  ],
  templateUrl: './loan-details.component.html',
  styleUrl: './loan-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanDetailsComponent implements OnInit {
  @Input() id?: string;

  private readonly route = inject(ActivatedRoute);
  readonly loanService = inject(LoanService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  readonly loanId = signal<string | null>(null);

  // Re-exporta signals do serviço
  readonly resumo = this.loanService.resumo;
  readonly loading = this.loanService.loading;
  readonly error = this.loanService.error;

  // Métricas computadas da quitação
  readonly progresso = computed(() => {
    const parcelas = this.resumo()?.installments ?? this.resumo()?.parcelas ?? [];
    const total = parcelas.length;
    if (total === 0) return { pagas: 0, total: 0, percentual: 0, formatado: '0%' };

    const pagas = parcelas.filter((p) => p.status === 'PAID').length;
    const percentual = pagas / total;
    return {
      pagas,
      total,
      percentual,
      formatado: `${Math.round(percentual * 100)}%`,
    };
  });

  constructor() {
    addIcons({
      cashOutline,
      walletOutline,
      trendingDownOutline,
      sparklesOutline,
      checkmarkCircle,
      checkmarkCircleOutline,
      timeOutline,
      calendarOutline,
      arrowForwardOutline,
      flashOutline,
      refreshOutline,
      shieldCheckmarkOutline,
      receiptOutline,
      pieChartOutline,
      businessOutline,
      alertCircleOutline,
      ribbonOutline,
    });
  }

  ngOnInit(): void {
    const targetId = this.id || this.route.snapshot.paramMap.get('id');
    if (targetId) {
      this.loanId.set(targetId);
      this.carregarResumo(targetId);
    }
  }

  ionViewWillEnter(): void {
    const targetId = this.loanId() || this.id || this.route.snapshot.paramMap.get('id');
    if (targetId && !this.resumo()) {
      this.loanId.set(targetId);
      this.carregarResumo(targetId);
    }
  }

  /**
   * Carrega ou recarrega o resumo consolidado do contrato.
   */
  carregarResumo(id?: string): void {
    const targetId = id || this.loanId();
    if (!targetId) return;

    this.loanService.obterResumo(targetId).subscribe({
      error: async (err) => {
        const toast = await this.toastController.create({
          message: err.message || 'Falha ao buscar dados do empréstimo.',
          duration: 3500,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  /**
   * Suporte para Pull-to-refresh nativo do Ionic.
   */
  handleRefresh(event: CustomEvent): void {
    const targetId = this.loanId();
    if (!targetId) {
      (event.target as HTMLIonRefresherElement).complete();
      return;
    }

    this.loanService.obterResumo(targetId).subscribe({
      next: () => {
        (event.target as HTMLIonRefresherElement).complete();
      },
      error: () => {
        (event.target as HTMLIonRefresherElement).complete();
      },
    });
  }

  /**
   * Dispara o alerta interativo solicitando desconto e método para liquidação antecipada.
   */
  async abrirModalAntecipacao(parcela: LoanInstallment): Promise<void> {
    const valorOriginal = Number(parcela.original_amount ?? parcela.valor_original ?? 0);
    const numParcela = parcela.installment_number ?? parcela.numero_parcela ?? 0;

    const valorOriginalFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valorOriginal);

    const alert = await this.alertController.create({
      header: `Antecipar Parcela #${numParcela}`,
      subHeader: `Valor original: ${valorOriginalFormatado}`,
      message:
        'Informe o valor do desconto/abatimento concedido pela instituição para antecipação de juros futuros:',
      inputs: [
        {
          name: 'desconto',
          type: 'number',
          placeholder: 'Desconto obtido (R$)',
          min: 0,
          max: valorOriginal,
          value: '0',
          attributes: {
            step: '0.01',
          },
        },
        {
          name: 'metodo_pagamento',
          type: 'text',
          placeholder: 'Método (ex: PIX, Débito, Boleto)',
          value: 'PIX',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Confirmar Pagamento',
          handler: (data: { desconto?: string; metodo_pagamento?: string }) => {
            this.processarPagamento(parcela, data);
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Calcula o valor líquido e dispara a liquidação com feedback via Loading e Toast.
   */
  async processarPagamento(
    parcela: LoanInstallment,
    data: { desconto?: string; metodo_pagamento?: string }
  ): Promise<void> {
    const valorOriginal = Number(parcela.original_amount ?? parcela.valor_original ?? 0);
    const numParcela = parcela.installment_number ?? parcela.numero_parcela ?? 0;
    const desconto = Math.max(0, parseFloat(data.desconto || '0') || 0);
    const metodo = (data.metodo_pagamento || 'PIX').trim() || 'PIX';

    if (desconto > valorOriginal) {
      const toast = await this.toastController.create({
        message: 'O valor do desconto não pode ser superior ao valor da parcela.',
        duration: 3500,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    const valorLiquido = Number((valorOriginal - desconto).toFixed(2));

    const loading = await this.loadingController.create({
      message: `Processando liquidação da parcela #${numParcela}...`,
      spinner: 'crescent',
    });
    await loading.present();

    const payload: PaymentPayload = {
      loan_id: parcela.loan_id || parcela.emprestimo_id,
      installment_id: parcela.id,
      amount_paid: valorLiquido,
      discount_amount: desconto,
      penalty_interest: 0,
      payment_method: metodo,

      // Aliases para compatibilidade
      emprestimo_id: parcela.loan_id || parcela.emprestimo_id,
      parcela_id: parcela.id,
      valor_pago: valorLiquido,
      valor_desconto: desconto,
      multa_juros: 0,
      metodo_pagamento: metodo,
    };

    try {
      await firstValueFrom(this.loanService.registrarPagamento(payload));
      await loading.dismiss();

      const economiaFormatada = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(desconto);

      const msg =
        desconto > 0
          ? `Parcela #${parcela.numero_parcela} antecipada com sucesso! Economia de ${economiaFormatada} em juros.`
          : `Parcela #${parcela.numero_parcela} paga com sucesso!`;

      const toast = await this.toastController.create({
        message: msg,
        duration: 4000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

      // Recarrega o resumo para atualizar saldos e listas
      this.carregarResumo();
    } catch (err: unknown) {
      await loading.dismiss();
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao processar o pagamento da parcela.';

      const toast = await this.toastController.create({
        message: msg,
        duration: 4500,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    }
  }
}

