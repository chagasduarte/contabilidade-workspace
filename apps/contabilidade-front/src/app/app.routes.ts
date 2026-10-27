import { inject } from '@angular/core';
import { Route, Router } from '@angular/router';
import { AppLayout } from '@org/shared-ui-navigation';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
        data: { monthSelector: true },
      },
      {
        path: 'lancamentos',
        loadComponent: () =>
          import('./pages/lancamentos/lancamentos').then((m) => m.Lancamentos),
        data: { monthSelector: true },
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./pages/categorias/categorias.page').then((m) => m.CategoriasPage),
      },
      {
        path: 'contas',
        loadComponent: () =>
          import('./pages/navigation-info/navigation-info').then((m) => m.NavigationInfo),
        data: {
          title: 'Contas',
          description: 'Acompanhe suas contas e saldos em um só lugar.',
        },
      },
      {
        path: 'contasPlanejadas',
        redirectTo: () =>
          inject(Router).createUrlTree(['/lancamentos'], {
            queryParams: { status: 'pendente' },
          }),
        pathMatch: 'full',
      },
      {
        path: 'conciliacao',
        loadComponent: () =>
          import('./pages/navigation-info/navigation-info').then((m) => m.NavigationInfo),
        data: {
          title: 'Conciliação',
          description: 'Confira e concilie as movimentações das suas contas.',
        },
      },
      {
        path: 'planejamento',
        loadComponent: () =>
          import('./pages/planejamento/planejamento.page').then((m) => m.PlanejamentoPage),
        data: { monthSelector: true },
      },
      {
        path: 'objetivos',
        loadComponent: () =>
          import('./pages/objetivos/objetivos.page').then((m) => m.ObjetivosPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./pages/perfil/perfil.page').then((m) => m.PerfilPage),
      },
      {
        path: 'assistente',
        loadComponent: () =>
          import('./pages/assistente/assistente.page').then((m) => m.AssistentePage),
      },
      {
        path: 'mais',
        loadComponent: () =>
          import('./pages/mais/mais.page').then((m) => m.MaisPage),
      },
      {
        path: 'emprestimos',
        loadComponent: () =>
          import('./pages/loans/loans.page').then((m) => m.LoansPage),
      },
      {
        path: 'emprestimos/:id',
        loadComponent: () =>
          import('./pages/loan-details/loan-details.component').then(
            (m) => m.LoanDetailsComponent
          ),
      },
      {
        path: 'loans',
        loadComponent: () =>
          import('./pages/loans/loans.page').then((m) => m.LoansPage),
      },
      {
        path: 'loans/:id',
        loadComponent: () =>
          import('./pages/loan-details/loan-details.component').then(
            (m) => m.LoanDetailsComponent
          ),
      },
      {
        path: 'cartoes',
        loadComponent: () =>
          import('./pages/cards/cards.page').then((m) => m.CardsPage),
      },
      {
        path: 'cartoes/:id',
        loadComponent: () =>
          import('./pages/card-details/card-details.component').then(
            (m) => m.CardDetailsComponent
          ),
        data: { monthSelector: true },
      },
      {
        path: 'cartoes/:id/editar',
        loadComponent: () =>
          import('./pages/card-edit/card-edit.page').then((m) => m.CardEditPage),
      },
      {
        path: 'cards',
        loadComponent: () =>
          import('./pages/cards/cards.page').then((m) => m.CardsPage),
      },
      {
        path: 'cards/:id',
        loadComponent: () =>
          import('./pages/card-details/card-details.component').then(
            (m) => m.CardDetailsComponent
          ),
        data: { monthSelector: true },
      },
      {
        path: 'cards/:id/editar',
        loadComponent: () =>
          import('./pages/card-edit/card-edit.page').then((m) => m.CardEditPage),
      },
      {
        path: 'contas-pagar',
        redirectTo: () =>
          inject(Router).createUrlTree(['/lancamentos'], {
            queryParams: { tipo: 'saida', status: 'pendente' },
          }),
        pathMatch: 'full',
      },
      {
        path: 'contas-receber',
        redirectTo: () =>
          inject(Router).createUrlTree(['/lancamentos'], {
            queryParams: { tipo: 'entrada', status: 'pendente' },
          }),
        pathMatch: 'full',
      },
      {
        path: 'relatorios',
        loadComponent: () =>
          import('./pages/navigation-info/navigation-info').then((m) => m.NavigationInfo),
        data: {
          title: 'Relatórios',
          description: 'Os relatórios financeiros serão apresentados nesta área.',
        },
      },
      {
        path: 'configuracoes',
        loadComponent: () =>
          import('./pages/navigation-info/navigation-info').then((m) => m.NavigationInfo),
        data: {
          title: 'Configurações',
          description: 'As configurações da sua conta estarão disponíveis nesta área.',
        },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

