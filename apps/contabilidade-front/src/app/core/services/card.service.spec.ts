import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CardService } from './card.service';
import { API_URL } from './categoria.service';
import {
  CardDetailsResponseDto,
  CreateCardDto,
  CreateTransactionDto,
  CreditCard,
  InvoiceDetailsResponseDto,
} from '@contabilidade/models';

describe('CardService', () => {
  let service: CardService;
  let httpTesting: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000/api';

  const mockCartao: CreditCard = {
    id: 'card-1',
    usuario_id: 1,
    nome: 'Nubank Ultravioleta',
    bandeira: 'Mastercard',
    limite_total: 10000,
    dia_fechamento: 20,
    dia_vencimento: 27,
    cor_identificacao: '#820AD1',
    ativo: true,
  };

  const mockCartaoDetalhes: CardDetailsResponseDto = {
    cartao: mockCartao,
    limite_total: 10000,
    limite_comprometido: 2500,
    limite_disponivel: 7500,
    faturas: [
      {
        id: 'fat-1',
        cartao_id: 'card-1',
        mes_referencia: 10,
        ano_referencia: 2026,
        data_fechamento: '2026-10-20',
        data_vencimento: '2026-10-27',
        status: 'OPEN',
        total_fatura: 2500,
      },
    ],
  };

  const mockFaturaDetalhes: InvoiceDetailsResponseDto = {
    fatura: mockCartaoDetalhes.faturas![0],
    cartao: mockCartao,
    itens: [
      {
        id: 'item-1',
        fatura_id: 'fat-1',
        transacao_id: 'tx-1',
        numero_parcela: 1,
        valor_parcela: 1250,
        descricao: 'Notebook Gamer',
        quantidade_parcelas: 2,
        data_compra: '2026-10-15',
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CardService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(CardService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created with initial signals state', () => {
    expect(service).toBeTruthy();
    expect(service.cartoes()).toEqual([]);
    expect(service.cartaoSelecionado()).toBeNull();
    expect(service.faturaSelecionada()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should list cards and update cartoes signal', () => {
    service.listarCartoes().subscribe((res) => {
      expect(res).toEqual([mockCartaoDetalhes]);
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards`);
    expect(req.request.method).toBe('GET');
    req.flush([mockCartaoDetalhes]);

    expect(service.cartoes()).toEqual([mockCartaoDetalhes]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should handle error when listing cards', () => {
    service.listarCartoes().subscribe({
      next: () => fail('Should have failed'),
      error: (err) => {
        expect(err.message).toBe('Erro no servidor');
      },
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards`);
    req.flush({ message: 'Erro no servidor' }, { status: 500, statusText: 'Internal Error' });

    expect(service.error()).toBe('Erro no servidor');
    expect(service.loading()).toBe(false);
  });

  it('should fetch card by ID and set cartaoSelecionado', () => {
    service.obterCartaoPorId('card-1').subscribe((res) => {
      expect(res).toEqual(mockCartaoDetalhes);
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards/card-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCartaoDetalhes);

    expect(service.cartaoSelecionado()).toEqual(mockCartaoDetalhes);
  });

  it('should create new card via POST /cards', () => {
    const payload: CreateCardDto = {
      nome: 'Inter Black',
      bandeira: 'Mastercard',
      limite_total: 15000,
      dia_fechamento: 15,
      dia_vencimento: 22,
      cor_identificacao: '#FF7A00',
    };

    service.criarCartao(payload).subscribe((res) => {
      expect(res.nome).toBe('Inter Black');
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...payload, id: 'card-2', usuario_id: 1, ativo: true });
  });

  it('should list invoices with optional year query param', () => {
    service.listarFaturas('card-1', 2026).subscribe((faturas) => {
      expect(faturas.length).toBe(1);
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards/card-1/faturas?ano=2026`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCartaoDetalhes.faturas);
  });

  it('should fetch invoice details and update faturaSelecionada', () => {
    service.obterDetalhesFatura('fat-1').subscribe((res) => {
      expect(res).toEqual(mockFaturaDetalhes);
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards/faturas/fat-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockFaturaDetalhes);

    expect(service.faturaSelecionada()).toEqual(mockFaturaDetalhes);
  });

  it('should post transaction and update cartaoSelecionado', () => {
    const payload: CreateTransactionDto = {
      cartao_id: 'card-1',
      descricao: 'Headphone Bluetooth',
      valor_total: 500,
      quantidade_parcelas: 1,
      data_compra: '2026-10-16',
    };

    const mockResponse = {
      transacao: {
        id: 'tx-2',
        cartao_id: 'card-1',
        descricao: 'Headphone Bluetooth',
        valor_total: 500,
        quantidade_parcelas: 1,
        data_compra: '2026-10-16',
      },
      itens: [],
      cartaoAtualizado: {
        ...mockCartaoDetalhes,
        limite_comprometido: 3000,
        limite_disponivel: 7000,
      },
    };

    service.lancarTransacao(payload).subscribe((res) => {
      expect(res.transacao.descricao).toBe('Headphone Bluetooth');
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards/transacoes`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.cartaoSelecionado()?.limite_disponivel).toBe(7000);
  });

  it('should pay invoice and update both cartao and invoice state', () => {
    // Setup initial selected invoice
    service.faturaSelecionada.set(mockFaturaDetalhes);

    const mockResponse = {
      fatura: {
        ...mockCartaoDetalhes.faturas![0],
        status: 'PAID' as const,
        valor_pago: 2500,
      },
      cartaoAtualizado: {
        ...mockCartaoDetalhes,
        limite_comprometido: 0,
        limite_disponivel: 10000,
      },
    };

    service.pagarFatura('fat-1', { fatura_id: 'fat-1', valor_pago: 2500 }).subscribe((res) => {
      expect(res.fatura.status).toBe('PAID');
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cards/faturas/fat-1/pagar`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.cartaoSelecionado()?.limite_disponivel).toBe(10000);
    expect(service.faturaSelecionada()?.fatura.status).toBe('PAID');
  });
});

