import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderSearch } from './components/header-search/header-search';
import { HeaderYearSelector } from './components/header-year-selector/header-year-selector';
import { HeaderActions } from './components/header-actions/header-actions';
import { HeaderStateService } from './services/header-state.service';

@Component({
  selector: 'app-desktop-header',
  standalone: true,
  imports: [CommonModule, HeaderSearch, HeaderYearSelector, HeaderActions],
  templateUrl: './desktop-header.html',
  styleUrl: './desktop-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopHeader {
  readonly headerState = inject(HeaderStateService);
  readonly config = this.headerState.headerConfig;

  onSearchChange(term: string): void {
    this.headerState.setSearchTerm(term);
  }

  onClearSearch(): void {
    this.headerState.clearSearch();
  }

  onYearChange(year: number): void {
    this.headerState.setYear(year);
  }
}

