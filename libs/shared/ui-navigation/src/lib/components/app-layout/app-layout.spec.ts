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
});
