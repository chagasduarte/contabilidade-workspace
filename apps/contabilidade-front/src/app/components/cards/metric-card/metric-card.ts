import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonProgressBar
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUpOutline, walletOutline } from 'ionicons/icons';

registerLocaleData(localePt);

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonProgressBar
  ],
  templateUrl: './metric-card.html',
  styleUrls: ['./metric-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCard {
  @Input() title = 'RECEBIMENTOS';
  @Input() currentAmount = 40000;
  @Input() targetAmount = 45000;
  @Input() currencyCode = 'BRL';
  
  // Customizações para o comportamento reaproveitável
  @Input() descriptionLabel = 'recebidos de';
  @Input() iconName = 'arrow-up-outline';
  @Input() backgroundColor = '#709366'; // Verde padrão
  @Input() textColor = '#ffffff';
  @Input() progressFillColor = '#d1e2cb'; // Tom mais claro para a barra de progresso verde

  constructor() {
    // Registra ambos os ícones necessários para as variações
    addIcons({ arrowUpOutline, walletOutline });
  }

  /**
   * O `ion-progress-bar` espera um valor entre 0 e 1 (decimal).
   */
  get progressValue(): number | null {
    if (!this.targetAmount || this.targetAmount <= 0) {
      return null;
    }
    const ratio = this.currentAmount / this.targetAmount;
    return Math.min(Math.max(ratio, 0), 1);
  }
}