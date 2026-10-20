import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AppLayout } from './app-layout';

@Component({
  standalone: true,
  template: '',
})
class TestRouteComponent {}

describe('AppLayout', () => {
  let component: AppLayout;
  let fixture: ComponentFixture<AppLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [
        provideRouter([{ path: 'contas-pagar', component: TestRouteComponent }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the mobile menu and navigate to a secondary section', async () => {
    const router = TestBed.inject(Router);
    const menuButton = fixture.nativeElement.querySelector(
      '.mobile-header__menu-btn',
    ) as HTMLButtonElement;

    menuButton.click();
    fixture.detectChanges();

    const menuLink = fixture.nativeElement.querySelector(
      '.layout-shell__mobile-menu-item[href="/contas-pagar"]',
    ) as HTMLAnchorElement | null;
    expect(menuLink).toBeTruthy();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    menuLink?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/contas-pagar');
    expect(
      fixture.nativeElement.querySelector('.layout-shell__mobile-menu'),
    ).toBeNull();
  });

  it('should call authHandler.logout when clicking logout in mobile menu', async () => {
    const logoutMock = vi.fn();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [
        provideRouter([]),
        {
          provide: (await import('../../tokens/auth-navigation.token')).AUTH_NAVIGATION_HANDLER,
          useValue: {
            logout: logoutMock,
            currentUser: () => ({ nome: 'Carlos', email: 'carlos@teste.com' }),
          },
        },
      ],
    }).compileComponents();

    const authFixture = TestBed.createComponent(AppLayout);
    const authComp = authFixture.componentInstance;
    authFixture.detectChanges();
    await authFixture.whenStable();

    // Abre menu mobile
    authComp.toggleMobileMenu();
    authFixture.detectChanges();

    const logoutBtn = authFixture.nativeElement.querySelector('[data-testid="mobile-menu-logout-btn"]');
    expect(logoutBtn).toBeTruthy();
    logoutBtn.click();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(authComp.isMobileMenuOpen()).toBe(false);
  });
});
