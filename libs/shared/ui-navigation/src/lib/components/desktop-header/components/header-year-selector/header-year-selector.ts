import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, chevronDownOutline } from 'ionicons/icons';

@Component({
  selector: 'app-header-year-selector',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './header-year-selector.html',
  styleUrl: './header-year-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderYearSelector {
  readonly selectedYear = input<number>(new Date().getFullYear());
  readonly availableYears = input<number[] | null>(null);

  readonly yearChange = output<number>();

  readonly yearsList = computed<number[]>(() => {
    const custom = this.availableYears();
    if (custom && custom.length > 0) {
      return custom;
    }
    const current = new Date().getFullYear();
    const result: number[] = [];
    for (let y = current - 3; y <= current + 2; y++) {
      result.push(y);
    }
    return result;
  });

  constructor() {
    addIcons({ calendarOutline, chevronDownOutline });
  }

  onYearSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const year = Number(target.value);
    if (!isNaN(year) && year > 0) {
      this.yearChange.emit(year);
    }
  }
}

