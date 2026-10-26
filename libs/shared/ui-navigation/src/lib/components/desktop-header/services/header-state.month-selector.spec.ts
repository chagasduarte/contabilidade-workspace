import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HeaderStateService } from './header-state.service';
import { DesktopHeaderStrategyFactory } from '../strategies/desktop-header-strategy.factory';

@Component({ template: '' })
class Vazio {}

describe('HeaderStateService - régua de meses', () => {
  let service: HeaderStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Vazio,
            children: [
              { path: 'mensal', component: Vazio, data: { monthSelector: true } },
              { path: 'outra', component: Vazio },
            ],
          },
        ]),
        DesktopHeaderStrategyFactory,
        HeaderStateService,
      ],
    });
    service = TestBed.inject(HeaderStateService);
    router = TestBed.inject(Router);
  });

  it('exibe a régua em rotas com data.monthSelector', async () => {
    await router.navigateByUrl('/mensal');
    expect(service.showMonthSelector()).toBe(true);
  });

  it('esconde a régua nas demais rotas', async () => {
    await router.navigateByUrl('/mensal');
    await router.navigateByUrl('/outra');
    expect(service.showMonthSelector()).toBe(false);
  });

  it('setMonth ignora valores fora de 1-12', () => {
    service.setMonth(5);
    service.setMonth(13);
    expect(service.selectedMonth()).toBe(5);
  });
});
