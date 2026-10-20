import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderActions } from './header-actions';

describe('HeaderActions', () => {
  let component: HeaderActions;
  let fixture: ComponentFixture<HeaderActions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderActions],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderActions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit notificationClick on button click', () => {
    let clicked = false;
    component.notificationClick.subscribe(() => (clicked = true));

    const btn = fixture.nativeElement.querySelector('[data-testid="header-notifications-btn"]');
    btn.click();

    expect(clicked).toBe(true);
  });

  it('should call authHandler.logout when logout button is clicked', async () => {
    const logoutMock = vi.fn();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HeaderActions],
      providers: [
        {
          provide: (await import('../../../../tokens/auth-navigation.token')).AUTH_NAVIGATION_HANDLER,
          useValue: {
            logout: logoutMock,
            currentUser: () => ({ nome: 'João Silva', email: 'joao@teste.com' }),
          },
        },
      ],
    }).compileComponents();

    const authFixture = TestBed.createComponent(HeaderActions);
    const authComp = authFixture.componentInstance;
    authFixture.detectChanges();
    await authFixture.whenStable();

    expect(authComp.userInitial()).toBe('J');
    expect(authComp.userName()).toBe('João Silva');

    const logoutBtn = authFixture.nativeElement.querySelector('[data-testid="header-logout-btn"]');
    expect(logoutBtn).toBeTruthy();
    logoutBtn.click();

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});

