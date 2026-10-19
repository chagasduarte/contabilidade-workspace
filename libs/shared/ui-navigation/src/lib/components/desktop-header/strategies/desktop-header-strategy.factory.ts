import { inject, Injectable } from '@angular/core';
import { DesktopHeaderStrategy } from './desktop-header.strategy';
import { DashboardHeaderStrategy } from './dashboard-header.strategy';
import { LancamentosHeaderStrategy } from './lancamentos-header.strategy';
import { DefaultHeaderStrategy } from './default-header.strategy';

@Injectable({
  providedIn: 'root',
})
export class DesktopHeaderStrategyFactory {
  private readonly defaultStrategy = inject(DefaultHeaderStrategy);
  private readonly strategies = new Map<string, DesktopHeaderStrategy>();

  constructor() {
    const dashboardStrategy = inject(DashboardHeaderStrategy);
    const lancamentosStrategy = inject(LancamentosHeaderStrategy);

    this.registerStrategy(dashboardStrategy);
    this.registerStrategy(lancamentosStrategy);
  }

  registerStrategy(strategy: DesktopHeaderStrategy): void {
    this.strategies.set(strategy.routeKey.toLowerCase(), strategy);
  }

  create(urlOrRoute: string): DesktopHeaderStrategy {
    const key = this.extractRouteKey(urlOrRoute);
    return this.strategies.get(key) ?? this.defaultStrategy;
  }

  private extractRouteKey(url: string): string {
    if (!url) return '';
    const clean = url.split('?')[0].split('#')[0];
    const segments = clean.split('/').filter(Boolean);
    return (segments[0] || '').toLowerCase();
  }
}

