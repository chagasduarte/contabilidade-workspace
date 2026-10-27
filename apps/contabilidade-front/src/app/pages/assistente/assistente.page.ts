import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  checkmarkCircleOutline,
  closeCircle,
  sendOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { Categoria, CreateTransacaoDto, StatusTransacao, SugestaoTransacao } from '@contabilidade/models';
import { AiErro, AiService } from '../../core/services/ai.service';
import { CameraService } from '../../core/services/camera.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { TransacaoService } from '../../core/services/transacao.service';
import { mensagemErroHttp } from '../../core/utils/http-error';
import { reduzirImagem } from '../../core/utils/imagem';

export type FormSugestao = FormGroup<{
  tipo: FormControl<'entrada' | 'saida'>;
  descricao: FormControl<string>;
  valor: FormControl<number | null>;
  data: FormControl<string>;
  idcategoria: FormControl<number | null>;
  status: FormControl<StatusTransacao>;
  isCartao: FormControl<boolean>;
  cartaoid: FormControl<number | null>;
}>;

export interface MensagemChat {
  id: number;
  autor: 'usuario' | 'assistente';
  texto?: string;
  /** Miniatura da foto enviada (data URL). */
  foto?: string;
  carregando?: boolean;
  erro?: string;
  /** Sugestão editável; só vira lançamento quando o usuário confirma. */
  sugestao?: {
    form: FormSugestao;
    categoriaSugerida: string;
    estado: 'pendente' | 'salvando' | 'salva' | 'descartada';
    erroSalvar?: string;
  };
}

const MAX_MENSAGEM = 2000;

