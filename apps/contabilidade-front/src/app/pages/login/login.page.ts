import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
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
  personOutline,
  pieChartOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { LoginCredentials } from '@contabilidade/models';
import { AuthService } from '../../core/services/auth.service';

export interface LoginForm {
  username: FormControl<string>;
  senha: FormControl<string>;
}

export interface FinancialFeature {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
}

export interface PreviewMetric {
  label: string;
  value: string;
  detail: string;
  color: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  readonly previewMetrics: readonly PreviewMetric[] = [
    {
      label: 'RECEBIMENTOS',
      value: 'R$ 40.000',
      detail: '89% da meta mensal',
      color: '#709366',
    },
    {
      label: 'DESPESAS',
      value: 'R$ 12.000',
      detail: 'Dentro do orçamento',
      color: '#cb5a4e',
    },
    {
      label: 'LIMITE DISPONÍVEL',
      value: 'R$ 11.760',
      detail: 'Faturas sincronizadas',
      color: '#C69B5C',
    },
  ];

  readonly features: readonly FinancialFeature[] = [
    {
      icon: 'pie-chart-outline',
      title: 'Fluxo de Caixa & Projeções',
      description: 'Acompanhe receitas, despesas e saldo acumulado com visão anual.',
      accentColor: '#709366',
    },
    {
      icon: 'card-outline',
      title: 'Gestão de Cartões & Parcelas',
      description: 'Fechamento automático de faturas, limites e compras parceladas.',
      accentColor: '#C69B5C',
    },
    {
      icon: 'trending-up-outline',
      title: 'Planejamento & Objetivos',
      description: 'Defina metas financeiras e tetos de gastos por categoria e subcategoria.',
      accentColor: '#506477',
    },
    {
      icon: 'sparkles-outline',
      title: 'Assistente Financeiro com IA',
      description: 'Registre transações via comando de texto ou foto de comprovante.',
      accentColor: '#4ade80',
    },
  ];

  readonly loginForm = new FormGroup<LoginForm>({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
  });

  constructor() {
    addIcons({
      walletOutline,
      mailOutline,
      personOutline,
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

  onSubmit(): void {
    this.errorMessage.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const formValues = this.loginForm.getRawValue();
    const isEmail = formValues.username.includes('@');
    const credentials: LoginCredentials = {
      ...(isEmail ? { email: formValues.username } : { nome: formValues.username }),
      senha: formValues.senha,
    };

    this.authService.login(credentials).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const message =
          err?.error?.erro ||
          err?.error?.error ||
          'Credenciais inválidas. Verifique seu usuário e senha.';
        this.errorMessage.set(message);
      },
    });
  }
}
