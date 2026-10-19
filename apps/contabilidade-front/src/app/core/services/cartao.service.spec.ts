import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CartaoService } from './cartao.service';
import { API_URL } from './categoria.service';
import { Cartao } from '@contabilidade/models';

describe('CartaoService', () => {
  let service: CartaoService;
  let httpTesting: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000/api';

  const mockCartoes: Cartao[] = [
    { id: 1, nome: 'Nubank', dia_fatura: 5, limite: 5000, userid: 1 },
    { id: 2, nome: 'Inter', dia_fatura: 10, limite: 3000, userid: 1 },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CartaoService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(CartaoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.cartoes()).toEqual([]);
  });

  it('should list cards and update signal', () => {
    service.listarCartoes().subscribe((cartoes) => {
      expect(cartoes).toEqual(mockCartoes);
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cartao`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCartoes);

    expect(service.cartoes()).toEqual(mockCartoes);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should handle error when listing cards', () => {
    service.listarCartoes().subscribe({
      next: () => {
        // não deve cair aqui
      },
      error: (err) => {
        expect(err).toBeTruthy();
      },
    });

    const req = httpTesting.expectOne(`${mockApiUrl}/cartao`);
    req.flush('Falha na rede', { status: 500, statusText: 'Internal Server Error' });

    expect(service.cartoes()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeTruthy();
  });

  it('should fallback to /cards if /cartao returns empty array', () => {
    const mockCardsResponse = [
      {
        cartao: {
          id: 'card-uuid-1',
          nome: 'Inter Black',
          dia_fechamento: 15,
          dia_vencimento: 22,
          limite_total: 10000,
          usuario_id: 1,
        },
      },
    ];

    service.listarCartoes().subscribe((cartoes) => {
      expect(cartoes.length).toBe(1);
      expect(cartoes[0].nome).toBe('Inter Black');
      expect(cartoes[0].dia_fatura).toBe(15);
    });

    const req1 = httpTesting.expectOne(`${mockApiUrl}/cartao`);
    req1.flush([]);

    const req2 = httpTesting.expectOne(`${mockApiUrl}/cards`);
    req2.flush(mockCardsResponse);

    expect(service.cartoes().length).toBe(1);
  });
});

