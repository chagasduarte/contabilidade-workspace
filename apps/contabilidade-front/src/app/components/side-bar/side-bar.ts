import { ChangeDetectionStrategy, Component, HostBinding } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  documentTextOutline,
  homeOutline,
  pricetagOutline,
  cashOutline,
} from 'ionicons/icons';
import { SideBarOptions } from '../side-bar-options/side-bar-options';

@Component({
  selector: 'app-side-bar',
  imports: [IonIcon, RouterLink, SideBarOptions],
  templateUrl: './side-bar.html',
  styleUrl: './side-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideBar {
  isCollapsed = false;

  @HostBinding('class.sidebar-host--collapsed')
  get sidebarHostCollapsed(): boolean {
    return this.isCollapsed;
  }

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      documentTextOutline,
      homeOutline,
      pricetagOutline,
      cashOutline,
    });
  }

  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
  }
}
