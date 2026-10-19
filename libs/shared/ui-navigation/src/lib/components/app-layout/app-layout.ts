import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { APP_NAV_ITEMS } from '../../configs/navigation.config';
import { DesktopSidebar } from '../desktop-sidebar/desktop-sidebar';
import { DesktopHeader } from '../desktop-header/desktop-header';
import { MobileHeader } from '../mobile-header/mobile-header';
import { MobileTabbar } from '../mobile-tabbar/mobile-tabbar';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
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
  readonly isMobileMenuOpen = signal(false);
  readonly additionalItems = APP_NAV_ITEMS.filter((item) => !item.isMainTab);

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }
}
