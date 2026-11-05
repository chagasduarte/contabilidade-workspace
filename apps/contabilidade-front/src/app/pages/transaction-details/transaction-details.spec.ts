import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionDetailsPage } from './transaction-details';
import { TransacaoService } from '../../core/services/transacao.service';
import { TransactionDetails } from '@contabilidade/models';

const transaction = {
  id: 7,
  descricao: 'Computador',
  valor: 100,
  data: '2026-11-01',
  tipo: 'saida' as const,
  status: 'pendente' as const,
};
const ordinary: TransactionDetails = {
  lancamento: transaction,
  parcelas: [],
  parcelado: false,
};

describe('Página de lançamento e parcelamento', () => {
  const service = { obterDetalhes: vi.fn(), atualizar: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    service.obterDetalhes.mockReturnValue(of(ordinary));
    TestBed.configureTestingModule({
      imports: [TransactionDetailsPage],
      providers: [
        provideRouter([]),
        { provide: TransacaoService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '7' })),
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              paramMap: convertToParamMap({ id: '7' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
  });

  it('abre edição preenchida e salva o lançamento existente', () => {
    service.atualizar.mockReturnValue(
      of({ ...transaction, descricao: 'Computador atualizado' }),
    );
    const fixture = TestBed.createComponent(TransactionDetailsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#descricao').value).toBe(
      'Computador',
    );
    fixture.componentInstance.form.controls.descricao.setValue(
      'Computador atualizado',
    );
    fixture.componentInstance.salvar();
    expect(service.atualizar).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ descricao: 'Computador atualizado' }),
      null,
    );
    expect(fixture.componentInstance.saved()).toBe(true);
  });

  it('exibe parcelas pagas e pendentes sem formulário de edição', () => {
    service.obterDetalhes.mockReturnValue(
      of({
        lancamento: transaction,
        parcelado: true,
        parcelas: [
          { ...transaction, numero_parcela: 1, status: 'pago', valor: 50 },
          { ...transaction, id: 8, numero_parcela: 2, valor: 50 },
        ],
      }),
    );
    const fixture = TestBed.createComponent(TransactionDetailsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.installments li'),
    ).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('progress').value).toBe(50);
    expect(fixture.nativeElement.textContent).toContain('1 parcelas restantes');
  });

  it('permite repetir uma consulta que falhou', () => {
    service.obterDetalhes
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of(ordinary));
    const fixture = TestBed.createComponent(TransactionDetailsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.componentInstance.retry();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
  });

  it('mantém o formulário e informa falha ao salvar', () => {
    service.atualizar.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(TransactionDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.salvar();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.saveError()).toBeTruthy();
    expect(fixture.componentInstance.form.controls.descricao.value).toBe(
      'Computador',
    );
  });
});
