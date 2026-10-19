import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  businessOutline,
  cashOutline,
  chevronForwardOutline,
  refreshOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { Loan } from '@contabilidade/models';
import { LoanService } from '../../core/services/loan.service';
import { LoanModal } from '../../components/modals/loan-modal/loan-modal';

@Component({
  selector: 'app-loans',
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
    IonCardContent,
    IonBadge,
    IonFab,
    IonFabButton,
    IonSpinner,
    LoanModal,
  ],
  templateUrl: './loans.page.html',
  styleUrl: './loans.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoansPage implements OnInit {
  readonly loanService = inject(LoanService);
  private readonly router = inject(Router);

  readonly modalNovoEmprestimoAberto = signal<boolean>(false);
  readonly emprestimos = this.loanService.emprestimos;
  readonly loading = this.loanService.loading;
  readonly error = this.loanService.error;

  constructor() {
    addIcons({
      addOutline,
      businessOutline,
      cashOutline,
      chevronForwardOutline,
      refreshOutline,
      alertCircleOutline,
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  ionViewWillEnter(): void {
    this.carregar();
  }

  carregar(): void {
    this.loanService.listarEmprestimos().subscribe();
  }

  handleRefresh(event: CustomEvent): void {
    this.loanService.listarEmprestimos().subscribe({
      next: () => (event.target as HTMLIonRefresherElement).complete(),
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  abrirModal(): void {
    this.modalNovoEmprestimoAberto.set(true);
  }

  fecharModal(): void {
    this.modalNovoEmprestimoAberto.set(false);
  }

  onEmprestimoCriado(loan: Loan): void {
    this.fecharModal();
    this.router.navigate(['/emprestimos', loan.id]);
  }

  abrirDetalhes(loan: Loan): void {
    this.router.navigate(['/emprestimos', loan.id]);
  }
}

