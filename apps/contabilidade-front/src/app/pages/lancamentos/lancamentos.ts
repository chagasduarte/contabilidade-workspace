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
} from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  addOutline,
} from 'ionicons/icons';
import { TransacaoService } from '../../core/services/transacao.service';
import { DashboardService } from '../../core/services/dashboard.service';
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
    IonIcon,
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

  readonly modalNovaTransacaoAberto = signal<boolean>(false);

  readonly periodoLabel = computed<string>(() => {
    const mesIdx = this.dashboardService.mes() - 1;
    const nomeMes = MESES_PT[mesIdx] ?? 'Mês';
    return `${nomeMes} ${this.dashboardService.ano()}`;
  });

  readonly transactions = computed<TransactionViewItem[]>(() => {
    const term = this.headerState.searchTerm().trim().toLowerCase();
    const raw = this.transacaoService.extrato().map((item) => {
      const isIncome = item.tipo === 'entrada';
      const isPending = item.status === 'pendente';

      return {
        id: item.id,
        date: item.data,
        description: item.descricao,
        category: item.categoria ? String(item.categoria) : 'Geral',
        type: (isIncome ? 'Entrada' : 'Saída') as 'Entrada' | 'Saída',
        amount: Number(item.valor || 0),
        status: (isPending ? 'Pendente' : isIncome ? 'Recebido' : 'Pago') as
          | 'Recebido'
          | 'Pago'
          | 'Pendente',
      };
    });

    if (!term) {
      return raw;
    }

    return raw.filter(
      (t) =>
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term)
    );
  });

  readonly monthlyIncome = computed<number>(() =>
    this.transactions()
      .filter((t) => t.type === 'Entrada')
      .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly monthlyExpenses = computed<number>(() =>
    this.transactions()
      .filter((t) => t.type === 'Saída')
      .reduce((acc, t) => acc + t.amount, 0)
  );

  readonly pendingCount = computed<number>(
    () => this.transactions().filter((t) => t.status === 'Pendente').length
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
  }

  ngOnInit(): void {
    this.headerState.setYear(this.dashboardService.ano());
    if (isPlatformBrowser(this.platformId)) {
      this.carregarExtrato();
    }
  }

  carregarExtrato(): void {
    this.transacaoService
      .carregarExtrato(
        this.dashboardService.mes(),
        this.dashboardService.ano(),
        0
      )
      .subscribe({
        error: (err: unknown) => {
          console.error('Falha ao carregar extrato:', err);
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
    this.carregarExtrato();
  }

  selecionarMes(novoMes: number): void {
    if (novoMes >= 1 && novoMes <= 12 && novoMes !== this.dashboardService.mes()) {
      this.dashboardService.mes.set(novoMes);
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
