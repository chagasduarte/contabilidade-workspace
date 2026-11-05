import {
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  registerLocaleData,
} from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertController, IonContent, IonSpinner } from '@ionic/angular';
import { ParcelamentoDetalhes } from '@contabilidade/models';
import {
  Subject,
  firstValueFrom,
  catchError,
  combineLatest,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ParcelamentoService } from '../../core/services/parcelamento.service';

registerLocaleData(localePt, 'pt-BR');

@Component({
  selector: 'app-parcelamento',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonContent,
    IonSpinner,
  ],
  templateUrl: './parcelamento.page.html',
  styleUrl: './parcelamento.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelamentoPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  readonly excluindo = signal(false);
  readonly erroExclusao = signal<string | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ParcelamentoService);
  private readonly reload = new Subject<void>();
  readonly detalhes = signal<ParcelamentoDetalhes | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly filtro = signal<'todas' | 'pago' | 'pendente'>('todas');
  readonly parcelasVisiveis = computed(() =>
    (this.detalhes()?.parcelas ?? []).filter(
      (p) => this.filtro() === 'todas' || p.status === this.filtro(),
    ),
  );
  readonly proximaParcela = computed(
    () =>
      this.detalhes()?.parcelas.find((p) => p.status === 'pendente') ?? null,
  );

  constructor() {
    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))])
      .pipe(
        tap(() => {
          this.carregando.set(true);
          this.erro.set(null);
          this.detalhes.set(null);
        }),
        switchMap(([params]) => {
          const origem = params.get('origem');
          const id = params.get('grupoId');
          if ((origem !== 'conta' && origem !== 'cartao') || !id) {
            this.erro.set('Endereço de parcelamento inválido.');
            return of(null);
          }
          return this.service.detalhar(origem, id).pipe(
            catchError((error: unknown) => {
              const status = (error as { status?: number } | null)?.status;
              this.erro.set(
                status === 404
                  ? 'Parcelamento não encontrado.'
                  : 'Não foi possível carregar o parcelamento. Tente novamente.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((dados) => {
        this.detalhes.set(dados);
        this.carregando.set(false);
        this.filtro.set('todas');
      });
  }

  async excluirCompra(): Promise<void> {
    const dados = this.detalhes();
    if (!dados || this.excluindo()) return;
    this.excluindo.set(true);
    this.erroExclusao.set(null);
    try {
      const alert = await this.alertController.create({
        header: 'Excluir compra definitivamente?',
        subHeader: dados.descricao,
        message:
          'Todas as parcelas, inclusive as pagas, e os registros vinculados a esta compra serão excluídos. Esta ação não pode ser desfeita.' +
          (dados.origem === 'cartao'
            ? ' Faturas com outras compras serão preservadas.'
            : ''),
        backdropDismiss: false,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Excluir compra',
            role: 'confirm',
            cssClass: 'alert-button-danger',
          },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (
        role !== 'confirm' ||
        this.destroyRef.destroyed ||
        this.detalhes() !== dados
      )
        return;
      await firstValueFrom(
        this.service
          .excluir(dados.origem, dados.id)
          .pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (!this.destroyRef.destroyed && this.detalhes() === dados) {
        await this.router.navigate(['/lancamentos']);
      }
    } catch {
      if (!this.destroyRef.destroyed && this.detalhes() === dados) {
        this.erroExclusao.set(
          'Não foi possível confirmar a exclusão. Atualize a página antes de tentar novamente.',
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) this.excluindo.set(false);
    }
  }

  tentarNovamente(): void {
    this.reload.next();
  }
}
