import { DesktopHeaderConfig } from '../models/desktop-header.models';

export interface DesktopHeaderStrategy {
  readonly routeKey: string;
  getConfig(): DesktopHeaderConfig;
}

