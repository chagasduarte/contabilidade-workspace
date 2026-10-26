import { rotuloCategoria } from './categoria-label';

describe('rotuloCategoria', () => {
  const nomes = new Map([[1, 'Moradia']]);

  it('prioriza subcategoria_nome e depois categoria_nome', () => {
    expect(rotuloCategoria({ subcategoria_nome: 'Aluguel', categoria_nome: 'Moradia' })).toBe('Aluguel');
    expect(rotuloCategoria({ subcategoria_nome: null, categoria_nome: 'Moradia' })).toBe('Moradia');
  });

  it('resolve pelo idcategoria quando a API não manda nomes', () => {
    expect(rotuloCategoria({ idcategoria: 1, categoria: 12 }, nomes)).toBe('Moradia');
  });

  it('nunca exibe o id numérico', () => {
    expect(rotuloCategoria({ categoria: 12 })).toBe('Geral');
    expect(rotuloCategoria({ categoria: '12' })).toBe('Geral');
  });

  it('mantém rótulos textuais legados', () => {
    expect(rotuloCategoria({ categoria: 'Avulso' })).toBe('Avulso');
  });
});
