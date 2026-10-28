import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkDoneCircle,
  homeOutline,
  listOutline,
  pricetagOutline,
  cardOutline,
  arrowDownCircleOutline,
  checkmarkCircleOutline,
  barChartOutline,
  settingsOutline,
  cashOutline,
  walletOutline,
  logOutOutline,
  pieChartOutline,
  flagOutline,
  sparklesOutline,
  personCircleOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';
import { APP_NAV_ITEMS } from '../../configs/navigation.config';
import { AUTH_NAVIGATION_HANDLER } from '../../tokens/auth-navigation.token';
import { HeaderStateService } from '../desktop-header/services/header-state.service';

registerLocaleData(localePt, 'pt-BR');

@Component({
  selector: 'app-desktop-sidebar',
  imports: [CommonModule, RouterModule, IonIcon],
  templateUrl: './desktop-sidebar.html',
  styleUrl: './desktop-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopSidebar {
  readonly authHandler = inject(AUTH_NAVIGATION_HANDLER, { optional: true });
  private readonly headerState = inject(HeaderStateService);
  items = APP_NAV_ITEMS.filter((item) => item.label !== 'Mais');

  readonly accountBalance = this.headerState.accountBalance;
  readonly balanceVisible = this.headerState.balanceVisible;

  readonly userName = computed(() => {
    return this.authHandler?.currentUser?.()?.nome || 'Usuário';
  });

  readonly userEmail = computed(() => {
    return this.authHandler?.currentUser?.()?.email || '';
  });

  readonly userInitial = computed(() => {
    const nome = this.authHandler?.currentUser?.()?.nome;
    return (nome?.charAt(0) || 'U').toUpperCase();
  });

  constructor() {
    addIcons({
      checkmarkDoneCircle,
      homeOutline,
      listOutline,
      pricetagOutline,
      cardOutline,
      arrowDownCircleOutline,
      checkmarkCircleOutline,
      barChartOutline,
      settingsOutline,
      cashOutline,
      walletOutline,
      logOutOutline,
      pieChartOutline,
      flagOutline,
      sparklesOutline,
      personCircleOutline,
      eyeOutline,
      eyeOffOutline,
    });
  }

  toggleBalanceVisibility(): void {
    this.headerState.toggleBalanceVisibility();
  }

  onLogout(): void {
    this.authHandler?.logout();
  }
}
