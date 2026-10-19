import { Injectable } from '@angular/core';
import { DesktopHeaderStrategy } from './desktop-header.strategy';
import { DesktopHeaderConfig } from '../models/desktop-header.models';

@Injectable({
  providedIn: 'root',
})
export class DefaultHeaderStrategy implements DesktopHeaderStrategy {
  readonly routeKey = 'default';

  getConfig(): DesktopHeaderConfig {
    return {
      showSearch: false,
      showYearSelector: true,
      searchPlaceholder: 'Buscar...',
      title: '',
    };
  }
}

