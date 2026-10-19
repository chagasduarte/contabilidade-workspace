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
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MetricCard } from '../../components/cards/metric-card/metric-card';
import { FluxoCaixaChart } from '../../components/chats/fluxo-caixa-chart/fluxo-caixa-chart';
import { ReceitasDespesasChart } from '../../components/chats/receitas-despesas-chart/receitas-despesas-chart';
import { MonthSelector } from '../../components/selectors/month-selector/month-selector';
import {
  IonButton,
  IonCol,
  IonGrid,
  IonIcon,
  IonRow,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  calendarOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  pencilOutline,
  refreshOutline,
  repeatOutline,
  trashOutline,
  walletOutline,
  cardOutline,
  layersOutline,
} from 'ionicons/icons';
import { DashboardService } from '../../core/services/dashboard.service';
import { TransacaoService } from '../../core/services/transacao.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { PlannedTransactionService } from '../../core/services/planned-transaction.service';
import {
  CreateParceladaDto,
  DashboardDespesaItem,
  Subcategoria,
  Transacao,
} from '@contabilidade/models';
import { HeaderStateService } from '@org/shared-ui-navigation';

registerLocaleData(localePt, 'pt-BR');

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
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MetricCard,
    FluxoCaixaChart,
    ReceitasDespesasChart,
    MonthSelector,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastController = inject(ToastController, { optional: true });
  readonly dashboardService = inject(DashboardService);
  readonly transacaoService = inject(TransacaoService);
  readonly categoriaService = inject(CategoriaService);
  readonly cartaoService = inject(CartaoService);
  readonly plannedTransactionService = inject(PlannedTransactionService);
  readonly headerState = inject(HeaderStateService);

  readonly showAddExpense = signal<boolean>(false);
  readonly showEditModal = signal<boolean>(false);
  readonly itemParaEdicao = signal<DashboardDespesaItem | null>(null);
  readonly subcategoriasDisponiveis = signal<Subcategoria[]>([]);

  readonly expenseForm = new FormGroup({
    descricao: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    valor: new FormControl<number | null>(null, {
      nonNullable: false,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    data: new FormControl<string>(new Date().toISOString().substring(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    idcategoria: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
    categoria: new FormControl<number | null>(null),
    status: new FormControl<'pago' | 'pendente'>('pago', {
      nonNullable: true,
    }),
    isCartao: new FormControl<boolean>(false, {
      nonNullable: true,
    }),
    cartaoid: new FormControl<number | null>(null),
    isParcelado: new FormControl<boolean>(false, {
      nonNullable: true,
    }),
    qtdParcelas: new FormControl<number>(2, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(72)],
    }),
    valorParcela: new FormControl<number | null>(null),
    recorrencia: new FormControl<'NONE' | 'MENSAL'>('NONE', {
      nonNullable: true,
    }),
    dataLimiteRecorrencia: new FormControl<string | null>(null),
  });

  readonly editForm = new FormGroup({
    descricao: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    valor: new FormControl<number | null>(null, {
      nonNullable: false,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    data: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    idcategoria: new FormControl<number | null>(null),
    updateMode: new FormControl<'SINGLE' | 'ALL_FUTURE'>('SINGLE', {
      nonNullable: true,
    }),
  });

  readonly periodoLabel = computed<string>(() => {
    const mesIdx = this.dashboardService.mes() - 1;
    const nomeMes = MESES_PT[mesIdx] ?? 'Mês';
    return `${nomeMes} ${this.dashboardService.ano()}`;
  });

  readonly receitaTotal = computed<number>(() =>
    Number(this.dashboardService.resumo()?.receita_mensal ?? 0)
  );

  readonly receitaRecebida = computed<number>(() => {
    const resumo = this.dashboardService.resumo();
    if (!resumo) return 0;
    const total = Number(resumo.receita_mensal ?? 0);
    const pendente = Number(resumo.receita_mensal_pendente ?? 0);
    const recebida = Math.max(0, total - pendente);
    return recebida > 0 ? recebida : total;
  });

  readonly despesaTotal = computed<number>(() =>
    Number(this.dashboardService.resumo()?.gastos_mensal ?? 0)
  );

  readonly saldoAcumulado = computed<number>(() =>
    Number(this.dashboardService.resumo()?.saldo_acumulado ?? 0)
  );

  readonly saldoDisponivelMes = computed<number>(() =>
    Math.max(0, this.receitaTotal() - this.despesaTotal())
  );

  readonly totalPendente = computed<number>(() => {
    const resumo = this.dashboardService.resumo();
    if (resumo?.total_dividas_mes != null) {
      return Number(resumo.total_dividas_mes);
    }
    return Number(resumo?.gastos_mensal_pendente ?? 0);
  });

  readonly saldoProjetado = computed<number>(() => {
    const resumo = this.dashboardService.resumo();
    if (resumo?.saldo_projetado != null) {
      return Number(resumo.saldo_projetado);
    }
    return this.saldoAcumulado();
  });

  readonly ultimasDespesas = computed<Transacao[]>(() => {
    const unified = this.dashboardService.despesas ? this.dashboardService.despesas() : [];
    if (unified && unified.length > 0) {
      return (unified as unknown as Transacao[]).slice(0, 10);
    }

    return [...this.transacaoService.extrato()]
      .filter((t) => t.tipo === 'saida' || t.tipo === 'cartao')
      .sort((a, b) => {
        const criadoEmA = a.criado_em ?? a.created_at;
        const criadoEmB = b.criado_em ?? b.created_at;

        if (criadoEmA && criadoEmB) {
          const tA = new Date(criadoEmA).getTime();
          const tB = new Date(criadoEmB).getTime();
          if (!isNaN(tA) && !isNaN(tB) && tA !== tB) {
            return tB - tA;
          }
        }

        const timeA = a.data ? new Date(a.data).getTime() : 0;
        const timeB = b.data ? new Date(b.data).getTime() : 0;
        const validA = !isNaN(timeA) ? timeA : 0;
        const validB = !isNaN(timeB) ? timeB : 0;

        if (validB !== validA) {
          return validB - validA;
        }

        return Number(b.id ?? 0) - Number(a.id ?? 0);
      })
      .slice(0, 10);
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      refreshOutline,
      calendarOutline,
      walletOutline,
      addOutline,
      closeOutline,
      checkmarkCircleOutline,
      trashOutline,
      cardOutline,
      layersOutline,
      createOutline,
      pencilOutline,
      repeatOutline,
    });

    // Monitora seleção de cartão para carregar cartões e definir padrão
    this.expenseForm.get('isCartao')?.valueChanges.subscribe((isCartao: boolean | null) => {
      if (isCartao) {
        this.cartaoService.listarCartoes().subscribe({
          next: (cartoes) => {
            if (cartoes && cartoes.length > 0 && !this.expenseForm.get('cartaoid')?.value) {
              this.expenseForm.patchValue({ cartaoid: cartoes[0].id });
            }
          },
        });
      } else {
        this.expenseForm.patchValue({ cartaoid: null });
      }
    });

    // Monitora seleção de categoria para carregar subcategorias dinamicamente
    this.expenseForm.get('idcategoria')?.valueChanges.subscribe((catId: number | null) => {
      if (catId) {
        this.categoriaService.listarSubcategorias(catId).subscribe({
          next: (subs) => {
            this.subcategoriasDisponiveis.set(subs ?? []);
            if (subs && subs.length > 0) {
              this.expenseForm.patchValue({ categoria: subs[0].id }, { emitEvent: false });
            } else {
              this.expenseForm.patchValue({ categoria: catId }, { emitEvent: false });
            }
          },
        });
      } else {
        this.subcategoriasDisponiveis.set([]);
        this.expenseForm.patchValue({ categoria: null }, { emitEvent: false });
      }
    });

    // Monitora cálculo automático de parcelas
    this.expenseForm.valueChanges.subscribe(() => {
      this.atualizarCalculoParcelas();
    });

    effect(() => {
      const year = this.headerState.selectedYear();
      if (year !== this.dashboardService.ano()) {
        this.dashboardService.ano.set(year);
        if (isPlatformBrowser(this.platformId)) {
          this.carregarDados();
        }
      }
    });
  }

  private atualizarCalculoParcelas(): void {
    const isParcelado = this.expenseForm.get('isParcelado')?.value;
    const valor = Number(this.expenseForm.get('valor')?.value);
    const qtd = Number(this.expenseForm.get('qtdParcelas')?.value);

    if (isParcelado && valor > 0 && qtd > 0) {
      const calculada = Number((valor / qtd).toFixed(2));
      const atual = this.expenseForm.get('valorParcela')?.value;
      if (atual == null || Math.abs(atual - calculada) > 0.05) {
        this.expenseForm.patchValue({ valorParcela: calculada }, { emitEvent: false });
      }
    }
  }

  ngOnInit(): void {
    this.headerState.setYear(this.dashboardService.ano());
    if (isPlatformBrowser(this.platformId)) {
      this.carregarDados();
    }
  }

  carregarDados(): void {
    const mes = this.dashboardService.mes();
    const ano = this.dashboardService.ano();

    this.dashboardService.carregarDashboard(mes, ano).subscribe({
      error: (err: unknown) => {
        console.error('Falha ao carregar dashboard:', err);
      },
    });

    this.transacaoService.carregarExtrato(mes, ano, 0).subscribe({
      error: (err: unknown) => {
        console.error('Falha ao carregar extrato no dashboard:', err);
      },
    });

    this.categoriaService.listarCategorias().subscribe({
      error: () => {
        // Silencia erro se categorias já estiverem carregadas
      },
    });

    this.cartaoService.listarCartoes().subscribe({
      error: () => {
        // Silencia erro se cartões não puderem ser carregados
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
    this.carregarDados();
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
    this.carregarDados();
  }

  selecionarMes(novoMes: number): void {
    if (novoMes >= 1 && novoMes <= 12 && novoMes !== this.dashboardService.mes()) {
      this.dashboardService.mes.set(novoMes);
      this.carregarDados();
    }
  }

  alternarFormularioDespesa(): void {
    const nextState = !this.showAddExpense();
    this.showAddExpense.set(nextState);

    if (nextState) {
      if (this.categoriaService.categorias().length === 0) {
        this.categoriaService.listarCategorias().subscribe({
          next: (cats) => {
            if (cats && cats.length > 0 && !this.expenseForm.get('idcategoria')?.value) {
              this.expenseForm.patchValue({ idcategoria: cats[0].id });
            }
          },
        });
      } else if (!this.expenseForm.get('idcategoria')?.value) {
        const primeiraCat = this.categoriaService.categorias()[0]?.id;
        if (primeiraCat) {
          this.expenseForm.patchValue({ idcategoria: primeiraCat });
        }
      }

      if (this.cartaoService.cartoes().length === 0) {
        this.cartaoService.listarCartoes().subscribe();
      }
    }
  }

  salvarNovaDespesa(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const raw = this.expenseForm.getRawValue();
    const valorNum = Number(raw.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      return;
    }

    const catId = raw.idcategoria ? Number(raw.idcategoria) : null;
    const subcatId = raw.categoria ? Number(raw.categoria) : catId;

    if (raw.recorrencia === 'MENSAL') {
      this.plannedTransactionService
        .criar({
          descricao: raw.descricao.trim(),
          tipo: 'DESPESA',
          valor: valorNum,
          data_prevista: raw.data,
          idcategoria: catId,
          recorrencia: 'MENSAL',
          data_limite_recorrencia: raw.dataLimiteRecorrencia || null,
          status: 'PENDING',
        })
        .subscribe({
          next: () => {
            this.mostrarToast('Despesa mensal recorrente cadastrada com sucesso!');
            this.resetExpenseForm();
            this.showAddExpense.set(false);
            this.carregarDados();
          },
          error: (err: unknown) => {
            console.error('Erro ao salvar despesa mensal:', err);
            this.mostrarToast('Erro ao cadastrar despesa mensal recorrente.', 'danger');
          },
        });
      return;
    }

    if (raw.isParcelado) {
      const qtd = Number(raw.qtdParcelas || 2);
      const valorParcela = Number(raw.valorParcela || (valorNum / qtd).toFixed(2));

      const payload: CreateParceladaDto = {
        tipo: 'saida',
        descricao: raw.descricao.trim(),
        valor: valorNum,
        idcategoria: catId,
        categoria: subcatId,
        data: raw.data,
        ispaycart: raw.isCartao,
        cartaoid: raw.isCartao && raw.cartaoid != null
          ? (typeof raw.cartaoid === 'string' && isNaN(Number(raw.cartaoid)) ? raw.cartaoid : Number(raw.cartaoid))
          : undefined,
        parcelado: true,
        parcelas: {
          QtdParcelas: qtd,
          Valor: valorParcela,
        },
      };

      this.transacaoService.criarTransacoesParceladas(payload).subscribe({
        next: () => {
          this.resetExpenseForm();
          this.showAddExpense.set(false);
          this.carregarDados();
        },
        error: (err: unknown) => {
          console.error('Erro ao salvar despesas parceladas:', err);
        },
      });
    } else {
      this.transacaoService
        .criarTransacao({
          tipo: 'saida',
          descricao: raw.descricao.trim(),
          valor: valorNum,
          data: raw.data,
          idcategoria: catId,
          categoria: subcatId,
          status: raw.status,
          ispaycart: raw.isCartao,
          cartaoid: raw.isCartao && raw.cartaoid != null
            ? (typeof raw.cartaoid === 'string' && isNaN(Number(raw.cartaoid)) ? raw.cartaoid : Number(raw.cartaoid))
            : undefined,
        })
        .subscribe({
          next: () => {
            this.resetExpenseForm();
            this.showAddExpense.set(false);
            this.carregarDados();
          },
          error: (err: unknown) => {
            console.error('Erro ao salvar despesa:', err);
          },
        });
    }
  }

  private resetExpenseForm(): void {
    const primeiraCat = this.categoriaService.categorias()[0]?.id ?? null;
    this.expenseForm.reset({
      descricao: '',
      valor: null,
      data: new Date().toISOString().substring(0, 10),
      idcategoria: primeiraCat,
      categoria: primeiraCat,
      status: 'pago',
      isCartao: false,
      cartaoid: null,
      isParcelado: false,
      qtdParcelas: 2,
      valorParcela: null,
      recorrencia: 'NONE',
      dataLimiteRecorrencia: null,
    });

    if (primeiraCat) {
      this.categoriaService.listarSubcategorias(primeiraCat).subscribe({
        next: (subs) => {
          this.subcategoriasDisponiveis.set(subs ?? []);
          if (subs && subs.length > 0) {
            this.expenseForm.patchValue({ categoria: subs[0].id }, { emitEvent: false });
          }
        },
      });
    } else {
      this.subcategoriasDisponiveis.set([]);
    }
  }

  abrirEdicao(item: DashboardDespesaItem | Transacao): void {
    const despesaItem = item as DashboardDespesaItem;
    this.itemParaEdicao.set(despesaItem);
    this.editForm.patchValue({
      descricao: despesaItem.descricao,
      valor: despesaItem.valor,
      data: despesaItem.data
        ? despesaItem.data.substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      idcategoria: null,
      updateMode: 'SINGLE',
    });
    this.showEditModal.set(true);
  }

  fecharEdicao(): void {
    this.showEditModal.set(false);
    this.itemParaEdicao.set(null);
  }

  salvarEdicao(): void {
    const item = this.itemParaEdicao();
    if (!item || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const targetId = item.target_id ? String(item.target_id) : String(item.id);
    const raw = this.editForm.getRawValue();
    const valorNum = Number(raw.valor);
    if (isNaN(valorNum) || valorNum <= 0) return;

    const isRecorrente = item.is_recorrente || item.recorrencia === 'MENSAL';
    const updatePayload = {
      descricao: raw.descricao.trim(),
      valor: valorNum,
      data_prevista: raw.data,
      idcategoria: raw.idcategoria ? Number(raw.idcategoria) : null,
      updateMode: isRecorrente ? raw.updateMode : 'SINGLE',
    };

    this.plannedTransactionService.atualizar(targetId, updatePayload).subscribe({
      next: () => {
        this.mostrarToast('Lançamento atualizado com sucesso!');
        this.fecharEdicao();
        this.carregarDados();
      },
      error: (err: unknown) => {
        console.error('Erro ao atualizar lançamento:', err);
        this.mostrarToast('Erro ao atualizar lançamento.', 'danger');
      },
    });
  }

  excluirItemPlanejado(targetId: string | number): void {
    this.plannedTransactionService.deletar(String(targetId)).subscribe({
      next: () => {
        this.mostrarToast('Lançamento excluído com sucesso!');
        this.carregarDados();
      },
      error: (err: unknown) => {
        console.error('Erro ao excluir lançamento:', err);
        this.mostrarToast('Erro ao excluir lançamento.', 'danger');
      },
    });
  }

  efetivarItem(item: Transacao | DashboardDespesaItem): void {
    const origem = item.origem ?? 'CONTA';
    const targetId = item.target_id ? String(item.target_id) : String(item.id);

    if (origem === 'AVULSO') {
      this.dashboardService.efetivarTransacaoPlanejada(targetId).subscribe({
        next: () => {
          this.mostrarToast('Transação planejada liquidada com sucesso!');
          this.carregarDados();
        },
        error: (err: unknown) => {
          console.error('Erro ao efetivar transação planejada:', err);
          this.mostrarToast('Erro ao efetivar transação planejada.', 'danger');
        },
      });
    } else if (origem === 'EMPRESTIMO') {
      this.dashboardService.efetivarParcelaEmprestimo(targetId).subscribe({
        next: () => {
          this.mostrarToast('Parcela de empréstimo liquidada com sucesso!');
          this.carregarDados();
        },
        error: (err: unknown) => {
          console.error('Erro ao efetivar parcela de empréstimo:', err);
          this.mostrarToast('Erro ao efetivar parcela de empréstimo.', 'danger');
        },
      });
    } else if (origem === 'CARTAO') {
      this.dashboardService.pagarFaturaCartao(targetId).subscribe({
        next: () => {
          this.mostrarToast('Fatura de cartão paga com sucesso!');
          this.carregarDados();
        },
        error: (err: unknown) => {
          console.error('Erro ao pagar fatura de cartão:', err);
          this.mostrarToast('Erro ao pagar fatura de cartão.', 'danger');
        },
      });
    } else {
      const idNum = typeof item.id === 'number' ? item.id : Number(String(item.id).replace(/\D/g, ''));
      if (!isNaN(idNum) && idNum > 0) {
        this.transacaoService.marcarComoPago(idNum).subscribe({
          next: () => {
            this.mostrarToast('Despesa marcada como paga com sucesso!');
            this.carregarDados();
          },
          error: (err: unknown) => {
            console.error('Erro ao marcar despesa como paga:', err);
            this.mostrarToast('Erro ao marcar despesa como paga.', 'danger');
          },
        });
      }
    }
  }

  private async mostrarToast(mensagem: string, cor: 'success' | 'danger' = 'success'): Promise<void> {
    if (!this.toastController) return;
    try {
      const toast = await this.toastController.create({
        message: mensagem,
        duration: 3000,
        position: 'bottom',
        color: cor,
      });
      await toast.present();
    } catch {
      // Ignora erro caso ToastController não esteja no DOM
    }
  }

  marcarDespesaComoPaga(id: number): void {
    this.transacaoService.marcarComoPago(id).subscribe({
      next: () => {
        this.mostrarToast('Despesa marcada como paga com sucesso!');
        this.carregarDados();
      },
      error: (err: unknown) => {
        console.error('Erro ao marcar despesa como paga:', err);
        this.mostrarToast('Erro ao marcar despesa como paga.', 'danger');
      },
    });
  }

  excluirDespesa(id: number | string): void {
    const idNum = typeof id === 'number' ? id : Number(id);
    if (!isNaN(idNum) && idNum > 0) {
      this.transacaoService.excluirTransacao(idNum).subscribe({
        next: () => {
          this.mostrarToast('Despesa excluída com sucesso!');
          this.carregarDados();
        },
        error: (err: unknown) => {
          console.error('Erro ao excluir despesa:', err);
          this.mostrarToast('Erro ao excluir despesa.', 'danger');
        },
      });
    }
  }
}
