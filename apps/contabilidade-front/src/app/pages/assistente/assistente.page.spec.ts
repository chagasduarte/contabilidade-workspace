import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Cartao, Categoria } from '@contabilidade/models';
import { AssistentePage } from './assistente.page';
import { AiErro, AiService } from '../../core/services/ai.service';
import { CameraService } from '../../core/services/camera.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { CartaoService } from '../../core/services/cartao.service';
import { TransacaoService } from '../../core/services/transacao.service';

vi.mock('../../core/utils/imagem', () => ({
  reduzirImagem: vi.fn().mockResolvedValue('data:image/jpeg;base64,REDUZIDA'),
}));

describe('AssistentePage', () => {
  let fixture: ComponentFixture<AssistentePage>;
  let component: AssistentePage;
  let sugerir: ReturnType<typeof vi.fn>;
  let criarTransacao: ReturnType<typeof vi.fn>;
  let capturar: ReturnType<typeof vi.fn>;

  const sugestao = {
    tipo: 'saida' as const,
    descricao: 'Supermercado',
    valor: 230.5,
    categoria: 'alimentacao',
    data: '2026-10-25',
    ispaycart: true,
  };

  beforeEach(async () => {
    sugerir = vi.fn().mockReturnValue(of(sugestao));
    criarTransacao = vi.fn().mockReturnValue(of({ id: 1 }));
    capturar = vi.fn().mockResolvedValue('data:image/png;base64,ORIGINAL');
    await TestBed.configureTestingModule({
      imports: [AssistentePage],
      providers: [
        provideRouter([]),
        { provide: AiService, useValue: { sugerir } },
        { provide: CameraService, useValue: { capturar } },
        { provide: TransacaoService, useValue: { criarTransacao } },
        {
          provide: CategoriaService,
          useValue: {
            categorias: signal<Categoria[]>([
              { id: 5, nome: 'Alimentação', icone: '', cor: '', tipo: 'despesa' },
              { id: 6, nome: 'Salário', icone: '', cor: '', tipo: 'receita' },
            ]),
            listarCategorias: vi.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: CartaoService,
          useValue: {
            cartoes: signal<Cartao[]>([{ id: 3, nome: 'Nubank', dia_fatura: 5 }]),
            listarCartoes: vi.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AssistentePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('envia texto e mostra a sugestão com a categoria resolvida pelo nome', () => {
    component.texto.setValue('mercado 230,50 ontem no cartão');
    component.enviar();
    expect(sugerir).toHaveBeenCalledWith({ message: 'mercado 230,50 ontem no cartão' });

    const resposta = component.mensagens().at(-1);
    const v = resposta?.sugestao?.form.getRawValue();
    expect(v?.idcategoria).toBe(5); // "alimentacao" ≈ "Alimentação"
    expect(v?.isCartao).toBe(true);
    expect(v?.cartaoid).toBe(3); // único cartão é pré-selecionado
  });

  it('envia foto reduzida sem texto', async () => {
    await component.anexarFoto();
    expect(component.fotoPendente()).toBe('data:image/jpeg;base64,REDUZIDA');
    component.enviar();
    expect(sugerir).toHaveBeenCalledWith({ base64Image: 'data:image/jpeg;base64,REDUZIDA' });
    expect(component.fotoPendente()).toBeNull();
  });

  it('não envia vazio', () => {
    component.enviar();
    expect(sugerir).not.toHaveBeenCalled();
  });

  it('só grava após confirmação (POST /transacoes)', () => {
    component.texto.setValue('mercado');
    component.enviar();
    const msg = component.mensagens().at(-1)!;
    expect(criarTransacao).not.toHaveBeenCalled();

    component.salvar(msg);
    expect(criarTransacao).toHaveBeenCalledWith({
      tipo: 'saida',
      descricao: 'Supermercado',
      valor: 230.5,
      data: '2026-10-25',
      idcategoria: 5,
      status: 'pago',
      ispaycart: true,
      cartaoid: 3,
    });
    expect(component.mensagens().at(-1)?.sugestao?.estado).toBe('salva');
  });

  it('descartar não grava', () => {
    component.texto.setValue('mercado');
    component.enviar();
    component.descartar(component.mensagens().at(-1)!);
    expect(component.mensagens().at(-1)?.sugestao?.estado).toBe('descartada');
    expect(criarTransacao).not.toHaveBeenCalled();
  });

  it('mostra o erro amigável da IA', () => {
    sugerir.mockReturnValue(
      throwError(() => new AiErro('Tente uma foto mais nítida.', 'IA_SEM_RESULTADO', 422))
    );
    component.texto.setValue('???');
    component.enviar();
    expect(component.mensagens().at(-1)?.erro).toBe('Tente uma foto mais nítida.');
    expect(component.enviando()).toBe(false);
  });
});
