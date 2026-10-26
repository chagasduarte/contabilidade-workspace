import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Objetivo } from '@contabilidade/models';
import { ObjetivoService } from './objetivo.service';
import { API_URL } from './categoria.service';

describe('ObjetivoService', () => {
  let service: ObjetivoService;
  let http: HttpTestingController;
  const api = 'http://api';
  const obj = { id: 1, nome: 'Viagem', valor_acumulado: 0 } as Objetivo;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: api }],
    });
    service = TestBed.inject(ObjetivoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista, cria, atualiza e remove mantendo o signal em dia', () => {
    service.listar().subscribe();
    http.expectOne(`${api}/objetivos`).flush([obj]);
    expect(service.objetivos()).toHaveLength(1);

    service.criar({ nome: 'Casa', tipo: 'Imóvel', valor_objetivo: 1, data_final: '2030-01-01' }).subscribe();
    http.expectOne({ method: 'POST', url: `${api}/objetivos` }).flush({ ...obj, id: 2 });
    expect(service.objetivos()).toHaveLength(2);

    service.atualizar(1, { valor_acumulado: 50 }).subscribe();
    http.expectOne({ method: 'PUT', url: `${api}/objetivos/1` }).flush({ ...obj, valor_acumulado: 50 });
    expect(service.objetivos()[0].valor_acumulado).toBe(50);

    service.remover(2).subscribe();
    http.expectOne({ method: 'DELETE', url: `${api}/objetivos/2` }).flush(null, { status: 204, statusText: 'No Content' });
    expect(service.objetivos().map((o) => o.id)).toEqual([1]);
  });

  it('registra erro amigável na listagem', () => {
    service.listar().subscribe({ error: () => undefined });
    http.expectOne(`${api}/objetivos`).flush(null, { status: 0, statusText: '' });
    expect(service.error()).toContain('Sem conexão');
  });
});
