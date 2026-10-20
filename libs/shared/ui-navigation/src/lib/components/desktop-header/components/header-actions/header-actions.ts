import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notificationsOutline, logOutOutline } from 'ionicons/icons';
import { AUTH_NAVIGATION_HANDLER } from '../../../../tokens/auth-navigation.token';

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
  readonly logoutClick = output<void>();
  readonly authHandler = inject(AUTH_NAVIGATION_HANDLER, { optional: true });

  readonly userName = computed(() => {
    return this.authHandler?.currentUser?.()?.nome || 'Usuário';
  });

  readonly userInitial = computed(() => {
    const nome = this.authHandler?.currentUser?.()?.nome;
    return (nome?.charAt(0) || 'U').toUpperCase();
  });

  constructor() {
    addIcons({ notificationsOutline, logOutOutline });
  }

  onNotificationClick(): void {
    this.notificationClick.emit();
  }

  onLogoutClick(): void {
    this.logoutClick.emit();
    this.authHandler?.logout();
  }
}

