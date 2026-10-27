import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { CardsPage } from './cards.page';
import { CardService } from '../card-details/card.service';
import { CardDetailsResponseDto, CreditCard } from '../card-details/card.model';
import { DashboardService } from '../../core/services/dashboard.service';

describe('CardsPage', () => {
  let component: CardsPage;
  let fixture: ComponentFixture<CardsPage>;
  let router: Router;

  const mockCartao: CreditCard = {
    id: 'c1',
    usuario_id: 1,
    nome: 'Nubank Ultravioleta',
    bandeira: 'Mastercard',
    limite_total: 10000,
    dia_fechamento: 20,
    dia_vencimento: 27,
    cor_identificacao: '#820ad1',
    ativo: true,
  };

  const mockCartaoDetalhes: CardDetailsResponseDto = {
    cartao: mockCartao,
    limite_total: 10000,
    limite_comprometido: 2000,
    limite_disponivel: 8000,
    faturas: [],
  };

  let cardServiceStub: {
    cartoes: ReturnType<typeof signal<CardDetailsResponseDto[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    listarCartoes: ReturnType<typeof vi.fn>;
    criarCartao: ReturnType<typeof vi.fn>;
  };

  let toastSpy: { present: ReturnType<typeof vi.fn> };
  let loadingSpy: { present: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let dashboardServiceStub: {
    mes: ReturnType<typeof signal<number>>;
    ano: ReturnType<typeof signal<number>>;
  };

  beforeEach(async () => {
    dashboardServiceStub = {
      mes: signal(10),
      ano: signal(2026),
    };

    cardServiceStub = {
      cartoes: signal([mockCartaoDetalhes]),
      loading: signal(false),
      error: signal(null),
      listarCartoes: vi.fn().mockReturnValue(of([mockCartaoDetalhes])),
      criarCartao: vi.fn().mockReturnValue(of(mockCartao)),
    };

    toastSpy = { present: vi.fn().mockResolvedValue(undefined) };
    loadingSpy = {
      present: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(true),
    };

    const toastCtrlStub = {
      create: vi.fn().mockResolvedValue(toastSpy),
    };
    const loadingCtrlStub = {
      create: vi.fn().mockResolvedValue(loadingSpy),
    };

    await TestBed.configureTestingModule({
      imports: [CardsPage],
      providers: [
        provideRouter([]),
        { provide: CardService, useValue: cardServiceStub },
        { provide: DashboardService, useValue: dashboardServiceStub },
        { provide: ToastController, useValue: toastCtrlStub },
        { provide: LoadingController, useValue: loadingCtrlStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(CardsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load cards on init', () => {
    expect(component).toBeTruthy();
    expect(cardServiceStub.listarCartoes).toHaveBeenCalled();
    expect(component.cartoes()).toEqual([mockCartaoDetalhes]);
  });

  it('should navigate to card details on abrirDetalhes', () => {
    component.abrirDetalhes(mockCartaoDetalhes);
    expect(router.navigate).toHaveBeenCalledWith(['/cartoes', 'c1']);
  });

  it('should toggle new card modal open and close', () => {
    expect(component.modalNovoCartaoAberto()).toBe(false);

    component.abrirModalNovoCartao();
    expect(component.modalNovoCartaoAberto()).toBe(true);

    component.fecharModalNovoCartao();
    expect(component.modalNovoCartaoAberto()).toBe(false);
  });

  it('should compute limit ratio correctly with obterRatio', () => {
    expect(component.obterRatio(2000, 10000)).toBe(0.2);
    expect(component.obterRatio(0, 5000)).toBe(0);
    expect(component.obterRatio(6000, 5000)).toBe(1);
    expect(component.obterRatio(100, 0)).toBe(0);
  });

  it('should not submit if form is invalid', async () => {
    component.cartaoForm.patchValue({
      nome: '',
      limite_total: null,
    });

    await component.salvarNovoCartao();
    expect(cardServiceStub.criarCartao).not.toHaveBeenCalled();
  });

  it('should submit valid form, show toast, and navigate to new card', async () => {
    component.cartaoForm.patchValue({
      nome: 'Inter Black',
      bandeira: 'Mastercard',
      limite_total: 12000,
      dia_fechamento: 15,
      dia_vencimento: 22,
      cor_identificacao: '#FF7A00',
    });

    await component.salvarNovoCartao();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadingSpy.present).toHaveBeenCalled();
    expect(cardServiceStub.criarCartao).toHaveBeenCalledWith({
      nome: 'Inter Black',
      bandeira: 'Mastercard',
      limite_total: 12000,
      dia_fechamento: 15,
      dia_vencimento: 22,
      cor_identificacao: '#FF7A00',
    });
    expect(loadingSpy.dismiss).toHaveBeenCalled();
    expect(toastSpy.present).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/cartoes', 'c1']);
    expect(component.modalNovoCartaoAberto()).toBe(false);
  });

  it('should handle error when creating new card', async () => {
    cardServiceStub.criarCartao.mockReturnValue(throwError(() => new Error('Falha no banco')));

    component.cartaoForm.patchValue({
      nome: 'Inter Black',
      bandeira: 'Mastercard',
      limite_total: 12000,
      dia_fechamento: 15,
      dia_vencimento: 22,
      cor_identificacao: '#FF7A00',
    });

    await component.salvarNovoCartao();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadingSpy.dismiss).toHaveBeenCalled();
    expect(toastSpy.present).toHaveBeenCalled();
  });

  it('should complete refresher event on handleRefresh', () => {
    const completeSpy = vi.fn();
    const event = {
      target: {
        complete: completeSpy,
      },
    } as unknown as CustomEvent;

    component.handleRefresh(event);
    expect(cardServiceStub.listarCartoes).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });

  it('should change month and wrap year on mesAnterior / proximoMes / selecionarMes', () => {
    component.selecionarMes(1);
    expect(component.mes()).toBe(1);
    expect(component.ano()).toBe(2026);

    component.mesAnterior();
    expect(component.mes()).toBe(12);
    expect(component.ano()).toBe(2025);

    component.proximoMes();
    expect(component.mes()).toBe(1);
    expect(component.ano()).toBe(2026);
  });
});

