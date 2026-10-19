import { Injectable } from '@angular/core';
import { DesktopHeaderStrategy } from './desktop-header.strategy';
import { DesktopHeaderConfig } from '../models/desktop-header.models';

@Injectable({
  providedIn: 'root',
})
export class LancamentosHeaderStrategy implements DesktopHeaderStrategy {
  readonly routeKey = 'lancamentos';

  getConfig(): DesktopHeaderConfig {
    return {
      showSearch: true,
      showYearSelector: true,
      searchPlaceholder: 'Buscar lançamentos...',
      title: 'Lançamentos',
    };
  }
}

