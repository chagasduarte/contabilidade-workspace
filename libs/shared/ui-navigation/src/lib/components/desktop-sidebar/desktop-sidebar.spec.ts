import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DesktopSidebar } from './desktop-sidebar';
import { HeaderStateService } from '../desktop-header/services/header-state.service';

describe('DesktopSidebar', () => {
  let component: DesktopSidebar;
  let fixture: ComponentFixture<DesktopSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopSidebar],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopSidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user info and call authHandler.logout when logout button is clicked', async () => {
    const logoutMock = vi.fn();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DesktopSidebar],
      providers: [
        provideRouter([]),
        {
          provide: (await import('../../tokens/auth-navigation.token')).AUTH_NAVIGATION_HANDLER,
          useValue: {
            logout: logoutMock,
            currentUser: () => ({ nome: 'Maria Silva', email: 'maria@teste.com' }),
          },
        },
      ],
    }).compileComponents();

    const authFixture = TestBed.createComponent(DesktopSidebar);
    const authComp = authFixture.componentInstance;
    authFixture.detectChanges();
    await authFixture.whenStable();

    expect(authComp.userInitial()).toBe('M');
    expect(authComp.userName()).toBe('Maria Silva');
    expect(authComp.userEmail()).toBe('maria@teste.com');

    const logoutBtn = authFixture.nativeElement.querySelector('[data-testid="sidebar-logout-btn"]');
    expect(logoutBtn).toBeTruthy();
    logoutBtn.click();

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('deve exibir o saldo em conta no menu lateral e permitir ocultar/mostrar', () => {
    const headerState = TestBed.inject(HeaderStateService);
    headerState.setAccountBalance(3450.75);
    fixture.detectChanges();

    const balanceEl = fixture.nativeElement.querySelector('[data-testid="sidebar-balance-value"]');
    expect(balanceEl?.textContent).toContain('3.450,75');

    const toggleBtn = fixture.nativeElement.querySelector('[data-testid="sidebar-balance-toggle"]');
    toggleBtn.click();
    fixture.detectChanges();

    expect(balanceEl?.textContent?.trim()).toBe('R$ •••••');
  });
});
