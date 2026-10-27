import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { CardEditPage } from './card-edit.page';
import { CardService } from '../card-details/card.service';
import { CardDetailsResponseDto, CreditCard } from '../card-details/card.model';

describe('CardEditPage', () => {
  let component: CardEditPage;
  let fixture: ComponentFixture<CardEditPage>;
  let router: Router;

  const mockCartao: CreditCard = {
    id: 'card-1',
    usuario_id: 1,
    nome: 'Nubank',
    bandeira: 'Mastercard',
    limite_total: 5000,
    dia_fechamento: 20,
    dia_vencimento: 28,
    cor_identificacao: '#820ad1',
    ativo: true,
  };

  const mockDetalhes: CardDetailsResponseDto = {
    cartao: mockCartao,
    limite_total: 5000,
    limite_comprometido: 1200,
    limite_disponivel: 3800,
    faturas: [],
  };

  let cardServiceStub: {
    cartaoSelecionado: ReturnType<typeof signal<CardDetailsResponseDto | null>>;
    obterCartaoPorId: ReturnType<typeof vi.fn>;
    atualizarCartao: ReturnType<typeof vi.fn>;
  };
  let toastSpy: { present: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    cardServiceStub = {
      cartaoSelecionado: signal<CardDetailsResponseDto | null>(null),
      obterCartaoPorId: vi.fn().mockImplementation(() => {
        cardServiceStub.cartaoSelecionado.set(mockDetalhes);
        return of(mockDetalhes);
      }),
      atualizarCartao: vi.fn().mockReturnValue(of({ ...mockCartao, nome: 'Nubank Roxinho' })),
    };
    toastSpy = { present: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [CardEditPage],
      providers: [
        provideRouter([]),
        { provide: CardService, useValue: cardServiceStub },
        { provide: ToastController, useValue: { create: vi.fn().mockResolvedValue(toastSpy) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('card-1') } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CardEditPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega o cartão da rota e preenche o formulário', () => {
    expect(cardServiceStub.obterCartaoPorId).toHaveBeenCalledWith('card-1');
    expect(component.carregando()).toBe(false);
    expect(component.form.getRawValue()).toEqual({
      nome: 'Nubank',
      bandeira: 'Mastercard',
      limite_total: 5000,
      dia_fechamento: 20,
      dia_vencimento: 28,
      cor_identificacao: '#820ad1',
    });
    expect(component.form.pristine).toBe(true);
  });

  it('mostra o erro de carregamento quando o cartão não é encontrado', () => {
    cardServiceStub.obterCartaoPorId.mockReturnValue(
      throwError(() => new Error('Cartão de crédito não encontrado.'))
    );

    component.carregar();

    expect(component.carregando()).toBe(false);
    expect(component.erroCarregamento()).toBe('Cartão de crédito não encontrado.');
  });

  it('não envia formulário inválido', () => {
    component.form.patchValue({ nome: '', dia_fechamento: 40 });

    component.salvar();

    expect(cardServiceStub.atualizarCartao).not.toHaveBeenCalled();
    expect(component.form.controls.nome.touched).toBe(true);
  });

  it('salva, avisa e volta para os detalhes do cartão', async () => {
    component.form.patchValue({ nome: '  Nubank Roxinho  ', limite_total: 7000 });

    component.salvar();
    await fixture.whenStable();

    expect(cardServiceStub.atualizarCartao).toHaveBeenCalledWith('card-1', {
      nome: 'Nubank Roxinho',
      bandeira: 'Mastercard',
      limite_total: 7000,
      dia_fechamento: 20,
      dia_vencimento: 28,
      cor_identificacao: '#820ad1',
    });
    expect(toastSpy.present).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/cartoes', 'card-1'], { replaceUrl: true });
    expect(component.salvando()).toBe(false);
  });

  it('mantém a tela e mostra o erro quando a API recusa', () => {
    cardServiceStub.atualizarCartao.mockReturnValue(
      throwError(() => new Error('O limite total deve ser maior que zero.'))
    );
    component.form.markAsDirty();

    component.salvar();

    expect(component.erroFormulario()).toBe('O limite total deve ser maior que zero.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('avisa quando os dias de fechamento ou vencimento mudam', () => {
    expect(component.diasAlterados()).toBe(false);

    component.form.patchValue({ dia_fechamento: 5 });

    expect(component.diasAlterados()).toBe(true);
  });

  it('avisa quando o novo limite fica abaixo do comprometido', () => {
    component.form.patchValue({ limite_total: 1000 });
    expect(component.limiteAbaixoDoComprometido()).toBe(true);

    component.form.patchValue({ limite_total: 2000 });
    expect(component.limiteAbaixoDoComprometido()).toBe(false);
  });
});
