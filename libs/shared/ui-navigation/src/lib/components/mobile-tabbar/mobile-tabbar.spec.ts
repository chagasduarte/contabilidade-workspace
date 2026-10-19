import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MobileTabbar } from './mobile-tabbar';

describe('MobileTabbar', () => {
  let component: MobileTabbar;
  let fixture: ComponentFixture<MobileTabbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileTabbar],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileTabbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
