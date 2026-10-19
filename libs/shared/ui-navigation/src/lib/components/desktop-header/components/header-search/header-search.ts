import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline, closeCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-header-search',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './header-search.html',
  styleUrl: './header-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderSearch {
  readonly placeholder = input<string>('Buscar...');
  readonly searchTerm = input<string>('');

  readonly searchChange = output<string>();
  readonly clear = output<void>();

  constructor() {
    addIcons({ searchOutline, closeCircleOutline });
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchChange.emit(target.value);
  }

  onClear(): void {
    this.clear.emit();
  }
}

