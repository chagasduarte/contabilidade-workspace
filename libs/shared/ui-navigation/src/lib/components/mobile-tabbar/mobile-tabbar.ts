import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  listOutline,
  walletOutline,
  pieChartOutline,
  checkmarkCircleOutline,
  ellipsisHorizontal
} from 'ionicons/icons';
import { APP_NAV_ITEMS } from '../../configs/navigation.config';

@Component({
  selector: 'app-mobile-tabbar',
  standalone: true,
  imports: [CommonModule, RouterModule, IonIcon],
  templateUrl: './mobile-tabbar.html',
  styleUrl: './mobile-tabbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTabbar {
  mainTabs = APP_NAV_ITEMS.filter((item) => item.isMainTab);

  constructor() {
    addIcons({
      homeOutline,
      listOutline,
      walletOutline,
      pieChartOutline,
      checkmarkCircleOutline,
      ellipsisHorizontal
    });
  }
}