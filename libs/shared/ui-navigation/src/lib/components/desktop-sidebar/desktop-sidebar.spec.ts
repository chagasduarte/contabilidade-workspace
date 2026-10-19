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
});
