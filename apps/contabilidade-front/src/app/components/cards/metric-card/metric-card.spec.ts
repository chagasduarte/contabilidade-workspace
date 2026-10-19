import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  let component: MetricCard;
  let fixture: ComponentFixture<MetricCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricCard],
    }).compileComponents();

    fixture = TestBed.createComponent(MetricCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado', () => {
    expect(component).toBeTruthy();
  });

  it('deve calcular o valor decimal para o ion-progress-bar correctamente', () => {
    component.currentAmount = 40000;
    component.targetAmount = 45000;
    expect(component.progressValue).toBeCloseTo(0.888, 2);
  });

  it('deve limitar o valor máximo do progresso em 1', () => {
    component.currentAmount = 50000;
    component.targetAmount = 40000;
    expect(component.progressValue).toBe(1);
  });

  it('deve indicar que não há progresso quando o targetAmount for menor ou igual a zero', () => {
    component.currentAmount = 1000;
    component.targetAmount = 0;
    expect(component.progressValue).toBeNull();
  });

  it('deve exibir progresso zero quando há meta e ocultar a barra sem meta', () => {
    const progressBar = () => fixture.debugElement.query(By.css('[data-testid="progress-bar"]'));

    expect(progressBar()).toBeTruthy();

    fixture.componentRef.setInput('currentAmount', 0);
    fixture.detectChanges();

    expect(component.progressValue).toBe(0);
    expect(progressBar()).toBeTruthy();

    fixture.componentRef.setInput('targetAmount', 0);
    fixture.detectChanges();

    expect(progressBar()).toBeNull();
  });

  it('deve apresentar os valores monetários formatados no template', () => {
    component.currentAmount = 40000;
    component.targetAmount = 45000;
    fixture.detectChanges();

    const currentAmountEl = fixture.debugElement.query(By.css('[data-testid="current-amount"]'));
    const targetTextEl = fixture.debugElement.query(By.css('[data-testid="target-text"]'));

    expect(currentAmountEl.nativeElement.textContent).toContain('40.000');
    expect(targetTextEl.nativeElement.textContent).toContain('45.000');
  });

  it('deve alternar correctamente entre variações utilizando as Inputs de estilo e rotulagem', () => {
    fixture.componentRef.setInput('title', 'DESPESAS');
    fixture.componentRef.setInput('descriptionLabel', 'gastos de');
    fixture.componentRef.setInput('backgroundColor', '#cc5a4e');
    fixture.componentRef.setInput('progressFillColor', '#f5b5ab');
    fixture.componentRef.setInput('iconName', 'wallet-outline');
    fixture.detectChanges();

    const cardEl = fixture.debugElement.query(By.css('.metric-card'));
    const iconEl = fixture.debugElement.query(By.css('ion-icon'));
    const targetTextEl = fixture.debugElement.query(By.css('[data-testid="target-text"]'));

    expect(cardEl.nativeElement.style.getPropertyValue('--background')).toBe('#cc5a4e');
    expect(iconEl.properties['name']).toBe('wallet-outline');
    expect(targetTextEl.nativeElement.textContent).toContain('gastos de');
  });
});