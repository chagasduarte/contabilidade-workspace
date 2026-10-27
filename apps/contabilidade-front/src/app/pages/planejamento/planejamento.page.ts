import { CurrencyPipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
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
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  chevronDownOutline,
  closeOutline,
  createOutline,
  pieChartOutline,
  trashOutline,
} from 'ionicons/icons';
import { Planejamento, Subcategoria, TipoPlanejamento } from '@contabilidade/models';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { PlanejamentoService } from '../../core/services/planejamento.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';

/** Linha da tela: uma categoria com planejado x realizado e as linhas editáveis. */
export interface LinhaOrcamento {
  idcategoria: number;
  nome: string;
  planejado: number;
  /** realizado_pago + realizado_pendente. */
  realizado: number;
  realizado_pago: number;
  realizado_pendente: number;
  diferenca: number;
  /** 0..∞ (pode passar de 100). null quando não há planejado. */
  percentual: number | null;
  situacao: 'ok' | 'atencao' | 'estourou' | 'sem-orcamento' | 'atingida';
  linhas: Planejamento[];
}

@Component({
  selector: 'app-planejamento',
  imports: [
    CurrencyPipe,
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
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
    MonthSelector,
  ],
  templateUrl: './planejamento.page.html',
  styleUrl: './planejamento.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanejamentoPage implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly headerState = inject(HeaderStateService);
  readonly service = inject(PlanejamentoService);
  readonly dashboardService = inject(DashboardService);
  readonly categoriaService = inject(CategoriaService);

  readonly tipo = signal<TipoPlanejamento>('despesa');
  readonly expandidas = signal<ReadonlySet<number>>(new Set());

  readonly totais = computed(() => {
    const r = this.service.resumo();
    const t = r && (r.tipo ?? this.tipo()) === this.tipo() ? r.totais : null;
    const planejado = t?.planejado ?? 0;
    const realizadoPago = t?.realizado_pago ?? 0;
    const realizado = realizadoPago + (t?.realizado_pendente ?? 0);
    return {
      planejado,
      realizado,
      realizadoPago,
      restante: planejado - realizado,
      percentual: planejado > 0 ? (realizado / planejado) * 100 : null,
    };
  });

  readonly linhas = computed<LinhaOrcamento[]>(() => {
    const tipo = this.tipo();
    const r = this.service.resumo();
    // Ignora o resumo do outro tipo enquanto o novo carrega.
    const resumo = r && (r.tipo ?? tipo) === tipo ? r.categorias : [];
    const grupos =
      this.service.agrupados().find((g) => String(g.tipo).toLowerCase() === tipo)?.agrupamentoTipo ?? [];
    const linhasPorCategoria = new Map(grupos.map((g) => [g.categoriaid, g]));

    const doResumo = resumo.map((c): LinhaOrcamento => {
        const realizado = c.realizado_pago + c.realizado_pendente;
        const percentual = c.planejado > 0 ? (realizado / c.planejado) * 100 : null;
        return {
          idcategoria: c.idcategoria,
          nome: c.categoria_nome ?? linhasPorCategoria.get(c.idcategoria)?.categoria ?? 'Categoria',
          planejado: c.planejado,
          realizado,
          realizado_pago: c.realizado_pago,
          realizado_pendente: c.realizado_pendente,
          diferenca: c.planejado - realizado,
          percentual,
          situacao: this.situacao(tipo, c.planejado, percentual),
          linhas: linhasPorCategoria.get(c.idcategoria)?.planejamento ?? [],
        };
      });

    // Categorias com planejamento que não vieram no resumo (por segurança).
    const ids = new Set(doResumo.map((l) => l.idcategoria));
    const extras = grupos
      .filter((g) => !ids.has(g.categoriaid))
      .map(
        (g): LinhaOrcamento => ({
          idcategoria: g.categoriaid,
          nome: g.categoria,
          planejado: g.soma,
          realizado: 0,
          realizado_pago: 0,
          realizado_pendente: 0,
          diferenca: g.soma,
          percentual: 0,
          situacao: 'ok',
          linhas: g.planejamento,
        })
      );

    const peso = { estourou: 0, atencao: 1, ok: 2, atingida: 3, 'sem-orcamento': 4 } as const;
    return [...doResumo, ...extras].sort(
      (a, b) => peso[a.situacao] - peso[b.situacao] || b.planejado - a.planejado
    );
  });

  // --- Formulário ---
  readonly modalAberto = signal(false);
  readonly emEdicao = signal<Planejamento | null>(null);
  readonly salvando = signal(false);
  readonly erroFormulario = signal<string | null>(null);
  readonly subcategorias = signal<Subcategoria[]>([]);

  readonly form = new FormGroup({
    categoriaid: new FormControl<number | null>(null, Validators.required),
    subcategoriaid: new FormControl<number | null>(null),
    valor: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  readonly categoriasDoTipo = computed(() =>
    this.categoriaService.categorias().filter((c) => (c.tipo ?? 'despesa') === this.tipo())
  );

  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      chevronDownOutline,
      closeOutline,
      createOutline,
      pieChartOutline,
      trashOutline,
    });

    this.form.controls.categoriaid.valueChanges.subscribe((id) => {
      this.form.controls.subcategoriaid.setValue(null, { emitEvent: false });
      this.subcategorias.set([]);
      if (id != null && !this.emEdicao()) {
        this.categoriaService.listarSubcategorias(id).subscribe({
          next: (subs) => this.subcategorias.set(subs ?? []),
          error: () => this.subcategorias.set([]),
        });
      }
    });

    effect(() => {
      const month = this.headerState.selectedMonth();
      const year = this.headerState.selectedYear();
      const mudou =
        month !== untracked(this.dashboardService.mes) ||
        year !== untracked(this.dashboardService.ano);
      if (mudou) {
        this.dashboardService.mes.set(month);
        this.dashboardService.ano.set(year);
        if (isPlatformBrowser(this.platformId)) {
          untracked(() => this.carregar());
        }
      }
    });
  }

  ngOnInit(): void {
    this.headerState.setYear(this.dashboardService.ano());
    this.headerState.setMonth(this.dashboardService.mes());
    if (isPlatformBrowser(this.platformId)) {
      this.carregar();
      if (this.categoriaService.categorias().length === 0) {
        this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
      }
    }
  }

  carregar(): void {
    this.service
      .carregarMes(this.dashboardService.mes(), this.dashboardService.ano(), this.tipo())
      .subscribe({ error: () => undefined });
  }

  recarregar(event: Event): void {
    const fim = () => (event.target as HTMLIonRefresherElement).complete();
    this.service
      .carregarMes(this.dashboardService.mes(), this.dashboardService.ano(), this.tipo())
      .subscribe({ next: fim, error: fim });
  }

  onTipo(event: CustomEvent): void {
    const valor = event.detail.value as TipoPlanejamento | undefined;
    if (valor && valor !== this.tipo()) {
      this.tipo.set(valor);
      this.carregar();
    }
  }

  selecionarMes(mes: number): void {
    this.headerState.setMonth(mes);
  }

  mesAnterior(): void {
    this.deslocarMes(-1);
  }

  proximoMes(): void {
    this.deslocarMes(1);
  }

  private deslocarMes(delta: number): void {
    const d = new Date(this.dashboardService.ano(), this.dashboardService.mes() - 1 + delta, 1);
    this.headerState.setYear(d.getFullYear());
    this.headerState.setMonth(d.getMonth() + 1);
  }

  alternar(idcategoria: number): void {
    this.expandidas.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(idcategoria)) {
        novo.delete(idcategoria);
      } else {
        novo.add(idcategoria);
      }
      return novo;
    });
  }

  /** Largura da barra (limitada a 100%). */
  largura(percentual: number | null): number {
    return Math.max(0, Math.min(100, percentual ?? 0));
  }

  private situacao(
    tipo: TipoPlanejamento,
    planejado: number,
    percentual: number | null
  ): LinhaOrcamento['situacao'] {
    if (!(planejado > 0) || percentual == null) return 'sem-orcamento';
    if (tipo === 'receita') return percentual >= 100 ? 'atingida' : 'ok';
    if (percentual > 100) return 'estourou';
    if (percentual >= 80) return 'atencao';
    return 'ok';
  }

  // --- Formulário ---

  abrirNovo(idcategoria: number | null = null): void {
    this.emEdicao.set(null);
    this.erroFormulario.set(null);
    this.form.enable({ emitEvent: false });
    this.form.reset({ categoriaid: null, subcategoriaid: null, valor: null });
    if (idcategoria != null) this.form.controls.categoriaid.setValue(idcategoria);
    this.modalAberto.set(true);
  }

  abrirEdicao(linha: Planejamento): void {
    this.emEdicao.set(linha);
    this.erroFormulario.set(null);
    this.subcategorias.set(
      linha.subcategoriaid != null
        ? [{ id: linha.subcategoriaid, nome: linha.subcategoria ?? '', idcategoria: linha.categoriaid, icone: '', cor: '' }]
        : []
    );
    this.form.reset(
      { categoriaid: linha.categoriaid, subcategoriaid: linha.subcategoriaid, valor: Number(linha.valor) },
      { emitEvent: false }
    );
    // Na edição só o valor muda; categoria/subcategoria definem a linha.
    this.form.controls.categoriaid.disable({ emitEvent: false });
    this.form.controls.subcategoriaid.disable({ emitEvent: false });
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
    const valor = Number(v.valor);
    const editando = this.emEdicao();
    // A API soma valores num POST repetido (mesmo mês/categoria/subcategoria);
    // por isso, se a linha já existe, atualizamos o valor em vez de criar.
    const existente =
      editando ??
      this.linhas()
        .find((l) => l.idcategoria === Number(v.categoriaid))
        ?.linhas.find((p) => (p.subcategoriaid ?? null) === (v.subcategoriaid ?? null));

    this.salvando.set(true);
    this.erroFormulario.set(null);

    const requisicao = existente
      ? this.service.atualizar(existente.id, { valor })
      : this.service.criar({
          categoriaid: Number(v.categoriaid),
          subcategoriaid: v.subcategoriaid != null ? Number(v.subcategoriaid) : null,
          valor,
          tipo: this.tipo(),
          data: this.dataReferencia(),
        });

    requisicao.subscribe({
      next: () => {
        this.salvando.set(false);
        this.fecharModal();
        void this.avisar(
          existente && !editando
            ? 'Esta categoria já tinha orçamento no mês: o valor foi substituído.'
            : 'Planejamento salvo.',
          'success'
        );
        this.carregar();
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erroFormulario.set(err.message);
      },
    });
  }

  async remover(linha: Planejamento): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Excluir planejamento?',
      message: `O orçamento de "${linha.subcategoria || linha.categoria}" neste mês será removido.`,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    this.service.remover(linha.id).subscribe({
      next: () => {
        void this.avisar('Planejamento excluído.', 'success');
        this.carregar();
      },
      error: (err: Error) => void this.avisar(err.message),
    });
  }

  private dataReferencia(): string {
    return `${this.dashboardService.ano()}-${String(this.dashboardService.mes()).padStart(2, '0')}-01`;
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
