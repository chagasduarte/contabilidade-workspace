import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

import { APP_NAV_ITEMS } from '../../configs/navigation.config';
import { DesktopSidebar } from '../desktop-sidebar/desktop-sidebar';
import { DesktopHeader } from '../desktop-header/desktop-header';
import { MobileHeader } from '../mobile-header/mobile-header';
import { MobileTabbar } from '../mobile-tabbar/mobile-tabbar';
import { AUTH_NAVIGATION_HANDLER } from '../../tokens/auth-navigation.token';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonIcon,
    DesktopSidebar,
    DesktopHeader,
    MobileHeader,
    MobileTabbar,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  readonly authHandler = inject(AUTH_NAVIGATION_HANDLER, { optional: true });
  readonly isMobileMenuOpen = signal(false);
  readonly additionalItems = APP_NAV_ITEMS.filter((item) => !item.isMainTab);

  constructor() {
    addIcons({ logOutOutline });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  onLogout(): void {
    this.closeMobileMenu();
    this.authHandler?.logout();
  }
}
