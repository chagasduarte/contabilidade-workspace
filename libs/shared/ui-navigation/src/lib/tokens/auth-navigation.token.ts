import { InjectionToken } from '@angular/core';

export interface AuthNavigationUser {
  id?: number | string;
  nome?: string;
  email?: string;
  avatar?: string;
}

export interface AuthNavigationHandler {
  logout: () => void;
  currentUser?: () => AuthNavigationUser | null;
}

export const AUTH_NAVIGATION_HANDLER = new InjectionToken<AuthNavigationHandler>(
  'AUTH_NAVIGATION_HANDLER'
);

