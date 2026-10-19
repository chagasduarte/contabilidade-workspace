import { Injectable } from '@angular/core';
import { DesktopHeaderStrategy } from './desktop-header.strategy';
import { DesktopHeaderConfig } from '../models/desktop-header.models';

@Injectable({
  providedIn: 'root',
})
export class DashboardHeaderStrategy implements DesktopHeaderStrategy {
  readonly routeKey = 'dashboard';

  getConfig(): DesktopHeaderConfig {
    return {
      showSearch: false,
      showYearSelector: true,
      searchPlaceholder: '',
      title: 'Dashboard',
    };
  }
}

