import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DesktopHeader } from './desktop-header';
import { HeaderStateService } from './services/header-state.service';

describe('DesktopHeader', () => {
  let component: DesktopHeader;
  let fixture: ComponentFixture<DesktopHeader>;
  let headerState: HeaderStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopHeader],
      providers: [provideRouter([]), HeaderStateService],
    }).compileComponents();

    headerState = TestBed.inject(HeaderStateService);
    fixture = TestBed.createComponent(DesktopHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show search on dashboard screen', () => {
    headerState.currentRoute.set('/dashboard');
    fixture.detectChanges();

    const searchEl = fixture.nativeElement.querySelector('app-header-search');
    const yearEl = fixture.nativeElement.querySelector('app-header-year-selector');

    expect(searchEl).toBeNull();
    expect(yearEl).not.toBeNull();
  });

  it('should show search and year selector on lancamentos screen', () => {
    headerState.currentRoute.set('/lancamentos');
    fixture.detectChanges();

    const searchEl = fixture.nativeElement.querySelector('app-header-search');
    const yearEl = fixture.nativeElement.querySelector('app-header-year-selector');

    expect(searchEl).not.toBeNull();
    expect(yearEl).not.toBeNull();
  });

  it('should update search term in headerState when onSearchChange is called', () => {
    component.onSearchChange('mercado');
    expect(headerState.searchTerm()).toBe('mercado');

    component.onClearSearch();
    expect(headerState.searchTerm()).toBe('');
  });

  it('should update selected year in headerState when onYearChange is called', () => {
    component.onYearChange(2027);
    expect(headerState.selectedYear()).toBe(2027);
  });
});

