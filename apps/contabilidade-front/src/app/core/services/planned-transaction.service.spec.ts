import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PlannedTransactionService } from './planned-transaction.service';
import { API_URL } from './categoria.service';
import { PlannedTransaction } from '@contabilidade/models';

describe('PlannedTransactionService', () => {
  let service: PlannedTransactionService;
  let httpTesting: HttpTestingController;
  const mockApiUrl = 'http://localhost:3000/api';

  const mockTransaction: PlannedTransaction = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userid: 1,
    descricao: 'Aluguel Apartamento',
    tipo: 'DESPESA',
    valor: 2500,
    data_prevista: '2026-11-05',
    idcategoria: 2,
    recorrencia: 'MENSAL',
    status: 'PENDING',
    parent_recurrence_id: null,
    is_recorrente: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlannedTransactionService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockApiUrl },
      ],
    });

    service = TestBed.inject(PlannedTransactionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.transacoesPlanejadas()).toEqual([]);
  });

  it('should create planned transaction and update signal', () => {
    service
      .criar({
        descricao: 'Aluguel Apartamento',
        tipo: 'DESPESA',
        valor: 2500,
        data_prevista: '2026-11-05',
        recorrencia: 'MENSAL',
      })
      .subscribe((res) => {
        expect(res).toEqual(mockTransaction);
      });

    const req = httpTesting.expectOne(`${mockApiUrl}/planned-transactions`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTransaction);

    expect(service.transacoesPlanejadas()).toContainEqual(mockTransaction);
  });

  it('should update planned transaction with updateMode', () => {
    const updated = { ...mockTransaction, valor: 2600 };

    service
      .atualizar(mockTransaction.id, {
        valor: 2600,
        updateMode: 'ALL_FUTURE',
      })
      .subscribe((res) => {
        expect(res.valor).toBe(2600);
      });

    const req = httpTesting.expectOne(
      `${mockApiUrl}/planned-transactions/${mockTransaction.id}`
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.updateMode).toBe('ALL_FUTURE');
    req.flush(updated);
  });

  it('should delete planned transaction and remove from signal', () => {
    service.transacoesPlanejadas.set([mockTransaction]);

    service.deletar(mockTransaction.id).subscribe((res) => {
      expect(res.id).toBe(mockTransaction.id);
    });

    const req = httpTesting.expectOne(
      `${mockApiUrl}/planned-transactions/${mockTransaction.id}`
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Excluído', id: mockTransaction.id });

    expect(service.transacoesPlanejadas()).toHaveLength(0);
  });
});

