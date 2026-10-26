import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanejamentoService } from './planejamento.service';
import { API_URL } from './categoria.service';

describe('PlanejamentoService', () => {
  let service: PlanejamentoService;
  let http: HttpTestingController;
  const api = 'http://api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: api }],
    });
    service = TestBed.inject(PlanejamentoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carrega resumo (com tipo) e agrupados do mês em paralelo', () => {
    service.carregarMes(10, 2026, 'despesa').subscribe();
    expect(service.loading()).toBe(true);

    http.expectOne(`${api}/planejamento/resumo?mes=10&ano=2026&tipo=despesa`).flush({
      mes: 10,
      ano: 2026,
      tipo: 'despesa',
      totais: { planejado: 100, realizado_pago: 50, realizado_pendente: 10 },
      categorias: [],
    });
    http.expectOne(`${api}/planejamento/agrupados?mes=10&ano=2026`).flush([]);

    expect(service.resumo()?.totais.planejado).toBe(100);
    expect(service.loading()).toBe(false);
  });

  it('expõe mensagem amigável em erro', () => {
    service.carregarMes(10, 2026, 'despesa').subscribe({ error: () => undefined });
    // agrupados responde primeiro; o erro do resumo encerra o forkJoin sem requisições pendentes
    http.expectOne(`${api}/planejamento/agrupados?mes=10&ano=2026`).flush([]);
    http
      .expectOne(`${api}/planejamento/resumo?mes=10&ano=2026&tipo=despesa`)
      .flush({ erro: 'Mês inválido.' }, { status: 400, statusText: 'Bad Request' });
    expect(service.error()).toBe('Mês inválido.');
    expect(service.loading()).toBe(false);
  });

  it('cria, atualiza e remove', () => {
    service.criar({ categoriaid: 1, valor: 10, data: '2026-10-01' }).subscribe();
    const post = http.expectOne(`${api}/planejamento`);
    expect(post.request.method).toBe('POST');
    post.flush({});

    service.atualizar(5, { valor: 20 }).subscribe();
    const put = http.expectOne(`${api}/planejamento/5`);
    expect(put.request.body).toEqual({ valor: 20 });
    put.flush({});

    service.remover(5).subscribe();
    const del = http.expectOne(`${api}/planejamento/5`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
