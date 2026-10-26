import { CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
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
import { ActivatedRoute } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
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
  arrowDownCircleOutline,
  arrowUpCircleOutline,
  checkmarkCircleOutline,
  closeOutline,
  ellipsisVertical,
  repeatOutline,
  walletOutline,
} from 'ionicons/icons';
import {
  PlannedTransaction,
  PlannedTransactionFiltros,
  PlannedTransactionStatus,
  PlannedTransactionType,
  PlannedUpdateMode,
} from '@contabilidade/models';
import { HeaderStateService } from '@org/shared-ui-navigation';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';

/** `todas` = visão geral; `pagar` = DESPESA PENDING; `receber` = RECEITA PENDING. */
export type ModoContas = 'todas' | 'pagar' | 'receber';
type FiltroStatus = 'PENDING' | 'SETTLED' | 'TODOS';

const TITULOS: Record<ModoContas, { titulo: string; descricao: string }> = {
  todas: {
    titulo: 'Contas Planejadas',
    descricao: 'Compromissos e recebimentos previstos para o mês.',
  },
  pagar: { titulo: 'Contas a pagar', descricao: 'Despesas pendentes do mês.' },
  receber: { titulo: 'Contas a receber', descricao: 'Receitas pendentes do mês.' },
};

const STATUS_ROTULO: Record<PlannedTransactionStatus, string> = {
  PENDING: 'Pendente',
  SETTLED: 'Efetivada',
  SKIPPED: 'Pulada',
  CANCELLED: 'Cancelada',
};

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Component({
  selector: 'app-contas-planejadas',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
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
  templateUrl: './contas-planejadas.page.html',
  styleUrl: './contas-planejadas.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContasPlanejadasPage implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly actionSheetController = inject(ActionSheetController);
  readonly service = inject(PlannedTransactionService);
  readonly dashboardService = inject(DashboardService);
  readonly categoriaService = inject(CategoriaService);
  private readonly headerState = inject(HeaderStateService);

  readonly modo: ModoContas = (this.route.snapshot.data['modo'] as ModoContas) ?? 'todas';
  readonly titulo = TITULOS[this.modo].titulo;
  readonly descricao = TITULOS[this.modo].descricao;
  readonly statusRotulo = STATUS_ROTULO;

  /** Só a visão geral permite trocar o status; a pagar/receber são sempre pendentes. */
  readonly filtroStatus = signal<FiltroStatus>('PENDING');

  readonly itens = this.service.transacoesPlanejadas;
  readonly temMaisPaginas = computed(() => this.service.nextCursor() != null);
  readonly hoje = isoDate(new Date());

  readonly totalPagar = computed(() => this.somar('DESPESA'));
  readonly totalReceber = computed(() => this.somar('RECEITA'));
  readonly saldoPrevisto = computed(() => this.totalReceber() - this.totalPagar());

  // --- Formulário (criar/editar) ---
  readonly modalAberto = signal(false);
  readonly emEdicao = signal<PlannedTransaction | null>(null);
  readonly salvando = signal(false);
  readonly erroFormulario = signal<string | null>(null);

  readonly form = new FormGroup({
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    tipo: new FormControl<PlannedTransactionType>('DESPESA', { nonNullable: true }),
    valor: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    data_prevista: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    idcategoria: new FormControl<number | null>(null),
    recorrencia: new FormControl<'NONE' | 'MENSAL'>('NONE', { nonNullable: true }),
    data_limite_recorrencia: new FormControl<string | null>(null),
  });

  readonly tipoForm = signal<PlannedTransactionType>('DESPESA');
  readonly recorrenciaForm = signal<'NONE' | 'MENSAL'>('NONE');

  readonly categoriasDoTipo = computed(() => {
    const tipo = this.tipoForm() === 'RECEITA' ? 'receita' : 'despesa';
    return this.categoriaService.categorias().filter((c) => (c.tipo ?? 'despesa') === tipo);
  });

  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      arrowDownCircleOutline,
      arrowUpCircleOutline,
      checkmarkCircleOutline,
      closeOutline,
      ellipsisVertical,
      repeatOutline,
      walletOutline,
    });

    this.form.controls.tipo.valueChanges.subscribe((tipo) => {
      this.tipoForm.set(tipo);
      const atual = this.form.controls.idcategoria.value;
      if (atual != null && !this.categoriasDoTipo().some((c) => c.id === atual)) {
        this.form.controls.idcategoria.setValue(null);
      }
    });
    this.form.controls.recorrencia.valueChanges.subscribe((r) => this.recorrenciaForm.set(r));

    // Régua de meses (mobile) e seletor de ano (desktop)
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

  // --- Listagem ---

  filtros(): PlannedTransactionFiltros {
    const mes = this.dashboardService.mes();
    const ano = this.dashboardService.ano();
    const filtros: PlannedTransactionFiltros = {
      dataInicio: isoDate(new Date(ano, mes - 1, 1)),
      dataFim: isoDate(new Date(ano, mes, 0)),
    };
    if (this.modo === 'pagar') return { ...filtros, tipo: 'DESPESA', status: 'PENDING' };
    if (this.modo === 'receber') return { ...filtros, tipo: 'RECEITA', status: 'PENDING' };
    const status = this.filtroStatus();
    return status === 'TODOS' ? filtros : { ...filtros, status };
  }

  carregar(): void {
    this.service.listarPagina(this.filtros()).subscribe({ error: () => undefined });
  }

  recarregar(event: Event): void {
    this.service.listarPagina(this.filtros()).subscribe({
      next: () => (event.target as HTMLIonRefresherElement).complete(),
      error: () => (event.target as HTMLIonRefresherElement).complete(),
    });
  }

  carregarMais(event?: Event): void {
    const cursor = this.service.nextCursor();
    const concluir = () =>
      (event?.target as HTMLIonInfiniteScrollElement | undefined)?.complete?.();
    if (!cursor || this.service.carregandoMais()) {
      concluir();
      return;
    }
    this.service.listarPagina(this.filtros(), cursor).subscribe({
      next: concluir,
      error: concluir,
    });
  }

  onFiltroStatus(event: CustomEvent): void {
    const valor = event.detail.value as FiltroStatus | undefined;
    if (valor && valor !== this.filtroStatus()) {
      this.filtroStatus.set(valor);
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
    const data = new Date(this.dashboardService.ano(), this.dashboardService.mes() - 1 + delta, 1);
    this.headerState.setYear(data.getFullYear());
    this.headerState.setMonth(data.getMonth() + 1);
  }

  isRecorrente(item: PlannedTransaction): boolean {
    return !!(item.is_recorrente || item.parent_recurrence_id || item.recorrencia === 'MENSAL');
  }

  isVencida(item: PlannedTransaction): boolean {
    return item.status === 'PENDING' && String(item.data_prevista).slice(0, 10) < this.hoje;
  }

  private somar(tipo: PlannedTransactionType): number {
    return this.itens()
      .filter((t) => t.tipo === tipo && t.status === 'PENDING')
      .reduce((acc, t) => acc + Number(t.valor || 0), 0);
  }

  // --- Ações ---

  async abrirAcoes(item: PlannedTransaction): Promise<void> {
    if (item.status !== 'PENDING') return;
    const sheet = await this.actionSheetController.create({
      header: item.descricao,
      buttons: [
        { text: item.tipo === 'RECEITA' ? 'Receber' : 'Pagar', handler: () => void this.efetivar(item) },
        { text: 'Editar', handler: () => this.abrirEdicao(item) },
        ...(this.isRecorrente(item)
          ? [{ text: 'Pular este mês', handler: () => void this.pular(item) }]
          : []),
        { text: 'Cancelar conta', role: 'destructive', handler: () => void this.cancelar(item) },
        { text: 'Fechar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async efetivar(item: PlannedTransaction): Promise<void> {
    const alert = await this.alertController.create({
      header: item.tipo === 'RECEITA' ? 'Confirmar recebimento' : 'Confirmar pagamento',
      subHeader: item.descricao,
      message:
        item.tipo === 'RECEITA'
          ? 'Confira o valor recebido (R$) e a data do recebimento.'
          : 'Confira o valor pago (R$) e a data do pagamento.',
      inputs: [
        {
          name: 'valor',
          type: 'number',
          value: Number(item.valor),
          min: 0.01,
          placeholder: 'Valor (R$)',
          attributes: { step: '0.01', inputmode: 'decimal', 'aria-label': 'Valor (R$)' },
        },
        { name: 'data', type: 'date', value: this.hoje, attributes: { 'aria-label': 'Data' } },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: { valor: string; data: string } }>();
    if (role !== 'confirm') return;

    const valor = Number(data?.values?.valor);
    if (!(valor > 0)) {
      await this.avisar('Informe um valor maior que zero.');
      return;
    }

    this.service
      .efetivar(item.id, {
        valor_pago: valor,
        data_pagamento: data?.values?.data || this.hoje,
        idcategoria: item.idcategoria,
      })
      .subscribe({
        next: () => {
          void this.avisar(
            item.tipo === 'RECEITA'
              ? 'Recebimento registrado em Lançamentos.'
              : 'Pagamento registrado em Lançamentos.',
            'success'
          );
          this.removerSeFiltrado(item.id);
        },
        error: (err: Error) => void this.avisar(err.message),
      });
  }

  async pular(item: PlannedTransaction): Promise<void> {
    const ok = await this.confirmar(
      'Pular este mês?',
      `"${item.descricao}" não será considerada neste mês. As próximas ocorrências continuam.`,
      'Pular'
    );
    if (!ok) return;
    this.service.pular(item.id).subscribe({
      next: () => {
        void this.avisar('Ocorrência pulada.', 'success');
        this.removerSeFiltrado(item.id);
      },
      error: (err: Error) => void this.avisar(err.message),
    });
  }

  async cancelar(item: PlannedTransaction): Promise<void> {
    const ok = await this.confirmar(
      'Cancelar conta?',
      `"${item.descricao}" deixará de aparecer como pendente. Esta ação não pode ser desfeita.`,
      'Cancelar conta'
    );
    if (!ok) return;
    this.service.cancelar(item.id).subscribe({
      next: () => {
        void this.avisar('Conta cancelada.', 'success');
        this.removerSeFiltrado(item.id);
      },
      error: (err: Error) => void this.avisar(err.message),
    });
  }

  /** Nos filtros de pendentes, itens que deixaram de estar pendentes saem da lista. */
  private removerSeFiltrado(id: string): void {
    if (this.filtros().status === 'PENDING') {
      this.service.transacoesPlanejadas.update((l) => l.filter((t) => t.id !== id));
    }
  }

  // --- Formulário ---

  abrirNovo(): void {
    this.emEdicao.set(null);
    this.erroFormulario.set(null);
    const tipo: PlannedTransactionType = this.modo === 'receber' ? 'RECEITA' : 'DESPESA';
    const mes = this.dashboardService.mes();
    const ano = this.dashboardService.ano();
    const hoje = new Date();
    const noMesAtual = hoje.getMonth() + 1 === mes && hoje.getFullYear() === ano;
    this.form.reset({
      descricao: '',
      tipo,
      valor: null,
      data_prevista: noMesAtual ? this.hoje : isoDate(new Date(ano, mes - 1, 1)),
      idcategoria: null,
      recorrencia: 'NONE',
      data_limite_recorrencia: null,
    });
    this.form.controls.recorrencia.enable();
    this.tipoForm.set(tipo);
    this.recorrenciaForm.set('NONE');
    this.modalAberto.set(true);
  }

  abrirEdicao(item: PlannedTransaction): void {
    this.emEdicao.set(item);
    this.erroFormulario.set(null);
    const recorrencia = item.recorrencia === 'MENSAL' ? 'MENSAL' : 'NONE';
    this.form.reset({
      descricao: item.descricao,
      tipo: item.tipo,
      valor: Number(item.valor),
      data_prevista: String(item.data_prevista).slice(0, 10),
      idcategoria: item.idcategoria,
      recorrencia,
      data_limite_recorrencia: item.data_limite_recorrencia
        ? String(item.data_limite_recorrencia).slice(0, 10)
        : null,
    });
    // A recorrência só é definida na criação; na edição usamos o updateMode.
    this.form.controls.recorrencia.disable();
    this.tipoForm.set(item.tipo);
    this.recorrenciaForm.set(recorrencia);
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.emEdicao.set(null);
    this.erroFormulario.set(null);
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const editando = this.emEdicao();
    const base = {
      descricao: v.descricao.trim(),
      tipo: v.tipo,
      valor: Number(v.valor),
      data_prevista: v.data_prevista,
      idcategoria: v.idcategoria != null ? Number(v.idcategoria) : null,
      data_limite_recorrencia: v.recorrencia === 'MENSAL' ? v.data_limite_recorrencia || null : null,
    };

    this.erroFormulario.set(null);

    if (!editando) {
      this.salvando.set(true);
      this.service.criar({ ...base, recorrencia: v.recorrencia, status: 'PENDING' }).subscribe({
        next: () => {
          this.salvando.set(false);
          this.fecharModal();
          void this.avisar('Conta planejada criada.', 'success');
          // Recorrências geram várias ocorrências; recarrega para refletir o mês.
          this.carregar();
        },
        error: (err: Error) => {
          this.salvando.set(false);
          this.erroFormulario.set(err.message);
        },
      });
      return;
    }

    let updateMode: PlannedUpdateMode = 'SINGLE';
    if (this.isRecorrente(editando)) {
      const escolha = await this.escolherModoAtualizacao();
      if (!escolha) return;
      updateMode = escolha;
    }

    this.salvando.set(true);
    this.service.atualizar(editando.id, { ...base, updateMode }).subscribe({
      next: () => {
        this.salvando.set(false);
        this.fecharModal();
        void this.avisar('Conta atualizada.', 'success');
        if (updateMode === 'ALL_FUTURE') this.carregar();
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erroFormulario.set(err.message);
      },
    });
  }

  private async escolherModoAtualizacao(): Promise<PlannedUpdateMode | null> {
    const alert = await this.alertController.create({
      header: 'Conta recorrente',
      message: 'Aplicar a alteração em:',
      inputs: [
        { type: 'radio', label: 'Somente esta ocorrência', value: 'SINGLE', checked: true },
        { type: 'radio', label: 'Esta e as próximas', value: 'ALL_FUTURE' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salvar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: PlannedUpdateMode }>();
    return role === 'confirm' ? (data?.values ?? 'SINGLE') : null;
  }

  // --- Feedback ---

  private async confirmar(header: string, message: string, acao: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        { text: acao, role: 'destructive', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
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
