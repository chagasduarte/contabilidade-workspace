import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
} from 'ionicons/icons';

export interface MesItem {
  readonly valor: number;
  readonly nome: string;
}

export const LISTA_MESES: readonly MesItem[] = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
];

@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: './month-selector.html',
  styleUrl: './month-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthSelector {
  readonly mes = input.required<number>();
  readonly ano = input.required<number>();

  readonly mesChange = output<number>();
  readonly mesAnterior = output<void>();
  readonly proximoMes = output<void>();

  readonly meses = LISTA_MESES;

  constructor() {
    addIcons({
      calendarOutline,
      chevronBackOutline,
      chevronForwardOutline,
      chevronDownOutline,
    });
  }

  onPrev(): void {
    this.mesAnterior.emit();
  }

  onNext(): void {
    this.proximoMes.emit();
  }

  onSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const mesNum = Number(target.value);
    if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
      this.mesChange.emit(mesNum);
    }
  }
}

