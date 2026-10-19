import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileHeader } from './mobile-header';

describe('MobileHeader', () => {
  let component: MobileHeader;
  let fixture: ComponentFixture<MobileHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
