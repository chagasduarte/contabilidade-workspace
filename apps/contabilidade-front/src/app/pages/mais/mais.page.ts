import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AlertController, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cardOutline,
  cashOutline,
  pricetagOutline,
  walletOutline,
  barChartOutline,
  settingsOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  flashOutline,
  trendingUpOutline,
  logOutOutline,
  pieChartOutline,
  flagOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { TransactionModal } from '../../components/modals/transaction-modal/transaction-modal';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';

export interface QuickMenuItem {
  title: string;
  subtitle: string;
  route: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-mais',
  standalone: true,
  imports: [CommonModule, RouterModule, IonIcon, TransactionModal],
  templateUrl: './mais.page.html',
  styleUrl: './mais.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaisPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService, { optional: true });
  private readonly alertCtrl = inject(AlertController);

  readonly currentUser = this.authService.currentUser;
  readonly userInitial = computed(() => {
    const nome = this.currentUser()?.nome;
    return (nome?.charAt(0) || 'U').toUpperCase();
  });

  readonly modalNovaTransacaoAberto = signal<boolean>(false);

  readonly menuItems: QuickMenuItem[] = [
    {
      title: 'Categorias',
      subtitle: 'Gerencie categorias e subcategorias de receitas e despesas',
      route: '/categorias',
      icon: 'pricetag-outline',
      color: '#38bdf8',
    },
    {
      title: 'Assistente IA',
      subtitle: 'Registre lançamentos por texto ou foto do recibo',
      route: '/assistente',
      icon: 'sparkles-outline',
      color: '#4ade80',
    },
    {
      title: 'Planejamento',
      subtitle: 'Orçamento do mês por categoria: planejado x realizado',
      route: '/planejamento',
      icon: 'pie-chart-outline',
      color: '#f97316',
    },
    {
      title: 'Objetivos',
      subtitle: 'Metas financeiras com progresso e quanto guardar por mês',
      route: '/objetivos',
      icon: 'flag-outline',
      color: '#eab308',
    },
    {
      title: 'Cartões de Crédito',
      subtitle: 'Controle limites, faturas abertas e compras parceladas',
      route: '/cartoes',
      icon: 'card-outline',
      color: '#ec4899',
    },
    {
      title: 'Contas Bancárias',
      subtitle: 'Acompanhe contas bancárias e saldos disponíveis em um só lugar',
      route: '/contas',
      icon: 'wallet-outline',
      color: '#a78bfa',
    },
    {
      title: 'Empréstimos & Financiamentos',
      subtitle: 'Controle contratos, cronograma de parcelas e amortização com desconto',
      route: '/emprestimos',
      icon: 'cash-outline',
      color: '#10b981',
    },
    {
      title: 'Relatórios Financeiros',
      subtitle: 'Gráficos de evolução, fluxo de caixa e projeções',
      route: '/relatorios',
      icon: 'bar-chart-outline',
      color: '#fbbf24',
    },
    {
      title: 'Configurações',
      subtitle: 'Preferências da conta, segurança e customizações',
      route: '/configuracoes',
      icon: 'settings-outline',
      color: '#94a3b8',
    },
  ];

  constructor() {
    addIcons({
      addOutline,
      cardOutline,
      cashOutline,
      pricetagOutline,
      walletOutline,
      barChartOutline,
      settingsOutline,
      checkmarkCircleOutline,
      chevronForwardOutline,
      flashOutline,
      trendingUpOutline,
      logOutOutline,
      pieChartOutline,
      flagOutline,
      sparklesOutline,
    });
  }

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('action') === 'nova-transacao') {
      this.abrirModalNovaTransacao();
    }
  }

  async confirmarLogout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sair da Conta',
      message: 'Tem certeza de que deseja encerrar sua sessão?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Sair',
          role: 'destructive',
          handler: () => {
            this.authService.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  abrirModalNovaTransacao(): void {
    this.modalNovaTransacaoAberto.set(true);
  }

  fecharModalNovaTransacao(): void {
    this.modalNovaTransacaoAberto.set(false);
  }

  onTransacaoCriada(): void {
    this.dashboardService?.carregarResumo().subscribe({ error: () => undefined });
  }
}

