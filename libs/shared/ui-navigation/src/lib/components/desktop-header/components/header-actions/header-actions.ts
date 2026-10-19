import {
  ChangeDetectionStrategy,
  Component,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-header-actions',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './header-actions.html',
  styleUrl: './header-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderActions {
  readonly notificationClick = output<void>();

  constructor() {
    addIcons({ notificationsOutline });
  }

  onNotificationClick(): void {
    this.notificationClick.emit();
  }
}

