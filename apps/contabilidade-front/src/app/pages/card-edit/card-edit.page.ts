// card-edit.page.ts

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, cardOutline, informationCircleOutline } from 'ionicons/icons';
import { UpdateCardDto } from '../card-details/card.model';
import { CardService } from '../card-details/card.service';

const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'American Express', 'Hipercard'];

@Component({
  selector: 'app-card-edit',
  standalone: true,
  imports: [
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
    IonSpinner,
  ],
  templateUrl: './card-edit.page.html',
  styleUrl: './card-edit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardEditPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  readonly cardService = inject(CardService);

  readonly cardId = signal<string | null>(null);
  readonly carregando = signal(true);
  readonly erroCarregamento = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly erroFormulario = signal<string | null>(null);

  readonly detalhes = this.cardService.cartaoSelecionado;

  readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    bandeira: new FormControl('Mastercard', { nonNullable: true }),
    limite_total: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    dia_fechamento: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(31),
    ]),
    dia_vencimento: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(31),
    ]),
    cor_identificacao: new FormControl('#0f172a', { nonNullable: true }),
  });

  /** Valores do formulário como signal, para a prévia do cartão e os avisos. */
  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Bandeiras do select; inclui a do cartão quando ela não está na lista padrão. */
  readonly bandeiras = computed(() => {
    const atual = this.detalhes()?.cartao.bandeira;
    return atual && !BANDEIRAS.includes(atual) ? [...BANDEIRAS, atual] : BANDEIRAS;
  });

  readonly diasAlterados = computed(() => {
    const c = this.detalhes()?.cartao;
    const v = this.valores();
    if (!c) return false;
    return (
      Number(v.dia_fechamento) !== c.dia_fechamento ||
      Number(v.dia_vencimento) !== c.dia_vencimento
    );
  });

  /** O novo limite fica abaixo do que já está comprometido em faturas não pagas. */
  readonly limiteAbaixoDoComprometido = computed(() => {
    const comprometido = this.detalhes()?.limite_comprometido ?? 0;
    const limite = Number(this.valores().limite_total);
    return comprometido > 0 && limite > 0 && limite < comprometido;
  });

  constructor() {
    addIcons({ alertCircleOutline, cardOutline, informationCircleOutline });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.carregando.set(false);
      this.erroCarregamento.set('Cartão não informado.');
      return;
    }
    this.cardId.set(id);
    this.carregar();
  }

  carregar(): void {
    const id = this.cardId();
    if (!id) return;

    this.carregando.set(true);
    this.erroCarregamento.set(null);
    this.cardService.obterCartaoPorId(id).subscribe({
      next: ({ cartao }) => {
        this.form.reset({
          nome: cartao.nome,
          bandeira: cartao.bandeira || 'Mastercard',
          limite_total: cartao.limite_total,
          dia_fechamento: cartao.dia_fechamento,
          dia_vencimento: cartao.dia_vencimento,
          cor_identificacao: cartao.cor_identificacao || '#0f172a',
        });
        this.carregando.set(false);
      },
      error: (err: Error) => {
        this.carregando.set(false);
        this.erroCarregamento.set(err.message);
      },
    });
  }

  salvar(): void {
    const id = this.cardId();
    if (!id || this.salvando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: UpdateCardDto = {
      nome: v.nome.trim(),
      bandeira: v.bandeira,
      limite_total: Number(v.limite_total),
      dia_fechamento: Number(v.dia_fechamento),
      dia_vencimento: Number(v.dia_vencimento),
      cor_identificacao: v.cor_identificacao,
    };

    this.salvando.set(true);
    this.erroFormulario.set(null);
    this.cardService.atualizarCartao(id, payload).subscribe({
      next: () => {
        this.salvando.set(false);
        this.form.markAsPristine();
        void this.avisar('Cartão atualizado com sucesso!', 'success');
        void this.router.navigate(['/cartoes', id], { replaceUrl: true });
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erroFormulario.set(err.message);
      },
    });
  }

  campoInvalido(nome: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[nome];
    return control.touched && control.invalid;
  }

  private async avisar(message: string, color: 'success' | 'danger' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