/** Normaliza para comparar nomes de categoria sem acento/caixa. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function isoHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-assistente',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, IonButton, IonContent, IonIcon, IonSpinner],
  templateUrl: './assistente.page.html',
  styleUrl: './assistente.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistentePage implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ai = inject(AiService);
  private readonly camera = inject(CameraService);
  private readonly transacaoService = inject(TransacaoService);
  readonly categoriaService = inject(CategoriaService);
  readonly cartaoService = inject(CartaoService);

  private readonly conteudo = viewChild(IonContent);
  private readonly campoTexto = viewChild<ElementRef<HTMLTextAreaElement>>('campoTexto');

  readonly maxMensagem = MAX_MENSAGEM;
  readonly mensagens = signal<MensagemChat[]>([
    {
      id: 0,
      autor: 'assistente',
      texto:
        'Olá! Descreva um gasto ou uma receita (ex.: "almoço 42,90 hoje no débito") ' +
        'ou envie a foto de um recibo. Eu preparo o lançamento e você confirma antes de salvar.',
    },
  ]);
  readonly texto = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(MAX_MENSAGEM)] });
  readonly fotoPendente = signal<string | null>(null);
  readonly preparandoFoto = signal(false);
  readonly enviando = signal(false);
  readonly erroComposer = signal<string | null>(null);

  private seq = 1;

  constructor() {
    addIcons({ cameraOutline, checkmarkCircleOutline, closeCircle, sendOutline, sparklesOutline });
    // Rola para a última mensagem sempre que a conversa muda.
    afterRenderEffect(() => {
      this.mensagens();
      void this.conteudo()?.scrollToBottom(200);
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.categoriaService.categorias().length === 0) {
      this.categoriaService.listarCategorias().subscribe({ error: () => undefined });
    }
    if (this.cartaoService.cartoes().length === 0) {
      this.cartaoService.listarCartoes().subscribe({ error: () => undefined });
    }
  }

  podeEnviar(): boolean {
    return (
      !this.enviando() &&
      !this.preparandoFoto() &&
      this.texto.valid &&
      (this.texto.value.trim().length > 0 || !!this.fotoPendente())
    );
  }

  async anexarFoto(): Promise<void> {
    this.erroComposer.set(null);
    let dataUrl: string | null;
    try {
      dataUrl = await this.camera.capturar('escolher', 1600);
    } catch (err) {
      this.erroComposer.set((err as Error).message);
      return;
    }
    if (!dataUrl) return;
    this.preparandoFoto.set(true);
    try {
      // Sugestão do BackEnd: lado maior ~1600 px, JPEG 0,8 (bem abaixo do limite de 4 MB).
      this.fotoPendente.set(await reduzirImagem(dataUrl, 1600, 0.8));
    } catch (err) {
      this.erroComposer.set((err as Error).message);
    } finally {
      this.preparandoFoto.set(false);
    }
  }

  removerFoto(): void {
    this.fotoPendente.set(null);
  }

  /** Enter envia; Shift+Enter quebra linha. */
  onTecla(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }

  enviar(): void {
    if (!this.podeEnviar()) return;
    const message = this.texto.value.trim();
    const foto = this.fotoPendente();

    this.adicionar({ autor: 'usuario', texto: message || undefined, foto: foto ?? undefined });
    const idResposta = this.adicionar({ autor: 'assistente', carregando: true });

    this.texto.reset('');
    this.fotoPendente.set(null);
    this.erroComposer.set(null);
    this.enviando.set(true);

    this.ai
      .sugerir({ ...(message ? { message } : {}), ...(foto ? { base64Image: foto } : {}) })
      .subscribe({
        next: (sugestao) => {
          this.enviando.set(false);
          this.atualizar(idResposta, {
            carregando: false,
            texto: 'Encontrei este lançamento. Confira e ajuste antes de salvar:',
            sugestao: {
              form: this.criarForm(sugestao),
              categoriaSugerida: sugestao.categoria,
              estado: 'pendente',
            },
          });
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          const erro = err instanceof AiErro ? err : null;
          this.atualizar(idResposta, {
            carregando: false,
            erro: erro?.message ?? mensagemErroHttp(err, 'O assistente não conseguiu responder agora.'),
          });
          this.campoTexto()?.nativeElement.focus();
        },
      });
  }

  salvar(msg: MensagemChat): void {
    const s = msg.sugestao;
    if (!s || s.estado !== 'pendente') return;
    if (s.form.invalid) {
      s.form.markAllAsTouched();
      return;
    }
    const v = s.form.getRawValue();
    if (v.tipo === 'saida' && v.isCartao && v.cartaoid == null) {
      this.atualizarSugestao(msg.id, { erroSalvar: 'Escolha o cartão da compra.' });
      return;
    }

    const dto: CreateTransacaoDto = {
      tipo: v.tipo,
      descricao: v.descricao.trim(),
      valor: Number(v.valor),
      data: v.data,
      idcategoria: v.idcategoria,
      status: v.status,
      ispaycart: v.tipo === 'saida' && v.isCartao,
      cartaoid: v.tipo === 'saida' && v.isCartao && v.cartaoid != null ? Number(v.cartaoid) : undefined,
    };

    this.atualizarSugestao(msg.id, { estado: 'salvando', erroSalvar: undefined });
    this.transacaoService.criarTransacao(dto).subscribe({
      next: () => {
        s.form.disable();
        this.atualizarSugestao(msg.id, { estado: 'salva' });
      },
      error: (err: unknown) =>
        this.atualizarSugestao(msg.id, {
          estado: 'pendente',
          erroSalvar: mensagemErroHttp(err, 'Não foi possível salvar o lançamento.'),
        }),
    });
  }

  descartar(msg: MensagemChat): void {
    msg.sugestao?.form.disable();
    this.atualizarSugestao(msg.id, { estado: 'descartada' });
  }

  categoriasDoTipo(tipo: 'entrada' | 'saida'): Categoria[] {
    const alvo = tipo === 'entrada' ? 'receita' : 'despesa';
    return this.categoriaService.categorias().filter((c) => (c.tipo ?? 'despesa') === alvo);
  }

  /** Converte o nome sugerido pela IA no id de uma categoria visível ao usuário. */
  private resolverCategoria(nome: string, tipo: 'entrada' | 'saida'): number | null {
    const alvo = normalizar(nome || '');
    if (!alvo) return null;
    const candidatas = this.categoriasDoTipo(tipo);
    const exata = candidatas.find((c) => normalizar(c.nome) === alvo);
    if (exata) return exata.id;
    const parcial = candidatas.find(
      (c) => normalizar(c.nome).includes(alvo) || alvo.includes(normalizar(c.nome))
    );
    return parcial?.id ?? null;
  }

  private criarForm(s: SugestaoTransacao): FormSugestao {
    const tipo = s.tipo === 'entrada' ? 'entrada' : 'saida';
    const form: FormSugestao = new FormGroup({
      tipo: new FormControl<'entrada' | 'saida'>(tipo, { nonNullable: true }),
      descricao: new FormControl(s.descricao ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(255)],
      }),
      valor: new FormControl<number | null>(Number(s.valor) || null, [Validators.required, Validators.min(0.01)]),
      data: new FormControl(/^\d{4}-\d{2}-\d{2}/.test(s.data ?? '') ? s.data.slice(0, 10) : isoHoje(), {
        nonNullable: true,
        validators: [Validators.required],
      }),
      idcategoria: new FormControl<number | null>(this.resolverCategoria(s.categoria, tipo)),
      status: new FormControl<StatusTransacao>('pago', { nonNullable: true }),
      isCartao: new FormControl(tipo === 'saida' && !!s.ispaycart, { nonNullable: true }),
      cartaoid: new FormControl<number | null>(
        s.ispaycart && this.cartaoService.cartoes().length === 1 ? this.cartaoService.cartoes()[0].id : null
      ),
    });
    // Ao trocar o tipo, a categoria anterior pode não valer mais.
    form.controls.tipo.valueChanges.subscribe((t) => {
      const atual = form.controls.idcategoria.value;
      if (atual != null && !this.categoriasDoTipo(t).some((c) => c.id === atual)) {
        form.controls.idcategoria.setValue(null);
      }
      if (t === 'entrada') form.controls.isCartao.setValue(false);
    });
    return form;
  }

  private adicionar(m: Omit<MensagemChat, 'id'>): number {
    const id = this.seq++;
    this.mensagens.update((lista) => [...lista, { id, ...m }]);
    return id;
  }

  private atualizar(id: number, parcial: Partial<MensagemChat>): void {
    this.mensagens.update((lista) => lista.map((m) => (m.id === id ? { ...m, ...parcial } : m)));
  }

  private atualizarSugestao(id: number, parcial: Partial<NonNullable<MensagemChat['sugestao']>>): void {
    this.mensagens.update((lista) =>
      lista.map((m) => (m.id === id && m.sugestao ? { ...m, sugestao: { ...m.sugestao, ...parcial } } : m))
    );
  }
}
