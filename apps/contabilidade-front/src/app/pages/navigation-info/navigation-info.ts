import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-navigation-info',
  templateUrl: './navigation-info.html',
  styleUrl: './navigation-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationInfo {
  private readonly route = inject(ActivatedRoute);

  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
}
