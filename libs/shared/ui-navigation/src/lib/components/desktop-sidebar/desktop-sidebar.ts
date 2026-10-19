import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
} from 'ionicons/icons';
import { APP_NAV_ITEMS } from '../../configs/navigation.config';

@Component({
  selector: 'app-desktop-sidebar',
  imports: [CommonModule, RouterModule, IonIcon],
  templateUrl: './desktop-sidebar.html',
  styleUrl: './desktop-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopSidebar {
  items = APP_NAV_ITEMS.filter((item) => item.label !== 'Mais');

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
    });
  }
}
