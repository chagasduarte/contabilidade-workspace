import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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
  readonly searchTerm = signal<string>('');

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
      });
  }

  setYear(year: number): void {
    if (year !== this.selectedYear()) {
      this.selectedYear.set(year);
    }
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }
}

