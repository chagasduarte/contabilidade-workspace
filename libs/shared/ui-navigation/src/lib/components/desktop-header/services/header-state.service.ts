import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { DesktopHeaderStrategyFactory } from '../strategies/desktop-header-strategy.factory';
import { DesktopHeaderConfig } from '../models/desktop-header.models';
import { DesktopHeaderStrategy } from '../strategies/desktop-header.strategy';

@Injectable({
  providedIn: 'root',
})
export class HeaderStateService {
  private readonly router = inject(Router);
  private readonly strategyFactory = inject(DesktopHeaderStrategyFactory);

  readonly currentRoute = signal<string>(this.router.url || '');
  readonly selectedYear = signal<number>(new Date().getFullYear());
  /** Mês selecionado (1-12), compartilhado entre a régua do header mobile e as páginas. */
  readonly selectedMonth = signal<number>(new Date().getMonth() + 1);
  readonly searchTerm = signal<string>('');
  /**
   * Indica se a rota ativa trabalha por mês (`data: { monthSelector: true }`).
   * Controla a exibição da régua de meses do header mobile.
   */
  readonly showMonthSelector = signal<boolean>(false);

  readonly currentStrategy = computed<DesktopHeaderStrategy>(() =>
    this.strategyFactory.create(this.currentRoute())
  );

  readonly headerConfig = computed<DesktopHeaderConfig>(() =>
    this.currentStrategy().getConfig()
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;
        this.currentRoute.set(url);
        this.showMonthSelector.set(this.rotaUsaMes(this.router.routerState.snapshot.root));
      });
  }

  private rotaUsaMes(root: ActivatedRouteSnapshot): boolean {
    let atual: ActivatedRouteSnapshot | null = root;
    let usaMes = false;
    while (atual) {
      if (atual.data?.['monthSelector'] === true) {
        usaMes = true;
      }
      atual = atual.firstChild;
    }
    return usaMes;
  }

  setYear(year: number): void {
    if (year !== this.selectedYear()) {
      this.selectedYear.set(year);
    }
  }

  setMonth(month: number): void {
    if (month >= 1 && month <= 12 && month !== this.selectedMonth()) {
      this.selectedMonth.set(month);
    }
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }
}

