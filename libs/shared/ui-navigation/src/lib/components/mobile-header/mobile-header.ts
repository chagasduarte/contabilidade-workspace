import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  output,
} from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { IonHeader, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkDoneCircle,
  checkmarkOutline,
  menuOutline,
  walletOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';
import { HeaderStateService } from '../desktop-header/services/header-state.service';

registerLocaleData(localePt, 'pt-BR');

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
    { id: 10, label: 'Out' },
    { id: 11, label: 'Nov' },
    { id: 12, label: 'Dez' },
  ];

  private readonly headerState = inject(HeaderStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly selectedMonthId = this.headerState.selectedMonth;
  readonly showMonthSelector = this.headerState.showMonthSelector;
  readonly accountBalance = this.headerState.accountBalance;
  readonly balanceVisible = this.headerState.balanceVisible;
  monthChange = output<number>();
  menuClick = output<void>();

  constructor() {
    addIcons({
      checkmarkDoneCircle,
      checkmarkOutline,
      menuOutline,
      walletOutline,
      eyeOutline,
      eyeOffOutline,
    });

    // Mantém o mês ativo visível na régua horizontal.
    afterRenderEffect(() => {
      const id = this.selectedMonthId();
      // A régua só existe em telas mensais: rola também quando ela aparece.
      if (!this.showMonthSelector()) return;
      const pill = this.host.nativeElement.querySelector<HTMLElement>(`[data-month="${id}"]`);
      pill?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }

  toggleBalanceVisibility(): void {
    this.headerState.toggleBalanceVisibility();
  }

  selectMonth(id: number): void {
    this.headerState.setMonth(id);
    this.monthChange.emit(id);
  }
}
