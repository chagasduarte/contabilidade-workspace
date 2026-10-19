import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'app-side-bar-options',
  imports: [IonIcon, RouterLink, RouterLinkActive],
  templateUrl: './side-bar-options.html',
  styleUrl: './side-bar-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideBarOptions {
  @Input({ required: true }) name!: string;
  @Input({ required: true }) route!: string;
  @Input({ required: true }) iconName!: string;
  @Input() collapsed = false;
}
