import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MonthSelector } from './month-selector';

@Component({
  standalone: true,
  imports: [MonthSelector],
  template: `
    <app-month-selector
      [mes]="mes()"
      [ano]="ano()"
      (mesChange)="mes.set($event)"
      (mesAnterior)="onPrev()"
      (proximoMes)="onNext()"
    ></app-month-selector>
  `,
})
class TestHostComponent {
  readonly mes = signal(10);
  readonly ano = signal(2026);
  prevCalled = false;
  nextCalled = false;

  onPrev(): void {
    this.prevCalled = true;
  }

  onNext(): void {
    this.nextCalled = true;
  }
}

describe('MonthSelector', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and display month select and year', () => {
    expect(host).toBeTruthy();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(12);
    expect(select.value).toBe('10');

    const yearLabel = fixture.nativeElement.querySelector('[data-testid="month-year-label"]');
    expect(yearLabel.textContent).toContain('2026');
  });

  it('should emit mesAnterior on prev button click', () => {
    const prevBtn = fixture.nativeElement.querySelector('[data-testid="prev-month-btn"]');
    prevBtn.click();
    expect(host.prevCalled).toBe(true);
  });

  it('should emit proximoMes on next button click', () => {
    const nextBtn = fixture.nativeElement.querySelector('[data-testid="next-month-btn"]');
    nextBtn.click();
    expect(host.nextCalled).toBe(true);
  });

  it('should emit mesChange when a new month is selected', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '5';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.mes()).toBe(5);
  });
});

