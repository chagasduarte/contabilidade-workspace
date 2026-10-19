import { Component, ChangeDetectionStrategy, Input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkDoneCircle, checkmarkOutline, menuOutline } from 'ionicons/icons';

export interface MonthOption {
  id: number;
  label: string;
}
@Component({
  selector: 'app-mobile-header',
  imports: [CommonModule, IonHeader, IonIcon],
  templateUrl: './mobile-header.html',
  styleUrl: './mobile-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileHeader {
  @Input() menuOpen = false;

  months: MonthOption[] = [
    { id: 1, label: 'Jan' },
    { id: 2, label: 'Fev' },
    { id: 3, label: 'Mar' },
    { id: 4, label: 'Abr' },
    { id: 5, label: 'Mai' },
    { id: 6, label: 'Jun' },
    { id: 7, label: 'Jul' },
    { id: 8, label: 'Ago' },
    { id: 9, label: 'Set' },
    { id: 10, label: 'OUT' },
    { id: 11, label: 'Nov' },
    { id: 12, label: 'Dez' },
  ];

  selectedMonthId = signal<number>(10);
  monthChange = output<number>();
  menuClick = output<void>();

  constructor() {
    addIcons({ checkmarkDoneCircle, checkmarkOutline, menuOutline });
  }

  selectMonth(id: number): void {
    this.selectedMonthId.set(id);
    this.monthChange.emit(id);
  }
}
