import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, finalize } from 'rxjs';
import {
  Loan,
  LoanSummary,
  PaymentPayload,
  CreateLoanPayload,
} from '@contabilidade/models';
import { environment } from '../../../environments/environment';
import { API_URL } from './categoria.service';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const errorObj = err as {
      error?: { erro?: string; message?: string; error?: string };
      message?: string;
    };
    if (errorObj.error) {
      if (errorObj.error.erro) return String(errorObj.error.erro);
      if (errorObj.error.message) return String(errorObj.error.message);
      if (errorObj.error.error) return String(errorObj.error.error);
    }
    if (errorObj.message) {
      return String(errorObj.message);
    }
  }
  return fallback;
}

@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    inject(API_URL, { optional: true }) ?? environment.apiUrl;

  readonly resumo = signal<LoanSummary | null>(null);
  readonly emprestimos = signal<Loan[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Obtém o resumo consolidado do empréstimo (contrato, cronograma de parcelas,
   * total pago, descontos obtidos e saldo devedor restante).
   */
  obterResumo(id: string): Observable<LoanSummary> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<LoanSummary>(`${this.baseUrl}/loans/${id}/resumo`).pipe(
      tap((data) => {
        this.resumo.set(data);
      }),
      catchError((err: unknown) => {
        const msg = extractErrorMessage(err, 'Erro ao carregar resumo do empréstimo.');
        this.error.set(msg);
        return throwError(() => new Error(msg));
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Registra a quitação ou antecipação de uma parcela com desconto financeiro.
   */
  registrarPagamento(payload: PaymentPayload): Observable<unknown> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<unknown>(`${this.baseUrl}/loans/pagamentos`, payload)
      .pipe(
        catchError((err: unknown) => {
          const msg = extractErrorMessage(err, 'Erro ao registrar pagamento da parcela.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }

  /**
   * Lista todos os empréstimos do usuário logado.
   */
  listarEmprestimos(): Observable<Loan[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<Loan[]>(`${this.baseUrl}/loans`).pipe(
      tap((data) => {
        this.emprestimos.set(data ?? []);
      }),
      catchError((err: unknown) => {
        const msg = extractErrorMessage(err, 'Erro ao listar empréstimos.');
        this.error.set(msg);
        return throwError(() => new Error(msg));
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  /**
   * Cria um novo contrato de empréstimo e seu cronograma de parcelas.
   */
  criarEmprestimo(
    payload: CreateLoanPayload
  ): Observable<{
    loan: Loan;
    installments: unknown[];
    emprestimo: Loan;
    parcelas: unknown[];
  }> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<{
        loan: Loan;
        installments: unknown[];
        emprestimo: Loan;
        parcelas: unknown[];
      }>(
        `${this.baseUrl}/loans`,
        payload
      )
      .pipe(
        catchError((err: unknown) => {
          const msg = extractErrorMessage(err, 'Erro ao criar empréstimo.');
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => {
          this.loading.set(false);
        })
      );
  }
}
