import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderYearSelector } from './header-year-selector';

describe('HeaderYearSelector', () => {
  let component: HeaderYearSelector;
  let fixture: ComponentFixture<HeaderYearSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderYearSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderYearSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit yearChange when a new year is selected', () => {
    let selected = 0;
    component.yearChange.subscribe((val) => (selected = val));

    const select = fixture.nativeElement.querySelector('select');
    select.value = '2025';
    select.dispatchEvent(new Event('change'));

    expect(selected).toBe(2025);
  });

  it('should generate default list of years around current year', () => {
    const current = new Date().getFullYear();
    const years = component.yearsList();
    expect(years).toContain(current);
    expect(years).toContain(current - 1);
    expect(years).toContain(current + 1);
  });
});

