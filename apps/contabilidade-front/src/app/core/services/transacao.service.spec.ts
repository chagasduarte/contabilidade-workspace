import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransacaoService } from './transacao.service';
import { API_URL } from './categoria.service';
import { Transacao } from '@contabilidade/models';

describe('TransacaoService', () => {
  let service: TransacaoService;
  let httpMock: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000';

  const mockTransacoes: Transacao[] = [
    {
      id: 1,
      descricao: 'Projeto identidade visual',
      tipo: 'entrada',
      valor: 4500,
      categoria: 'Serviços',
      data: '2026-10-10',
      status: 'pendente',
    },
    {
      id: 2,
      descricao: 'Aluguel do escritório',
      tipo: 'saida',
      valor: 2000,
      categoria: 'Moradia',
      data: '2026-10-08',
      status: 'pago',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransacaoService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(TransacaoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve ser criado com estado inicial vazio', () => {
    expect(service).toBeTruthy();
    expect(service.extrato()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve carregar o extrato de transações e atualizar o signal extrato', () => {
    service.carregarExtrato(10, 2026, 0).subscribe((dados) => {
      expect(dados).toEqual(mockTransacoes);
    });

    expect(service.loading()).toBe(true);

    const req = httpMock.expectOne(
      `${mockApiUrl}/transacoes/extrato?limit=0&mes=10&ano=2026`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockTransacoes);

    expect(service.extrato()).toEqual(mockTransacoes);
    expect(service.loading()).toBe(false);
  });

  it('deve paginar o extrato por cursor, anexando a próxima página', () => {
    service.carregarExtratoPaginado(10, 2026).subscribe();
    httpMock
      .expectOne(
        `${mockApiUrl}/transacoes/extrato?paginado=true&limit=50&mes=10&ano=2026`
      )
      .flush({ items: [mockTransacoes[0]], next_cursor: '2026-10-10_1' });

    expect(service.extrato()).toEqual([mockTransacoes[0]]);
    expect(service.nextCursor()).toBe('2026-10-10_1');
    expect(service.loading()).toBe(false);

    service.carregarExtratoPaginado(10, 2026, '2026-10-10_1').subscribe();
    expect(service.carregandoMais()).toBe(true);
    httpMock
      .expectOne(
        `${mockApiUrl}/transacoes/extrato?paginado=true&limit=50&mes=10&ano=2026&cursor=2026-10-10_1`
      )
      .flush({ items: [mockTransacoes[0], mockTransacoes[1]], next_cursor: null });

    // não duplica itens repetidos entre páginas
    expect(service.extrato()).toEqual(mockTransacoes);
    expect(service.nextCursor()).toBeNull();
    expect(service.carregandoMais()).toBe(false);
  });

  it('deve aceitar a resposta antiga (array) como página única', () => {
    service.carregarExtratoPaginado(10, 2026).subscribe();
    httpMock
      .expectOne(
        `${mockApiUrl}/transacoes/extrato?paginado=true&limit=50&mes=10&ano=2026`
      )
      .flush(mockTransacoes);

    expect(service.extrato()).toEqual(mockTransacoes);
    expect(service.nextCursor()).toBeNull();
  });

  it('deve repassar filtros de tipo e status em carregarExtratoPaginado', () => {
    service
      .carregarExtratoPaginado(10, 2026, null, 50, {
        tipo: 'saida',
        status: 'pendente',
      })
      .subscribe();

    const req = httpMock.expectOne(
      `${mockApiUrl}/transacoes/extrato?paginado=true&limit=50&mes=10&ano=2026&tipo=saida&status=pendente`
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [mockTransacoes[0]],
      next_cursor: null,
      totais: {
        entradas: 4500,
        saidas: 2000,
        pendentes: 1,
        entradas_pagas: 0,
        entradas_pendentes: 4500,
        saidas_pagas: 2000,
        saidas_pendentes: 0,
      },
    });

    expect(service.totaisExtrato()?.saidas_pagas).toBe(2000);
    expect(service.totaisExtrato()?.entradas_pendentes).toBe(4500);
  });

  it('deve atualizar uma transação via PUT e refletir no signal extrato', () => {
    service.extrato.set(mockTransacoes);

    service
      .atualizarTransacao(2, { descricao: 'Aluguel atualizado', valor: 2100 })
      .subscribe();

    const req = httpMock.expectOne(`${mockApiUrl}/transacoes/2`);
    expect(req.request.method).toBe('PUT');
    req.flush({
      ...mockTransacoes[1],
      descricao: 'Aluguel atualizado',
      valor: 2100,
    });

    expect(service.extrato()[1].descricao).toBe('Aluguel atualizado');
    expect(service.extrato()[1].valor).toBe(2100);
  });

  it('deve marcar uma transação como paga e atualizar seu status no signal', () => {
    service.extrato.set(mockTransacoes);

    service.marcarComoPago(1).subscribe();

    const req = httpMock.expectOne(`${mockApiUrl}/transacoes/topago/1`);
    expect(req.request.method).toBe('GET');
    req.flush('ok');

    expect(service.extrato()[0].status).toBe('pago');
  });

  it('deve excluir uma transação e removê-la do signal extrato', () => {
    service.extrato.set(mockTransacoes);

    service.excluirTransacao(1).subscribe();

    const req = httpMock.expectOne(`${mockApiUrl}/transacoes/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.extrato().length).toBe(1);
    expect(service.extrato()[0].id).toBe(2);
  });

  it('deve criar uma transação e adicionar ao topo do signal extrato', () => {
    service.extrato.set(mockTransacoes);
    const novaTransacao: Transacao = {
      id: 99,
      descricao: 'Café',
      tipo: 'saida',
      valor: 15,
      data: '2026-10-15',
      status: 'pago',
    };

    service.criarTransacao({
      tipo: 'saida',
      descricao: 'Café',
      valor: 15,
      data: '2026-10-15',
      status: 'pago',
    }).subscribe((res) => {
      expect(res).toEqual(novaTransacao);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/transacoes`);
    expect(req.request.method).toBe('POST');
    req.flush(novaTransacao);

    expect(service.extrato().length).toBe(3);
    expect(service.extrato()[0].id).toBe(99);
  });

  it('deve criar transações parceladas e anexar ao signal extrato', () => {
    service.extrato.set([]);
    const parcelasCriadas: Transacao[] = [
      {
        id: 101,
        descricao: 'Notebook - Parcela',
        tipo: 'saida',
        valor: 1500,
        data: '2026-10-15',
        status: 'pendente',
      },
      {
        id: 102,
        descricao: 'Notebook - Parcela',
        tipo: 'saida',
        valor: 1500,
        data: '2026-11-15',
        status: 'pendente',
      },
    ];

    service.criarTransacoesParceladas({
      tipo: 'saida',
      descricao: 'Notebook',
      valor: 3000,
      categoria: 'Equipamentos',
      data: '2026-10-15',
      parcelado: true,
      ispaycart: true,
      cartaoid: 1,
      parcelas: {
        QtdParcelas: 2,
        Valor: 1500,
      },
    }).subscribe((res) => {
      expect(res).toEqual(parcelasCriadas);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/transacoes/parceladas`);
    expect(req.request.method).toBe('POST');
    req.flush(parcelasCriadas);

    expect(service.extrato().length).toBe(2);
    expect(service.extrato()[0].id).toBe(101);
  });
});

