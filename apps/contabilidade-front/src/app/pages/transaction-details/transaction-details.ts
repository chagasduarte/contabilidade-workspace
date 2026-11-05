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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  combineLatest,
  switchMap,
  catchError,
  of,
  tap,
  Subject,
  startWith,
} from 'rxjs';
import { TransactionDetails } from '@contabilidade/models';
import { TransacaoService } from '../../core/services/transacao.service';
import { summarizeInstallments } from './transaction-details.presenter';

registerLocaleData(localePt, 'pt-BR');

@Component({
  selector: 'app-transaction-details',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    ReactiveFormsModule,
  ],
  templateUrl: './transaction-details.html',
  styleUrl: './transaction-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionDetailsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(TransacaoService);
  private readonly reload = new Subject<void>();
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly form = this.fb.nonNullable.group({
    descricao: ['', [Validators.required, Validators.minLength(2)]],
    valor: [0, [Validators.required, Validators.min(0.01)]],
    data: ['', Validators.required],
    tipo: ['saida' as 'entrada' | 'saida', Validators.required],
    status: ['pendente' as 'pendente' | 'pago', Validators.required],
  });
  readonly details = signal<TransactionDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = computed(() =>
    summarizeInstallments(this.details()?.parcelas ?? []),
  );

  constructor() {
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.details.set(null);
          this.saved.set(false);
          this.saveError.set(null);
          this.saving.set(false);
        }),
        switchMap(([params, query]) =>
          this.service
            .obterDetalhes(params.get('id') ?? '', query.get('origem'))
            .pipe(
              catchError(() => {
                this.error.set(
                  'Não foi possível carregar os detalhes. Verifique sua conexão e tente novamente.',
                );
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((details) => {
        this.details.set(details);
        this.loading.set(false);
        if (details && !details.parcelado) {
          this.form.enable();
          if (details.lancamento.source_type === 'CREDIT_CARD_INVOICE_ITEM') {
            this.form.controls.data.disable();
            this.form.controls.tipo.disable();
            this.form.controls.status.disable();
          }
          this.form.reset({
            descricao: details.lancamento.descricao,
            valor: Number(details.lancamento.valor),
            data: details.lancamento.data.slice(0, 10),
            tipo: details.lancamento.tipo === 'entrada' ? 'entrada' : 'saida',
            status: details.lancamento.status,
          });
        }
      });
  }

  retry(): void {
    this.reload.next();
  }

  salvar(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const details = this.details();
    if (this.form.invalid || !details || details.parcelado) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    this.service
      .atualizar(
        String(details.lancamento.id),
        this.form.getRawValue(),
        this.route.snapshot.queryParamMap.get('origem'),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          if (this.details()?.lancamento.id !== details.lancamento.id) return;
          this.details.set({ ...details, lancamento: updated });
          this.saving.set(false);
          this.saved.set(true);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set(
            details.lancamento.source_type === 'CREDIT_CARD_INVOICE_ITEM'
              ? 'Não foi possível salvar. Compras de cartão só podem ser editadas em faturas abertas.'
              : 'Não foi possível salvar. Tente novamente.',
          );
        },
      });
  }
}
