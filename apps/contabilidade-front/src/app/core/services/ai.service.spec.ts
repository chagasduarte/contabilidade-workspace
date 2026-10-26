import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiErro, AiService } from './ai.service';
import { API_URL } from './categoria.service';

describe('AiService', () => {
  let service: AiService;
  let http: HttpTestingController;
  const api = 'http://api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: api }],
    });
    service = TestBed.inject(AiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envia mensagem e foto e devolve a sugestão', () => {
    let tipo = '';
    service.sugerir({ message: 'mercado 50', base64Image: 'data:image/jpeg;base64,AA' }).subscribe((s) => (tipo = s.tipo));
    const req = http.expectOne({ method: 'POST', url: `${api}/ai/chat` });
    expect(req.request.body).toEqual({ message: 'mercado 50', base64Image: 'data:image/jpeg;base64,AA' });
    req.flush({ tipo: 'saida', descricao: 'Mercado', valor: 50, categoria: 'Alimentação', data: '2026-10-26' });
    expect(tipo).toBe('saida');
  });

  it('expõe o erro amigável e o código da API', () => {
    let erro: AiErro | undefined;
    service.sugerir({ message: 'x' }).subscribe({ error: (e: AiErro) => (erro = e) });
    http
      .expectOne(`${api}/ai/chat`)
      .flush(
        { erro: 'Tente uma foto mais nítida.', codigo: 'IA_SEM_RESULTADO' },
        { status: 422, statusText: 'Unprocessable' }
      );
    expect(erro).toBeInstanceOf(AiErro);
    expect(erro?.message).toBe('Tente uma foto mais nítida.');
    expect(erro?.codigo).toBe('IA_SEM_RESULTADO');
    expect(erro?.status).toBe(422);
  });
});
