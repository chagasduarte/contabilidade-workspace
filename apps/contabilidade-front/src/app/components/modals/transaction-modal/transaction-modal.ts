import {
  ChangeDetectionStrategy,
  Component,
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
} from 'ionicons/icons';
import {
  CreateParceladaDto,
  CreateTransacaoDto,
  StatusTransacao,
  Subcategoria,
  TipoTransacao,
  Transacao,
} from '@contabilidade/models';
import { TransacaoService } from '../../../core/services/transacao.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { CartaoService } from '../../../core/services/cartao.service';

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

  readonly isOpen = input<boolean>(false);
  readonly defaultType = input<TipoTransacao>('saida');

  readonly closeModal = output<void>();
  readonly transactionCreated = output<Transacao | Transacao[]>();

  readonly salvando = signal<boolean>(false);
  readonly erroMensagem = signal<string | null>(null);
  readonly sucessoMensagem = signal<string | null>(null);
  readonly subcategoriasDisponiveis = signal<Subcategoria[]>([]);
  readonly tipoAtual = signal<TipoTransacao>('saida');

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
  }

  private onAbrirModal(): void {
    this.erroMensagem.set(null);
    this.sucessoMensagem.set(null);
    this.salvando.set(false);

    const tipoPadrao = this.defaultType() || 'saida';
    this.tipoAtual.set(tipoPadrao);
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
    const subcatId = val.categoria ? Number(val.categoria) : catId;

    if (val.isParcelado && val.tipo === 'saida') {
      const qtd = Number(val.qtdParcelas);
      const valorParcela = Number(val.valorParcela || (valorNum / qtd).toFixed(2));

      const payload: CreateParceladaDto = {
        tipo: 'saida',
        descricao: val.descricao.trim(),
        valor: valorNum,
        idcategoria: catId,
        categoria: subcatId,
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
        categoria: subcatId,
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

