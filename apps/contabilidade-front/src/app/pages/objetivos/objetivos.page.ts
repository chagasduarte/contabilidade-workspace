import { CurrencyPipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  closeOutline,
  createOutline,
  flagOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { Objetivo } from '@contabilidade/models';
import { ObjetivoService } from '../../core/services/objetivo.service';

export type SituacaoObjetivo = 'concluido' | 'no-ritmo' | 'abaixo' | 'vencido';

const TIPOS_SUGERIDOS = [
  'Reserva de emergência',
  'Viagem',
  'Imóvel',
  'Veículo',
  'Educação',
  'Aposentadoria',
  'Outro',
] as const;

function isoHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-objetivos',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './objetivos.page.html',
  styleUrl: './objetivos.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjetivosPage implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  readonly service = inject(ObjetivoService);

  readonly tiposSugeridos = TIPOS_SUGERIDOS;
  readonly hoje = isoHoje();

  readonly objetivos = computed(() =>
    [...this.service.objetivos()].sort((a, b) => {
      // concluídos por último; os demais pelo prazo mais próximo
      const ca = a.progresso_percentual >= 100 ? 1 : 0;
      const cb = b.progresso_percentual >= 100 ? 1 : 0;
      return ca - cb || a.data_final.localeCompare(b.data_final);
    })
  );

  readonly totais = computed(() => {
    const lista = this.service.objetivos();
    const guardado = lista.reduce((acc, o) => acc + Number(o.valor_acumulado || 0), 0);
    const meta = lista.reduce((acc, o) => acc + Number(o.valor_objetivo || 0), 0);
    return { guardado, meta, percentual: meta > 0 ? (guardado / meta) * 100 : 0 };
  });

  // --- Formulário ---
  readonly modalAberto = signal(false);
  readonly emEdicao = signal<Objetivo | null>(null);
  readonly salvando = signal(false);
  readonly erroFormulario = signal<string | null>(null);

  readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    tipo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    valor_objetivo: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    valor_mensal: new FormControl<number | null>(0, [Validators.min(0)]),
    valor_acumulado: new FormControl<number | null>(0, [Validators.min(0)]),
    data_final: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      closeOutline,
      createOutline,
      flagOutline,
      trashOutline,
      trophyOutline,
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.carregar();
    }
  }

  carregar(): void {
    this.service.listar().subscribe({ error: () => undefined });
  }

  recarregar(event: Event): void {
    const fim = () => (event.target as HTMLIonRefresherElement).complete();
    this.service.listar().subscribe({ next: fim, error: fim });
  }

  situacao(o: Objetivo): SituacaoObjetivo {
    if (o.progresso_percentual >= 100) return 'concluido';
    if (o.meses_restantes <= 0 || o.valor_mensal_necessario == null) return 'vencido';
    return Number(o.valor_mensal) >= Number(o.valor_mensal_necessario) ? 'no-ritmo' : 'abaixo';
  }

  largura(percentual: number): number {
    return Math.max(0, Math.min(100, percentual || 0));
  }

  // --- Ações ---

  /** Registra um aporte (POST /objetivos/:id/aportes). */
  async guardar(o: Objetivo): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Guardar dinheiro',
      subHeader: o.nome,
      message: 'Quanto você guardou agora para este objetivo?',
      inputs: [
        {
          name: 'valor',
          type: 'number',
          placeholder: 'Valor (R$)',
          value: o.valor_mensal > 0 ? Number(o.valor_mensal) : undefined,
          min: 0.01,
          attributes: { step: '0.01', inputmode: 'decimal', 'aria-label': 'Valor guardado (R$)' },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: { valor: string } }>();
    if (role !== 'confirm') return;

    const aporte = Number(data?.values?.valor);
    if (!(aporte > 0)) {
      await this.avisar('Informe um valor maior que zero.');
      return;
    }

    // Soma atômica na API: evita perder aportes feitos em outro aparelho.
    this.service.aportar(o.id, Math.round(aporte * 100) / 100).subscribe({
      next: (atualizado) =>
        void this.avisar(
          atualizado.progresso_percentual >= 100
            ? `Parabéns! Você atingiu o objetivo "${o.nome}".`
            : 'Valor guardado registrado.',
          'success'
        ),
      error: (err: Error) => void this.avisar(err.message),
    });
  }

  async remover(o: Objetivo): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Excluir objetivo?',
      message: `"${o.nome}" e o histórico de quanto foi guardado serão removidos.`,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    this.service.remover(o.id).subscribe({
      next: () => void this.avisar('Objetivo excluído.', 'success'),
      error: (err: Error) => void this.avisar(err.message),
    });
  }

  // --- Formulário ---

  abrirNovo(): void {
    this.emEdicao.set(null);
    this.erroFormulario.set(null);
    const daquiUmAno = new Date();
    daquiUmAno.setFullYear(daquiUmAno.getFullYear() + 1);
    this.form.reset({
      nome: '',
      tipo: '',
      valor_objetivo: null,
      valor_mensal: 0,
      valor_acumulado: 0,
      data_final: daquiUmAno.toISOString().slice(0, 10),
    });
    this.modalAberto.set(true);
  }

  abrirEdicao(o: Objetivo): void {
    this.emEdicao.set(o);
    this.erroFormulario.set(null);
    this.form.reset({
      nome: o.nome,
      tipo: o.tipo,
      valor_objetivo: Number(o.valor_objetivo),
      valor_mensal: Number(o.valor_mensal),
      valor_acumulado: Number(o.valor_acumulado),
      data_final: String(o.data_final).slice(0, 10),
    });
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.emEdicao.set(null);
    this.erroFormulario.set(null);
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const dto = {
      nome: v.nome.trim(),
      tipo: v.tipo.trim(),
      valor_objetivo: Number(v.valor_objetivo),
      valor_mensal: Number(v.valor_mensal ?? 0),
      valor_acumulado: Number(v.valor_acumulado ?? 0),
      data_final: v.data_final,
    };
    const editando = this.emEdicao();
    this.salvando.set(true);
    this.erroFormulario.set(null);

    const req = editando ? this.service.atualizar(editando.id, dto) : this.service.criar(dto);
    req.subscribe({
      next: () => {
        this.salvando.set(false);
        this.fecharModal();
        void this.avisar(editando ? 'Objetivo atualizado.' : 'Objetivo criado.', 'success');
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erroFormulario.set(err.message);
      },
    });
  }

  private async avisar(message: string, color: 'success' | 'danger' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: color === 'danger' ? 4000 : 2500,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
