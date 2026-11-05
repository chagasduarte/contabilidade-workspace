import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ParcelamentoDetalhes } from '@contabilidade/models';
import { ParcelamentoPage } from './parcelamento.page';
import { ParcelamentoService } from '../../core/services/parcelamento.service';
const dados: ParcelamentoDetalhes = {
  id: 'grupo',
  origem: 'conta',
  descricao: 'Notebook',
  totalParcelas: 3,
  historicoCompleto: true,
  total: 300,
  totalPago: 100,
  saldoRestante: 200,
  parcelasPagas: 1,
  parcelasPendentes: 2,
  progresso: 100 / 3,
  parcelas: [1, 2, 3].map((i) => ({
    id: String(i),
    numero: i,
    valor: 100,
    vencimento: `2026-0${i}-10`,
    status: i === 1 ? 'pago' : 'pendente',
  })),
};
describe('ParcelamentoPage', () => {
  const service = { detalhar: vi.fn(), excluir: vi.fn() };
  const alert = { present: vi.fn(), onDidDismiss: vi.fn() };
  const alertController = { create: vi.fn() };
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    vi.resetAllMocks();
    service.detalhar.mockReturnValue(of(dados));
    service.excluir.mockReturnValue(of(undefined));
    alert.present.mockResolvedValue(undefined);
    alert.onDidDismiss.mockResolvedValue({ role: 'cancel' });
    alertController.create.mockResolvedValue(alert);
    params = new BehaviorSubject(
      convertToParamMap({ origem: 'conta', grupoId: 'grupo' }),
    );
    TestBed.configureTestingModule({
      imports: [ParcelamentoPage],
      providers: [
        provideRouter([]),
        { provide: AlertController, useValue: alertController },
        { provide: ParcelamentoService, useValue: service },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
  });
  it('apresenta valores e permite filtrar parcelas sem alterar o resumo', () => {
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.parcelas li')).toHaveLength(3);
    expect(root.textContent).toContain('Notebook');
    expect(root.querySelector('progress')?.value).toBeCloseTo(100 / 3);
    root.querySelectorAll<HTMLButtonElement>('.filtros button')[2].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.parcelas li')).toHaveLength(1);
    expect(fixture.componentInstance.detalhes()?.saldoRestante).toBe(200);
    expect(service.detalhar).toHaveBeenCalledTimes(1);
  });
  it('permite repetir a consulta após erro', () => {
    service.detalhar
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of(dados));
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.componentInstance.tentarNovamente();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('progress')).toBeTruthy();
  });
  it('distingue registro inexistente e rota inválida', () => {
    service.detalhar.mockReturnValue(throwError(() => ({ status: 404 })));
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.erro()).toBe(
      'Parcelamento não encontrado.',
    );
    params.next(convertToParamMap({ origem: 'invalida', grupoId: 'grupo' }));
    expect(fixture.componentInstance.erro()).toBe(
      'Endereço de parcelamento inválido.',
    );
    expect(service.detalhar).toHaveBeenCalledTimes(1);
  });
  it('sinaliza histórico incompleto sem anunciar quitação', () => {
    service.detalhar.mockReturnValue(
      of({ ...dados, historicoCompleto: false, parcelasPendentes: 0 }),
    );
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'histórico desta compra está incompleto',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Quitado');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Todas as parcelas foram pagas.',
    );
  });
  it('exige confirmação e não exclui ao cancelar', async () => {
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    await fixture.componentInstance.excluirCompra();
    expect(alertController.create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Excluir compra definitivamente?',
        message: expect.stringContaining('inclusive as pagas'),
        buttons: expect.arrayContaining([
          expect.objectContaining({ text: 'Cancelar', role: 'cancel' }),
        ]),
      }),
    );
    expect(service.excluir).not.toHaveBeenCalled();
    expect(fixture.componentInstance.excluindo()).toBe(false);
  });
  it('exclui todas as parcelas após confirmar e volta aos lançamentos', async () => {
    alert.onDidDismiss.mockResolvedValue({ role: 'confirm' });
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    await fixture.componentInstance.excluirCompra();
    expect(service.excluir).toHaveBeenCalledWith('conta', 'grupo');
    expect(navigate).toHaveBeenCalledWith(['/lancamentos']);
  });
  it('mantém a página e informa erro quando a exclusão falha', async () => {
    alert.onDidDismiss.mockResolvedValue({ role: 'confirm' });
    service.excluir.mockReturnValue(throwError(() => new Error('offline')));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    await fixture.componentInstance.excluirCompra();
    fixture.detectChanges();
    expect(fixture.componentInstance.detalhes()).toEqual(dados);
    expect(fixture.componentInstance.excluindo()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('Não foi possível confirmar a exclusão');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('evita confirmações duplicadas e exclusão se a rota mudar durante o aviso', async () => {
    let responder: (value: { role: string }) => void = () => undefined;
    alert.onDidDismiss.mockReturnValue(
      new Promise((resolve) => {
        responder = resolve;
      }),
    );
    const fixture = TestBed.createComponent(ParcelamentoPage);
    fixture.detectChanges();
    const pending = fixture.componentInstance.excluirCompra();
    await fixture.componentInstance.excluirCompra();
    await Promise.resolve();
    await Promise.resolve();
    expect(alertController.create).toHaveBeenCalledTimes(1);
    params.next(convertToParamMap({ origem: 'invalida', grupoId: 'outro' }));
    responder({ role: 'confirm' });
    await pending;
    expect(service.excluir).not.toHaveBeenCalled();
  });
});
