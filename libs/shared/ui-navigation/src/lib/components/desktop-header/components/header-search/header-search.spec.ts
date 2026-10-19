import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderSearch } from './header-search';

describe('HeaderSearch', () => {
  let component: HeaderSearch;
  let fixture: ComponentFixture<HeaderSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderSearch],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit searchChange on input event', () => {
    let emitted = '';
    component.searchChange.subscribe((val) => (emitted = val));

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Supermercado';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toBe('Supermercado');
  });

  it('should emit clear event when onClear is called', () => {
    let cleared = false;
    component.clear.subscribe(() => (cleared = true));

    component.onClear();
    expect(cleared).toBe(true);
  });
});

