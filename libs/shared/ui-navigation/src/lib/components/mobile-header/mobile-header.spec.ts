import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MobileHeader } from './mobile-header';
import { HeaderStateService } from '../desktop-header/services/header-state.service';

describe('MobileHeader', () => {
  let component: MobileHeader;
  let fixture: ComponentFixture<MobileHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileHeader],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deve refletir o mês selecionado no HeaderStateService', () => {
    const headerState = TestBed.inject(HeaderStateService);
    headerState.showMonthSelector.set(true);

    component.selectMonth(3);
    fixture.detectChanges();

    expect(headerState.selectedMonth()).toBe(3);
    const ativo = (fixture.nativeElement as HTMLElement).querySelector('[aria-selected="true"]');
    expect(ativo?.textContent?.trim()).toBe('Mar');
  });

  it('não deve exibir a régua de meses fora das telas mensais', () => {
    TestBed.inject(HeaderStateService).showMonthSelector.set(false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')).toBeNull();
  });
});
