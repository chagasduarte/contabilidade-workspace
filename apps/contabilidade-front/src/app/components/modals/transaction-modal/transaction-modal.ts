import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  walletOutline,
  cardOutline,
  layersOutline,
  calendarOutline,
  pricetagOutline,
  checkmarkCircleOutline,
  arrowDownCircleOutline,
  arrowUpCircleOutline,
  timeOutline,
  repeatOutline,
} from 'ionicons/icons';
import {
  CreateParceladaDto,
  CreateTransacaoDto,
  PlannedTransaction,
  PlannedUpdateMode,
  StatusTransacao,
  Subcategoria,
  TipoTransacao,
  Transacao,
} from '@contabilidade/models';
import { TransacaoService } from '../../../core/services/transacao.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { CartaoService } from '../../../core/services/cartao.service';
import { PlannedTransactionService } from '../../../core/services/planned-transaction.service';

@Component({
  selector: 'app-transaction-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonIcon],
  templateUrl: './transaction-modal.html',
  styleUrl: './transaction-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionModal {
  private readonly fb = inject(FormBuilder);
  readonly transacaoService = inject(TransacaoService);
  readonly categoriaService = inject(CategoriaService);
  readonly cartaoService = inject(CartaoService);
  readonly plannedTransactionService = inject(PlannedTransactionService, { optional: true });

  readonly isOpen = input<boolean>(false);
  readonly defaultType = input<TipoTransacao>('saida');
  readonly editingItem = input<Transacao | null>(null);

  readonly closeModal = output<void>();
  readonly transactionCreated = output<Transacao | Transacao[] | PlannedTransaction>();

  readonly salvando = signal<boolean>(false);
  readonly erroMensagem = signal<string | null>(null);
  readonly sucessoMensagem = signal<string | null>(null);
  readonly subcategoriasDisponiveis = signal<Subcategoria[]>([]);
  readonly tipoAtual = signal<TipoTransacao>('saida');
  readonly recorrenciaAtual = signal<'NONE' | 'MENSAL'>('NONE');

  readonly emEdicao = computed(() => this.editingItem() != null);
  readonly isEdicaoPlanejada = computed(() => {
    const item = this.editingItem();
    return (
      !!item &&
      (item.origem === 'PLANEJADO' ||
        item.origem === 'AVULSO' ||
        item.source_type === 'PLANNED_TRANSACTION')
    );
  });
  readonly isEdicaoRecorrente = computed(() => {
    const item = this.editingItem();
    return (
      this.isEdicaoPlanejada() &&
      !!(item?.is_recorrente || item?.parent_recurrence_id || item?.recorrencia === 'MENSAL')
    );
  });

  readonly categoriasDisponiveis = computed(() => {
    const tipoTx = this.tipoAtual();
    const esperado = tipoTx === 'entrada' ? 'receita' : 'despesa';
    const todas = this.categoriaService.categorias();
    const filtradas = todas.filter((c) => (c.tipo ?? 'despesa') === esperado);
    return filtradas.length > 0 ? filtradas : todas;
  });

  private wasOpen = false;

  readonly form: FormGroup = this.fb.group({
    tipo: ['saida' as TipoTransacao, [Validators.required]],
    descricao: ['', [Validators.required, Validators.minLength(2)]],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    data: [this.dataAtualIso(), [Validators.required]],
    idcategoria: [null as number | null, [Validators.required]],
    categoria: [null as number | null],
    status: ['pago' as StatusTransacao, [Validators.required]],
    isCartao: [false],
    cartaoid: [null as number | null],
    isParcelado: [false],
    qtdParcelas: [2, [Validators.min(1), Validators.max(72)]],
    valorParcela: [null as number | null],
    recorrencia: ['NONE' as 'NONE' | 'MENSAL'],
    dataLimiteRecorrencia: [null as string | null],
    updateMode: ['SINGLE' as PlannedUpdateMode],
  });

  constructor() {
    addIcons({
      closeOutline,
      walletOutline,
      cardOutline,
      layersOutline,
      calendarOutline,
      pricetagOutline,
      checkmarkCircleOutline,
      arrowDownCircleOutline,
      arrowUpCircleOutline,
      timeOutline,
      repeatOutline,
    });

    effect(() => {
      const open = this.isOpen();
      if (open && !this.wasOpen) {
        this.wasOpen = true;
        untracked(() => {
          this.onAbrirModal();
        });
      } else if (!open && this.wasOpen) {
        this.wasOpen = false;
      }
    });

    // Monitora alterações de tipo
    this.form.get('tipo')?.valueChanges.subscribe((tipo: TipoTransacao) => {
      if (tipo && this.tipoAtual() !== tipo) {
        this.tipoAtual.set(tipo);
      }
      if (tipo === 'entrada') {
        this.form.patchValue(
          {
            isCartao: false,
            cartaoid: null,
            isParcelado: false,
            status: 'pendente',
          },
          { emitEvent: false }
        );
      }
    });

    // Monitora seleção de cartão
    this.form.get('isCartao')?.valueChanges.subscribe((isCartao: boolean) => {
      if (isCartao) {
        this.cartaoService.listarCartoes().subscribe({
          next: (cartoes) => {
            if (cartoes && cartoes.length > 0 && !this.form.get('cartaoid')?.value) {
              this.form.patchValue({ cartaoid: cartoes[0].id });
            }
          },
        });
      } else {
        this.form.patchValue({ cartaoid: null });
      }
    });

    // Monitora seleção de categoria para carregar subcategorias dinamicamente
    this.form.get('idcategoria')?.valueChanges.subscribe((catId: number | null) => {
      if (catId) {
        this.categoriaService.listarSubcategorias(catId).subscribe({
          next: (subs) => {
            this.subcategoriasDisponiveis.set(subs ?? []);
            if (subs && subs.length > 0) {
              this.form.patchValue({ categoria: subs[0].id }, { emitEvent: false });
            } else {
              this.form.patchValue({ categoria: catId }, { emitEvent: false });
            }
          },
        });
      } else {
        this.subcategoriasDisponiveis.set([]);
        this.form.patchValue({ categoria: null }, { emitEvent: false });
      }
    });

    // Monitora alterações para cálculo automático de parcelas
    this.form.valueChanges.subscribe(() => {
      this.atualizarCalculoParcelas();
    });

    // Monitora alterações de recorrência
    this.form.get('recorrencia')?.valueChanges.subscribe((rec: 'NONE' | 'MENSAL') => {
      const novoRec = rec === 'MENSAL' ? 'MENSAL' : 'NONE';
      this.recorrenciaAtual.set(novoRec);
      if (novoRec === 'MENSAL') {
        this.form.patchValue(
          {
            isCartao: false,
            cartaoid: null,
            isParcelado: false,
            status: 'pendente',
          },
          { emitEvent: false }
        );
      }
    });
  }

  private onAbrirModal(): void {
    this.erroMensagem.set(null);
    this.sucessoMensagem.set(null);
    this.salvando.set(false);

    const itemEdit = this.editingItem();
    if (itemEdit) {
      const tipoEdit: TipoTransacao = itemEdit.tipo === 'entrada' ? 'entrada' : 'saida';
      const recEdit: 'NONE' | 'MENSAL' =
        itemEdit.recorrencia === 'MENSAL' || itemEdit.is_recorrente ? 'MENSAL' : 'NONE';
      this.tipoAtual.set(tipoEdit);
      this.recorrenciaAtual.set(recEdit);

      const catEdit =
        itemEdit.idcategoria ??
        (typeof itemEdit.categoria === 'number' ? itemEdit.categoria : null) ??
        this.categoriaService.categorias()[0]?.id ??
        null;
      const subcatEdit = itemEdit.idsubcategoria ?? catEdit;

      this.form.reset(
        {
          tipo: tipoEdit,
          descricao: itemEdit.descricao ?? '',
          valor: Number(itemEdit.valor || 0),
          data: itemEdit.data ? String(itemEdit.data).slice(0, 10) : this.dataAtualIso(),
          idcategoria: catEdit,
          categoria: subcatEdit,
          status: itemEdit.status ?? 'pendente',
          isCartao: false,
          cartaoid: null,
          isParcelado: false,
          qtdParcelas: 2,
          valorParcela: null,
          recorrencia: recEdit,
          dataLimiteRecorrencia: null,
          updateMode: 'SINGLE',
        },
        { emitEvent: false }
      );

      if (this.categoriaService.categorias().length === 0) {
        this.categoriaService.listarCategorias().subscribe();
      } else if (catEdit) {
        this.categoriaService.listarSubcategorias(catEdit).subscribe({
          next: (subs) => {
            this.subcategoriasDisponiveis.set(subs ?? []);
          },
        });
      }
      return;
    }

    const tipoPadrao = this.defaultType() || 'saida';
    this.tipoAtual.set(tipoPadrao);
    this.recorrenciaAtual.set('NONE');
    const primeiraCat = this.categoriaService.categorias()[0]?.id ?? null;

    this.form.reset({
      tipo: tipoPadrao,
      descricao: '',
      valor: null,
      data: this.dataAtualIso(),
      idcategoria: primeiraCat,
      categoria: primeiraCat,
      status: tipoPadrao === 'entrada' ? 'pendente' : 'pago',
      isCartao: false,
      cartaoid: null,
      isParcelado: false,
      qtdParcelas: 2,
      valorParcela: null,
      recorrencia: 'NONE',
      dataLimiteRecorrencia: null,
      updateMode: 'SINGLE',
    });

    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({
        next: (cats) => {
          if (cats && cats.length > 0 && !this.form.get('idcategoria')?.value) {
            this.form.patchValue({ idcategoria: cats[0].id });
          }
        },
      });
    } else if (primeiraCat) {
      this.categoriaService.listarSubcategorias(primeiraCat).subscribe({
        next: (subs) => {
          this.subcategoriasDisponiveis.set(subs ?? []);
          if (subs && subs.length > 0) {
            this.form.patchValue({ categoria: subs[0].id }, { emitEvent: false });
          }
        },
      });
    }

    this.cartaoService.listarCartoes().subscribe();
  }

  setTipo(tipo: TipoTransacao): void {
    this.tipoAtual.set(tipo);
    this.form.patchValue({ tipo });
  }

  private atualizarCalculoParcelas(): void {
    const isParcelado = this.form.get('isParcelado')?.value;
    const valor = Number(this.form.get('valor')?.value);
    const qtd = Number(this.form.get('qtdParcelas')?.value);

    if (isParcelado && valor > 0 && qtd > 0) {
      const calculada = Number((valor / qtd).toFixed(2));
      const atual = this.form.get('valorParcela')?.value;
      if (atual == null || Math.abs(atual - calculada) > 0.05) {
        this.form.patchValue({ valorParcela: calculada }, { emitEvent: false });
      }
    }
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erroMensagem.set('Por favor, preencha todos os campos obrigatórios corretamente.');
      return;
    }

    const val = this.form.getRawValue();
    const valorNum = Number(val.valor);

    if (isNaN(valorNum) || valorNum <= 0) {
      this.erroMensagem.set('O valor deve ser maior que zero.');
      return;
    }

    this.salvando.set(true);
    this.erroMensagem.set(null);

    const catId = val.idcategoria ? Number(val.idcategoria) : null;
    // O select de subcategoria pode conter o próprio id da categoria quando não há
    // subcategorias; só enviamos ids que realmente pertencem à lista carregada.
    const subcatSelecionada = val.categoria != null ? Number(val.categoria) : null;
    const subcatId = this.subcategoriasDisponiveis().some((s) => s.id === subcatSelecionada)
      ? subcatSelecionada
      : null;

    const itemEdit = this.editingItem();
    if (itemEdit) {
      if (this.isEdicaoPlanejada()) {
        if (!this.plannedTransactionService) {
          this.salvando.set(false);
          this.erroMensagem.set('Serviço de contas planejadas indisponível.');
          return;
        }
        const targetId = String(
          itemEdit.target_id || itemEdit.source_id || String(itemEdit.id).replace(/^plan:/, '')
        );
        const updateMode: PlannedUpdateMode = this.isEdicaoRecorrente()
          ? (val.updateMode as PlannedUpdateMode) || 'SINGLE'
          : 'SINGLE';

        this.plannedTransactionService
          .atualizar(targetId, {
            descricao: val.descricao.trim(),
            tipo: val.tipo === 'entrada' ? 'RECEITA' : 'DESPESA',
            valor: valorNum,
            data_prevista: val.data,
            idcategoria: catId,
            updateMode,
          })
          .subscribe({
            next: (atualizada) => {
              this.salvando.set(false);
              this.sucessoMensagem.set('Conta planejada atualizada com sucesso!');
              this.transactionCreated.emit(atualizada);
              setTimeout(() => {
                this.fechar();
              }, 300);
            },
            error: (err: unknown) => {
              this.salvando.set(false);
              const msg =
                err instanceof Error ? err.message : 'Erro ao atualizar conta planejada.';
              this.erroMensagem.set(msg);
            },
          });
        return;
      }

      this.transacaoService
        .atualizarTransacao(itemEdit.id, {
          tipo: val.tipo,
          descricao: val.descricao.trim(),
          valor: valorNum,
          data: val.data,
          idcategoria: catId,
          idsubcategoria: subcatId,
          status: val.status,
        })
        .subscribe({
          next: (atualizada) => {
            this.salvando.set(false);
            this.sucessoMensagem.set('Transação atualizada com sucesso!');
            this.transactionCreated.emit(atualizada);
            setTimeout(() => {
              this.fechar();
            }, 300);
          },
          error: (err: unknown) => {
            this.salvando.set(false);
            const msg = err instanceof Error ? err.message : 'Erro ao atualizar transação.';
            this.erroMensagem.set(msg);
          },
        });
      return;
    }

    if (val.recorrencia === 'MENSAL') {
      if (!this.plannedTransactionService) {
        this.salvando.set(false);
        this.erroMensagem.set('Serviço de contas planejadas indisponível.');
        return;
      }
      this.plannedTransactionService
        .criar({
          descricao: val.descricao.trim(),
          tipo: val.tipo === 'entrada' ? 'RECEITA' : 'DESPESA',
          valor: valorNum,
          data_prevista: val.data,
          idcategoria: catId,
          recorrencia: 'MENSAL',
          data_limite_recorrencia: val.dataLimiteRecorrencia || null,
          status: 'PENDING',
        })
        .subscribe({
          next: (criada) => {
            this.salvando.set(false);
            this.sucessoMensagem.set('Conta recorrente mensal criada com sucesso!');
            this.transactionCreated.emit(criada);
            setTimeout(() => {
              this.fechar();
            }, 300);
          },
          error: (err: unknown) => {
            this.salvando.set(false);
            const msg =
              err instanceof Error ? err.message : 'Erro ao criar conta recorrente mensal.';
            this.erroMensagem.set(msg);
          },
        });
      return;
    }

    if (val.isParcelado && val.tipo === 'saida') {
      const qtd = Number(val.qtdParcelas);
      const valorParcela = Number(val.valorParcela || (valorNum / qtd).toFixed(2));

      const payload: CreateParceladaDto = {
        tipo: 'saida',
        descricao: val.descricao.trim(),
        valor: valorNum,
        idcategoria: catId,
        idsubcategoria: subcatId,
        data: val.data,
        ispaycart: val.isCartao,
        cartaoid: val.isCartao && val.cartaoid ? Number(val.cartaoid) : undefined,
        parcelado: true,
        parcelas: {
          QtdParcelas: qtd,
          Valor: valorParcela,
        },
      };

      this.transacaoService.criarTransacoesParceladas(payload).subscribe({
        next: (parcelas) => {
          this.salvando.set(false);
          this.sucessoMensagem.set(`${parcelas.length} parcelas registradas com sucesso!`);
          this.transactionCreated.emit(parcelas);
          setTimeout(() => {
            this.fechar();
          }, 400);
        },
        error: (err: unknown) => {
          this.salvando.set(false);
          const msg =
            err instanceof Error
              ? err.message
              : 'Erro ao criar transação parcelada. Verifique os dados.';
          this.erroMensagem.set(msg);
        },
      });
    } else {
      const payload: CreateTransacaoDto = {
        tipo: val.tipo,
        descricao: val.descricao.trim(),
        valor: valorNum,
        idcategoria: catId,
        idsubcategoria: subcatId,
        data: val.data,
        status: val.status,
        ispaycart: val.tipo === 'saida' ? val.isCartao : false,
        cartaoid:
          val.tipo === 'saida' && val.isCartao && val.cartaoid
            ? Number(val.cartaoid)
            : undefined,
      };

      this.transacaoService.criarTransacao(payload).subscribe({
        next: (transacao) => {
          this.salvando.set(false);
          this.sucessoMensagem.set('Transação criada com sucesso!');
          this.transactionCreated.emit(transacao);
          setTimeout(() => {
            this.fechar();
          }, 400);
        },
        error: (err: unknown) => {
          this.salvando.set(false);
          const msg =
            err instanceof Error
              ? err.message
              : 'Erro ao salvar transação. Verifique os campos.';
          this.erroMensagem.set(msg);
        },
      });
    }
  }

  fechar(): void {
    this.closeModal.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.fechar();
    }
  }

  private dataAtualIso(): string {
    return new Date().toISOString().substring(0, 10);
  }
}

