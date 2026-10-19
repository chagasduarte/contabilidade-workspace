// cards.page.ts

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
  LoadingController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cardOutline,
  chevronForwardOutline,
  refreshOutline,
  alertCircleOutline,
  closeOutline,
  walletOutline,
} from 'ionicons/icons';
import { CardDetailsResponseDto, CreateCardDto } from '../card-details/card.model';
import { CardService } from '../card-details/card.service';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CurrencyPipe,
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
    IonSpinner,
    IonFab,
    IonFabButton,
  ],
  templateUrl: './cards.page.html',
  styleUrl: './cards.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsPage implements OnInit {
  readonly cardService = inject(CardService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);

  readonly cartoes = this.cardService.cartoes;
  readonly loading = this.cardService.loading;
  readonly error = this.cardService.error;

  readonly modalNovoCartaoAberto = signal<boolean>(false);
  readonly salvando = signal<boolean>(false);
  cartaoForm!: FormGroup;

  constructor() {
    addIcons({
      addOutline,
      cardOutline,
      chevronForwardOutline,
      refreshOutline,
      alertCircleOutline,
      closeOutline,
      walletOutline,
    });

    this.inicializarForm();
  }

  ngOnInit(): void {
    this.carregar();
  }

  ionViewWillEnter(): void {
    this.carregar();
  }

  private inicializarForm(): void {
    this.cartaoForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      bandeira: ['Mastercard', [Validators.required]],
      limite_total: [null, [Validators.required, Validators.min(100)]],
      dia_fechamento: [20, [Validators.required, Validators.min(1), Validators.max(31)]],
      dia_vencimento: [28, [Validators.required, Validators.min(1), Validators.max(31)]],
      cor_identificacao: ['#0f172a', [Validators.required]],
    });
  }

  carregar(): void {
    this.cardService.listarCartoes().subscribe();
  }

  handleRefresh(event: CustomEvent): void {
    this.cardService.listarCartoes().subscribe({
      next: () => (event.target as HTMLIonRefresherElement).complete(),
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  abrirDetalhes(c: CardDetailsResponseDto): void {
    this.router.navigate(['/cartoes', c.cartao.id]);
  }

  abrirModalNovoCartao(): void {
    this.cartaoForm.reset({
      nome: '',
      bandeira: 'Mastercard',
      limite_total: null,
      dia_fechamento: 20,
      dia_vencimento: 28,
      cor_identificacao: '#0f172a',
    });
    this.modalNovoCartaoAberto.set(true);
  }

  fecharModalNovoCartao(): void {
    this.modalNovoCartaoAberto.set(false);
  }

  async salvarNovoCartao(): Promise<void> {
    if (this.cartaoForm.invalid) {
      this.cartaoForm.markAllAsTouched();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Cadastrando cartão de crédito...',
      spinner: 'crescent',
    });
    await loading.present();

    const val = this.cartaoForm.getRawValue();
    const payload: CreateCardDto = {
      nome: val.nome.trim(),
      bandeira: val.bandeira,
      limite_total: Number(val.limite_total),
      dia_fechamento: Number(val.dia_fechamento),
      dia_vencimento: Number(val.dia_vencimento),
      cor_identificacao: val.cor_identificacao,
    };

    this.cardService.criarCartao(payload).subscribe({
      next: async (novoCartao) => {
        await loading.dismiss();
        this.fecharModalNovoCartao();

        const toast = await this.toastController.create({
          message: 'Cartão de crédito cadastrado com sucesso!',
          duration: 3000,
          color: 'success',
          position: 'top',
        });
        await toast.present();

        this.router.navigate(['/cartoes', novoCartao.id]);
      },
      error: async (err: unknown) => {
        await loading.dismiss();
        const msg = err instanceof Error ? err.message : 'Erro ao cadastrar cartão.';
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

  obterRatio(comp: number, tot: number): number {
    if (tot <= 0) return 0;
    return Math.min(1, Math.max(0, comp / tot));
  }
}

