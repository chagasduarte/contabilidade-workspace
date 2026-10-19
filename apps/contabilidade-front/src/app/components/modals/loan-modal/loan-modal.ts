import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  businessOutline,
  cashOutline,
  calendarOutline,
  layersOutline,
  trendingUpOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { CreateLoanPayload, Loan } from '@contabilidade/models';
import { LoanService } from '../../../core/services/loan.service';

@Component({
  selector: 'app-loan-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonIcon],
  templateUrl: './loan-modal.html',
  styleUrl: './loan-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanModal {
  private readonly fb = inject(FormBuilder);
  readonly loanService = inject(LoanService);

  readonly isOpen = input<boolean>(false);
  readonly closeModal = output<void>();
  readonly loanCreated = output<Loan>();

  readonly salvando = signal<boolean>(false);
  readonly erroMensagem = signal<string | null>(null);
  readonly sucessoMensagem = signal<string | null>(null);

  private wasOpen = false;

  readonly form: FormGroup = this.fb.group({
    instituicao: ['', [Validators.required, Validators.minLength(2)]],
    valor_principal: [null as number | null, [Validators.required, Validators.min(1)]],
    taxa_juros_mensal: [1.5 as number | null, [Validators.required, Validators.min(0)]],
    quantidade_parcelas: [12 as number | null, [Validators.required, Validators.min(1), Validators.max(360)]],
    valor_parcela: [null as number | null, [Validators.required, Validators.min(0.01)]],
    primeiro_vencimento: [this.dataProximoMesIso(), [Validators.required]],
  });

  constructor() {
    addIcons({
      closeOutline,
      businessOutline,
      cashOutline,
      calendarOutline,
      layersOutline,
      trendingUpOutline,
      checkmarkCircleOutline,
    });

    effect(() => {
      const open = this.isOpen();
      if (open && !this.wasOpen) {
        this.wasOpen = true;
        untracked(() => {
          this.onAbrirModal();
        });
      } else if (!open && this.wasOpen) {
        this.wasOpen = false;
      }
    });

    // Recalcula sugestão de parcela quando valor principal, parcelas ou taxa mudam
    this.form.valueChanges.subscribe(() => {
      this.sugerirCalculoParcela();
    });
  }

  private onAbrirModal(): void {
    this.erroMensagem.set(null);
    this.sucessoMensagem.set(null);
    this.salvando.set(false);

    this.form.reset({
      instituicao: '',
      valor_principal: null,
      taxa_juros_mensal: 1.5,
      quantidade_parcelas: 12,
      valor_parcela: null,
      primeiro_vencimento: this.dataProximoMesIso(),
    });
  }

  /**
   * Sugere automaticamente o valor da parcela via Tabela Price quando o usuário
   * preenche o valor principal, a taxa e o prazo.
   */
  private sugerirCalculoParcela(): void {
    const principal = Number(this.form.get('valor_principal')?.value);
    const qtd = Number(this.form.get('quantidade_parcelas')?.value);
    const taxa = Number(this.form.get('taxa_juros_mensal')?.value);
    const parcelaControl = this.form.get('valor_parcela');

    if (principal > 0 && qtd > 0 && taxa >= 0 && (!parcelaControl?.dirty || !parcelaControl?.value)) {
      const i = taxa >= 1 ? taxa / 100 : taxa;
      let estimada = 0;

      if (i > 0) {
        const fator = Math.pow(1 + i, qtd);
        estimada = Number(((principal * (i * fator)) / (fator - 1)).toFixed(2));
      } else {
        estimada = Number((principal / qtd).toFixed(2));
      }

      if (estimada > 0) {
        parcelaControl?.patchValue(estimada, { emitEvent: false });
      }
    }
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erroMensagem.set('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const val = this.form.getRawValue();
    const principal = Number(val.valor_principal);
    const qtd = Number(val.quantidade_parcelas);
    const parcela = Number(val.valor_parcela);
    const taxa = Number(val.taxa_juros_mensal);

    if (isNaN(principal) || principal <= 0) {
      this.erroMensagem.set('O valor principal deve ser maior que zero.');
      return;
    }
    if (isNaN(qtd) || qtd < 1) {
      this.erroMensagem.set('A quantidade de parcelas deve ser pelo menos 1.');
      return;
    }
    if (isNaN(parcela) || parcela <= 0) {
      this.erroMensagem.set('O valor da parcela deve ser maior que zero.');
      return;
    }

    this.salvando.set(true);
    this.erroMensagem.set(null);

    const payload: CreateLoanPayload = {
      institution_name: val.instituicao.trim(),
      principal_amount: principal,
      monthly_interest_rate: taxa,
      total_installments: qtd,
      installment_amount: parcela,
      first_due_date: val.primeiro_vencimento,

      // Aliases para compatibilidade
      instituicao: val.instituicao.trim(),
      valor_principal: principal,
      taxa_juros_mensal: taxa,
      quantidade_parcelas: qtd,
      valor_parcela: parcela,
      primeiro_vencimento: val.primeiro_vencimento,
    };

    this.loanService.criarEmprestimo(payload).subscribe({
      next: (res) => {
        this.salvando.set(false);
        this.sucessoMensagem.set('Empréstimo e cronograma cadastrados com sucesso!');
        const createdLoan = res.loan ?? res.emprestimo;
        this.loanCreated.emit(createdLoan);
        setTimeout(() => {
          this.fechar();
        }, 400);
      },
      error: (err: unknown) => {
        this.salvando.set(false);
        const msg =
          err instanceof Error
            ? err.message
            : 'Erro ao cadastrar empréstimo. Verifique os dados.';
        this.erroMensagem.set(msg);
      },
    });
  }

  fechar(): void {
    this.closeModal.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.fechar();
    }
  }

  private dataProximoMesIso(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 10);
  }
}

