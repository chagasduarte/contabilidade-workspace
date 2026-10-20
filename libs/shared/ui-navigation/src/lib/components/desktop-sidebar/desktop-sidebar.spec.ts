import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DesktopSidebar } from './desktop-sidebar';

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
});
