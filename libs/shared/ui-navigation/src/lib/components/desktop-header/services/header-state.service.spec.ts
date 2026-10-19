import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderStateService } from './header-state.service';
import { DesktopHeaderStrategyFactory } from '../strategies/desktop-header-strategy.factory';

describe('HeaderStateService', () => {
  let service: HeaderStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        DesktopHeaderStrategyFactory,
        HeaderStateService,
      ],
    });

    service = TestBed.inject(HeaderStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should resolve DashboardHeaderStrategy for /dashboard route', () => {
    service.currentRoute.set('/dashboard');
    const config = service.headerConfig();

    expect(config.showSearch).toBe(false);
    expect(config.showYearSelector).toBe(true);
    expect(config.title).toBe('Dashboard');
  });

  it('should resolve LancamentosHeaderStrategy for /lancamentos route', () => {
    service.currentRoute.set('/lancamentos');
    const config = service.headerConfig();

    expect(config.showSearch).toBe(true);
    expect(config.showYearSelector).toBe(true);
    expect(config.searchPlaceholder).toBe('Buscar lançamentos...');
    expect(config.title).toBe('Lançamentos');
  });

  it('should update selectedYear when setYear is called', () => {
    service.setYear(2028);
    expect(service.selectedYear()).toBe(2028);
  });

  it('should update and clear searchTerm', () => {
    service.setSearchTerm('Farmácia');
    expect(service.searchTerm()).toBe('Farmácia');

    service.clearSearch();
    expect(service.searchTerm()).toBe('');
  });
});

