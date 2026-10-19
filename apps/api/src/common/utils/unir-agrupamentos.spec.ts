import { describe, it, expect } from 'vitest';
import { unirAgrupamentos } from './unir-agrupamentos';

describe('unirAgrupamentos', () => {
  it('deve somar valores da mesma categoria entre semCartao e comCartao', () => {
    const semCartao = [
      { categoria: 'Alimentação', total_tipo: '100.50', idcategoria: 1 },
      { categoria: 'Transporte', total_tipo: '50.00', idcategoria: 2 },
    ];
    const comCartao = [
      { categoria: 'Alimentação', total_tipo: '49.50', idcategoria: 1 },
      { categoria: 'Lazer', total_tipo: '80.00', idcategoria: 3 },
    ];

    const resultado = unirAgrupamentos(semCartao, comCartao);

    const alimentacao = resultado.find((r) => r.categoria === 'Alimentação');
    expect(alimentacao).toBeDefined();
    expect(alimentacao?.total_tipo).toBe('150.00');
    expect(alimentacao?.idcategoria).toBe(1);

    const transporte = resultado.find((r) => r.categoria === 'Transporte');
    expect(transporte?.total_tipo).toBe('50.00');

    const lazer = resultado.find((r) => r.categoria === 'Lazer');
    expect(lazer?.total_tipo).toBe('80.00');
  });

  it('deve retornar vazio quando ambos os agrupamentos forem vazios', () => {
    const resultado = unirAgrupamentos([], []);
    expect(resultado).toEqual([]);
  });
});

