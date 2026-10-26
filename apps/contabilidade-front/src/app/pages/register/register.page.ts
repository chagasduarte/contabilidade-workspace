import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonSpinner,
  IonText,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  analyticsOutline,
  arrowForwardOutline,
  cardOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personAddOutline,
  personOutline,
  pieChartOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { mensagemErroHttp } from '../../core/utils/http-error';

export interface RegisterForm {
  nome: FormControl<string>;
  email: FormControl<string>;
  senha: FormControl<string>;
  confirmarSenha: FormControl<string>;
}

export function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const senha = group.get('senha')?.value;
    const confirmarSenha = group.get('confirmarSenha')?.value;

    if (!confirmarSenha) {
      return null;
    }

    if (senha !== confirmarSenha) {
      group.get('confirmarSenha')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (group.get('confirmarSenha')?.hasError('passwordMismatch')) {
      group.get('confirmarSenha')?.setErrors(null);
    }

    return null;
  };
}

export interface FinancialBenefit {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
    IonNote,
    IonText,
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  readonly benefits: readonly FinancialBenefit[] = [
    {
      icon: 'pie-chart-outline',
      title: 'Controle Total do Orçamento',
      description: 'Categorias, subcategorias e projeções em tempo real para seu planejamento mensal.',
      accentColor: '#709366',
    },
    {
      icon: 'card-outline',
      title: 'Múltiplos Cartões e Empréstimos',
      description: 'Gestão completa de faturas, parcelas e tabela Price integrada ao seu fluxo de caixa.',
      accentColor: '#C69B5C',
    },
    {
      icon: 'sparkles-outline',
      title: 'Lançamentos Inteligentes com IA',
      description: 'Digitalização automática de comprovantes e comandos em linguagem natural.',
      accentColor: '#4ade80',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Dados 100% Seguros e Privados',
      description: 'Criptografia de senhas, tokens protegidos e banco de dados isolado.',
      accentColor: '#506477',
    },
  ];

  readonly registerForm = new FormGroup<RegisterForm>(
    {
      nome: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      senha: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(4)],
      }),
      confirmarSenha: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordsMatchValidator()] }
  );

  constructor() {
    addIcons({
      walletOutline,
      mailOutline,
      personOutline,
      personAddOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
      pieChartOutline,
      cardOutline,
      trendingUpOutline,
      sparklesOutline,
      shieldCheckmarkOutline,
      arrowForwardOutline,
      checkmarkCircleOutline,
      analyticsOutline,
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { nome, email, senha } = this.registerForm.getRawValue();

    this.authService.register({ nome, email, senha }).subscribe({
      next: () => {
        this.successMessage.set('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 800);
      },
      error: (err) => {
        // Sem conexão vira "Sem conexão…" em vez de "credenciais inválidas".
        const message = mensagemErroHttp(err, 'Erro ao criar conta. Verifique os dados informados.');
        this.errorMessage.set(message);
      },
    });
  }
}

