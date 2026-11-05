import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ParcelamentoService } from './parcelamento.service';
import { API_URL } from './categoria.service';

describe('Exclusão HTTP do parcelamento', () => {
  it('envia DELETE para a compra inteira e aceita resposta sem conteúdo', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    const service = TestBed.inject(ParcelamentoService);
    const http = TestBed.inject(HttpTestingController);
    const next = vi.fn();
    service.excluir('cartao', 'grupo').subscribe(next);
    const req = http.expectOne('/api/transacoes/parcelamentos/cartao/grupo');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(next).toHaveBeenCalledOnce();
    http.verify();
  });
});
