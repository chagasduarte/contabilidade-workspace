import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReceitasDespesasChart } from './receitas-despesas-chart';

describe('ReceitasDespesasChart', () => {
  let component: ReceitasDespesasChart;
  let fixture: ComponentFixture<ReceitasDespesasChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceitasDespesasChart],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceitasDespesasChart);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('revenues', 40000);
    fixture.componentRef.setInput('expenses', 12000);
    fixture.componentRef.setInput('accumulatedBalance', 32390);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the monthly balance amounts and commitment percentage from signal inputs', () => {
    const content = fixture.nativeElement.textContent.replace(/\u00a0/g, ' ');

    expect(content).toContain('R$ 28.000,00');
    expect(content).toContain('R$ 12.000,00');
    expect(content).toContain('30,00%');
    expect(content).toContain('R$ 4.390,00');
    expect(content).toContain('R$ 32.390,00');
  });
});
